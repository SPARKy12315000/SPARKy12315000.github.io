#!/usr/bin/env python3
"""
SPARK DApp v2.1.0-cachefix 部署
修复：Service Worker 缓存导致旧版残留 → 用户看到乱码/头像缺失
方案：注销所有 SW + 清空 caches + 版本标记 + 首次强制 reload
推送：完整项目源码 + dist/index.html（单文件，含内嵌头像/背景 base64）
"""
import json, base64, urllib.request, urllib.error, os, sys, subprocess

REPO = "SPARKy12315000/SPARKy12315000.github.io"
API = f"https://api.github.com/repos/{REPO}"
TOKEN = os.environ.get("SPARK_GITHUB_PAT")
HEADERS = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "SPARK-Deploy/2.1",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
}
if TOKEN:
    HEADERS["Authorization"] = f"Bearer {TOKEN}"

def gh(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(f"{API}{path}", data=data, method=method, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, {"error": e.read().decode()[:1200]}

def file_blob(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    project = os.path.dirname(here)
    os.chdir(project)

    # 0 构建
    print("[*] 构建...")
    subprocess.run(["npm", "run", "build"], check=True)
    assert os.path.exists("dist/index.html"), "构建产物缺失"

    # 1 仓库元信息
    s, r = gh("GET", "")
    assert s == 200, f"仓库访问失败 {r}"
    branch = r["default_branch"]
    print(f"[*] 默认分支: {branch}")

    s, r = gh("GET", f"/git/ref/heads/{branch}")
    assert s == 200, r
    head_sha = r["object"]["sha"]

    # 2 收集要推送的文件（完整项目，不含噪声）
    tree = []
    # 2a 站点入口（最重要）
    tree.append({"path": "index.html", "mode": "100644", "type": "blob",
                 "sha": None, "content_b64": file_blob("dist/index.html")})

    # 2b 源码 + 脚本 + 配置 + 资源
    include = [
        "src/index.html", "src/config.js", "src/wallet.js", "src/storage.js",
        "src/chat.js", "src/market.js", "src/shop.js", "src/video.js",
        "src/ai.js", "src/admin.js", "src/github.js", "src/app.js",
        "src/styles.css",
        "scripts/build.mjs", "scripts/deploy.mjs", "scripts/deploy-now.py",
        "scripts/lint.mjs", "scripts/verify.mjs", "scripts/e2e.mjs",
        "scripts/deploy-cachefix.py",
        "assets/logo.png", "assets/background.png",
        "manifest.json", "README.md", "package.json",
    ]
    for p in include:
        if os.path.exists(p):
            tree.append({"path": p, "mode": "100644", "type": "blob",
                         "sha": None, "content_b64": file_blob(p)})

    # 2c .nojekyll（GitHub Pages 需识别 _ 开头目录）
    tree.append({"path": ".nojekyll", "mode": "100644", "type": "blob",
                 "sha": None, "content_b64": ""})

    # 3 创建 blob（分批，避免单请求过大；index.html 最大 ~400KB）
    # 先处理大文件（index.html / png），再处理小文件；任一失败打印详情
    def make_blob(item):
        b64c = item["content_b64"]
        payload = {"content": "", "encoding": "base64"} if b64c == "" else {"content": b64c, "encoding": "base64"}
        s, r = gh("POST", "/git/blobs", payload)
        if s != 201:
            print(f"❌ blob 失败: {item['path']} -> {s} {str(r)[:500]}")
            raise SystemExit(1)
        item["sha"] = r["sha"]

    # 按大小降序，大文件先传
    order = sorted(tree, key=lambda i: len(i.get("content_b64", "")), reverse=True)
    for item in order:
        if item.get("sha"):
            continue
        make_blob(item)
    print(f"[*] blobs 创建完成: {len(tree)} 个文件")

    # 4 tree
    tree_payload = {"base_tree": head_sha,
                    "tree": [{"path": i["path"], "mode": i["mode"], "type": i["type"], "sha": i["sha"]} for i in tree]}
    s, r = gh("POST", "/git/trees", tree_payload)
    assert s == 201, f"tree 失败 {r}"
    tree_sha = r["sha"]

    # 5 commit
    s, r = gh("POST", "/git/commits", {
        "message": "fix(v2.1.0-cachefix): 注销旧 Service Worker + 内嵌头像背景，根治乱码/头像消失\n\n- 页面顶部注入 SW 注销 + caches.clear() + 版本标记\n- 首次进入自动 location.reload(true)，无需手动 Ctrl+Shift+R\n- logo/background 以 base64 内联，IPFS 不可达也必显示\n- 版本号升至 2.1.0-cachefix",
        "tree": tree_sha, "parents": [head_sha],
    })
    assert s == 201, f"commit 失败 {r}"
    commit_sha = r["sha"]

    # 6 更新引用
    s, r = gh("PATCH", f"/git/refs/heads/{branch}", {"sha": commit_sha, "force": False})
    assert s == 200, f"ref 更新失败 {r}"

    print(f"✅ 部署成功")
    print(f"   https://{REPO.split('/')[0]}.github.io/")
    print(f"   Commit: {commit_sha}")
    print(f"   版本: 2.1.0-cachefix")

if __name__ == "__main__":
    main()
