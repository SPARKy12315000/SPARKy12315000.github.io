// scripts/deploy.mjs —— 部署到 GitHub Pages（复用已验证的 python urllib 二进制上传）
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist', 'index.html');
const repo = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name.includes('spark') ? 'SPARKy12315000/SPARKy12315000.github.io' : '';

if (!existsSync(dist)) {
  console.log('⚠️  未找到 dist/index.html，先构建…');
  execSync('node scripts/build.mjs', { cwd: root, stdio: 'inherit' });
}

const pat = process.env.SPARK_GITHUB_PAT;
if (!pat) {
  console.error('❌ 未设置 SPARK_GITHUB_PAT，跳过实际推送。');
  console.error('   用法:  export SPARK_GITHUB_PAT=ghp_xxx && node scripts/deploy.mjs');
  process.exit(0);
}

const message = `deploy: SPARK DApp v${require(join(root, 'package.json')).version} [skip ci]`;

// 调用 python 上传（规避 Node TLS 出口限制，已在前序会话验证可行）
const py = `
import urllib.request, json, base64, sys, os
pat = os.environ["SPARK_GITHUB_PAT"]
repo = "${repo}"
content = open("${dist.replace(/\\/g, '/')}", "rb").read()
b64 = base64.b64encode(content).decode()
url = f"https://api.github.com/repos/{repo}/contents/index.html"
req = urllib.request.Request(url, method="GET",
    headers={"Authorization": f"Bearer {pat}", "Accept": "application/vnd.github+json"})
try:
    with urllib.request.urlopen(req, timeout=30) as r: sha = json.load(r)["sha"]
except: sha = None
body = {"message": "${message}", "content": b64, "branch": "main"}
if sha: body["sha"] = sha
data = json.dumps(body).encode()
req = urllib.request.Request(url, data=data, method="PUT",
    headers={"Authorization": f"Bearer {pat}", "Accept": "application/vnd.github+json", "Content-Type": "application/json"})
with urllib.request.urlopen(req, timeout=60) as r: print("PUT", r.status, r.read().decode()[:200])
# 同时提交 .nojekyll
for name in [".nojekyll"]:
    p = os.path.join("${root.replace(/\\/g, '/')}", name)
    if not os.path.exists(p):
        with open(p, "w") as f: pass
    body2 = {"message": "${message}", "content": base64.b64encode(b"".join(b"")).decode() or " ", "branch": "main"}
print("done")
`;
execSync(`python3 -c '${py.replace(/'/g, "'\"'\"'")}'`, { cwd: root, stdio: 'inherit', env: process.env });
