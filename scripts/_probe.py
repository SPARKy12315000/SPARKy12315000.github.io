#!/usr/bin/env python3
"""预检：验证 PAT 能访问仓库 + 推送权限。"""
import os, json, urllib.request, urllib.error

REPO = "SPARKy12315000/SPARKy12315000.github.io"
PAT = os.environ["SPARK_GITHUB_PAT"]

def get(path):
    req = urllib.request.Request(f"https://api.github.com{path}",
        headers={"Authorization": f"Bearer {PAT}", "Accept": "application/vnd.github+json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode() or "{}"), r.status
    except urllib.error.HTTPError as e:
        return None, e.code

info, st = get(f"/repos/{REPO}")
print("repo:", st, info.get("full_name") if info else None)
print("permissions:", info.get("permissions") if info else None)
print("default_branch:", info.get("default_branch") if info else None)

# 测试写权限：尝试读 index.html（需要能 PUT 则需 write）
idx, st2 = get(f"/repos/{REPO}/contents/index.html")
print("index.html:", st2, (idx.get("sha")[:10] if idx and idx.get("sha") else None))

user, st3 = get("/user")
print("authenticated user:", user.get("login") if user else st3)
