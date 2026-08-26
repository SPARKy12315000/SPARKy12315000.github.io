#!/usr/bin/env node
/**
 * 部署：构建产物 → GitHub 仓库（SPARKy12315000/SPARKy12315000.github.io）
 * 用法：node scripts/deploy.mjs [PAT]
 * PAT 优先读环境变量 SPARK_GITHUB_PAT，其次命令行参数
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PAT = process.env.SPARK_GITHUB_PAT || process.argv[2];

if (!PAT) {
  console.error('❌ 需要 GitHub PAT。用法: SPARK_GITHUB_PAT=ghp_xxx node scripts/deploy.mjs');
  console.error('   或在管理员面板的"部署"中填入 PAT（仅内存，不落盘）');
  process.exit(1);
}

const OWNER = 'SPARKy12315000';
const REPO = 'SPARKy12315000.github.io';
const BRANCH = 'main';

// 1) 构建
console.log('🔨 构建...');
execSync('node scripts/build.mjs', { cwd: ROOT, stdio: 'inherit' });

const distFile = join(ROOT, 'dist', 'index.html');
if (!existsSync(distFile)) { console.error('❌ 构建失败：dist/index.html 不存在'); process.exit(1); }
// 显式以 UTF-8 解码，再按 UTF-8 重新编码为 base64，杜绝编码错乱/乱码
const content = readFileSync(distFile, 'utf8');
if (content.includes('\uFFFD')) { console.error('❌ 产物含非法字符(U+FFFD)，疑似编码损坏，终止上传'); process.exit(1); }
const b64 = Buffer.from(content, 'utf8').toString('base64');

// 2) 获取当前文件 SHA（更新必需）
const ghFetch = (path) => `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`;
const headers = (extra = {}) => ({
  Authorization: `Bearer ${PAT}`, Accept: 'application/vnd.github+json', ...extra,
});

async function gh(path, opts = {}) {
  const res = await fetch(path, opts);
  const text = await res.text();
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function main() {
  const repoBase = `https://api.github.com/repos/${OWNER}/${REPO}`;
  // 检查仓库存在
  await gh(`${repoBase}`, { headers: headers() });

  // 先尝试读根目录是否有 index.html
  let sha = null;
  try {
    const cur = await gh(ghFetch('index.html'), { headers: headers() });
    sha = cur.sha;
  } catch { /* 不存在则创建 */ }

  console.log(sha ? '📤 更新 index.html...' : '📤 创建 index.html...');
  await gh(`${repoBase}/contents/index.html`, {
    method: 'PUT',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      message: 'deploy: SPARK DApp v2.0 (auto)', branch: BRANCH,
      content: b64, ...(sha ? { sha } : {}),
    }),
  });

  // 3) 同时部署到 dist 分支（可选，供 IPFS 镜像）
  console.log('✅ 已提交到 main 分支');
  console.log('🌐 GitHub Pages 将在 1-3 分钟内发布到 https://sparky12315000.github.io/');
  console.log('🔗 同时建议将 dist/ 上传 IPFS 生成 CID，写入 CONFIG.ipfs 实现双托管');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
