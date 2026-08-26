#!/usr/bin/env python3
"""
SPARK DApp 一键部署到 GitHub Pages
用法:
  export SPARK_GITHUB_PAT=ghp_xxx
  python3 scripts/deploy-now.py

设计说明:
  沙盒 Node.js 的 TLS 出口被限制，故用 python urllib 发送 GitHub API 请求
  (curl 对超大 body 也会 400，python 最稳定)。逻辑：
  1) 读取 dist/index.html (构建产物，单文件)
  2) base64 -> create blob
  3) create tree (index.html + .nojekyll)
  4) create commit
  5) update ref (main)
"""
import json, base64, urllib.request, urllib.error, os, sys, subprocess

REPO = "SPARKy12315000/SPARKy12315000.github.io"
API = f"https://api.github.com/repos/{REPO}"
HEADERS = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "SPARK-Deploy",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
}

def gh(method, path, body=None):
    token = os.environ.get("SPARK_GITHUB_PAT")
    if not token:
        sys.exit("❌ 未设置环境变量 SPARK_GITHUB_PAT")
    h = dict(HEADERS, Authorization=f"Bearer {token}")
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(f"{API}{path}", data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, {"error": e.read().decode()[:800]}

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    project = os.path.dirname(here)
    os.chdir(project)

    # 构建
    print("[*] 构建产物...")
    subprocess.run(["npm", "run", "build"], check=True)
    html = "dist/index.html"
    if not os.path.exists(html):
        sys.exit(f"❌ 找不到 {html}，请先 npm run build")

    # 1 仓库信息
    s, r = gh("GET", "")
    assert s == 200, r
    branch = r["default_branch"]

    # 2 HEAD
    s, r = gh("GET", f"/git/ref/heads/{branch}")
    assert s == 200, r
    head_sha = r["object"]["sha"]

    # 3 blob
    with open(html, "rb") as f:
        html_b64 = base64.b64encode(f.read()).decode()
    s, r = gh("POST", "/git/blobs", {"content": html_b64, "encoding": "base64"})
    assert s == 201, r
    html_sha = r["sha"]
    s, r = gh("POST", "/git/blobs", {"content": "", "encoding": "base64"})
    assert s == 201, r
    nojekyll_sha = r["sha"]

    # 4 tree
    s, r = gh("POST", "/git/trees", {
        "base_tree": head_sha,
        "tree": [
            {"path": "index.html", "mode": "100644", "type": "blob", "sha": html_sha},
            {"path": ".nojekyll", "mode": "100644", "type": "blob", "sha": nojekyll_sha},
        ],
    })
    assert s == 201, r
    tree_sha = r["sha"]

    # 5 commit
    s, r = gh("POST", "/git/commits", {
        "message": "deploy: SPARK DApp (automated)",
        "tree": tree_sha, "parents": [head_sha],
    })
    assert s == 201, r
    commit_sha = r["sha"]

    # 6 更新引用
    s, r = gh("PATCH", f"/git/refs/heads/{branch}", {"sha": commit_sha, "force": False})
    assert s == 200, r

    print(f"✅ 部署成功: https://{REPO.split('/')[0]}.github.io/")
    print(f"   Commit: {commit_sha}")

if __name__ == "__main__":
    main()
