#!/usr/bin/env python3
"""完整部署：将 spark-dapp 全部源码推送到 SPARKy12315000/SPARKy12315000.github.io (main 分支)."""
import os, subprocess, shutil, base64, json, urllib.request, urllib.error, urllib.parse, sys, time

REPO = "SPARKy12315000/SPARKy12315000.github.io"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAT = os.environ["SPARK_GITHUB_PAT"]

def gh(method, path, body=None, params=None):
    url = f"https://api.github.com{path}"
    if params: url += "?" + urllib.parse.urlencode(params)
    headers = {"Authorization": f"Bearer {PAT}", "Accept": "application/vnd.github+json"}
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode() or "{}"), r.status
    except urllib.error.HTTPError as e:
        print(f"[gh] {method} {path} -> {e.code} {e.read().decode()[:300]}")
        return None, e.code

# 1. 检查仓库是否存在
info, status = gh("GET", f"/repos/{REPO}")
if not info:
    sys.exit(f"❌ 仓库 {REPO} 无法访问（{status}）。请确认已创建并 PAT 有权限。")
print(f"[repo] {info.get('full_name')} default_branch={info.get('default_branch')}")
branch = info.get("default_branch", "main")

# 2. 本地 git 初始化 + 配置
os.chdir(ROOT)
subprocess.run(["git", "config", "--global", "user.email", "spark@deploy.local"], check=False)
subprocess.run(["git", "config", "--global", "user.name", "SPARK Deploy Bot"], check=False)

# 清理 node_modules / .git 避免污染
for p in ["node_modules", ".git", "__pycache__", "dist/sources.js"]:
    fp = os.path.join(ROOT, p)
    if os.path.isdir(fp):
        shutil.rmtree(fp, ignore_errors=True)
    elif os.path.isfile(fp):
        os.remove(fp)

# 确保 .nojekyll 存在
open(os.path.join(ROOT, ".nojekyll"), "w").close()

# 写一份精简 .gitignore
with open(os.path.join(ROOT, ".gitignore"), "w") as f:
    f.write("node_modules/\n__pycache__/\n*.log\n")

subprocess.run(["git", "init", "-q"], check=False)
subprocess.run(["git", "branch", "-M", branch], check=False)
subprocess.run(["git", "add", "-A"], check=True)

msg = "feat: SPARK DApp v2.2.0-i18n — 多语言检测 + 合约/官网自检升级 + 乱码/头像根治 [skip ci]"
r = subprocess.run(["git", "commit", "-q", "-m", msg], capture_output=True, text=True)
print(f"[commit] {r.stdout[-200:] or r.stderr[-200:]}")

# 3. 用 PAT 作为 push URL 推送（覆盖式，强制更新）
remote = f"https://{PAT}@github.com/{REPO}.git"
subprocess.run(["git", "remote", "remove", "origin"], check=False)
subprocess.run(["git", "remote", "add", "origin", remote], check=True)
r = subprocess.run(["git", "push", "-f", "origin", branch], capture_output=True, text=True)
print(f"[push] rc={r.returncode}")
print(r.stdout[-400:])
print(r.stderr[-400:])

# 4. 触发一次 Pages build（PUT index.html 会触build，这里额外确认 dist 产物也以 blob 形式落到 gh-pages 若需要）
# 通过 GitHub API 读取 index.html 验证已发布
import time
time.sleep(3)
idx, st = gh("GET", f"/repos/{REPO}/contents/index.html")
print(f"[verify] index.html sha={idx.get('sha')[:10] if idx else None} size={idx.get('size') if idx else None}")
pages, _ = gh("GET", f"/repos/{REPO}/pages")
print(f"[pages] status={pages.get('status') if pages else None} url={pages.get('html_url') if pages else None}")
print("DONE")
