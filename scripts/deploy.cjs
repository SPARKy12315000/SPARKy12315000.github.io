#!/usr/bin/env node
/**
 * SPARK 自动部署脚本
 * 1. 生成管理员密码哈希（密码通过环境变量传入，代码内不出镜明文）
 * 2. 校验关键文件完整性
 * 3. 推送到 SPARKy12315000/SPARKy12315000.github.io
 * 4. 验证 GitHub Pages 上线 + APK 构建触发（密码通过 SPARK_ADMIN_PWD 环境变量传入）
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = 'SPARKy12315000/SPARKy12315000.github.io';
const REMOTE = `https://github.com/${REPO}.git`;
const SITE = 'https://sparky12315000.github.io/';

// ---------- 1) 密码哈希 ----------
// 密码仅来自环境变量（CI 中通过 GitHub Secret 注入），脚本本身不保存明文
const ADMIN_PWD = process.env.SPARK_ADMIN_PWD;
if (!ADMIN_PWD) {
  console.error('缺少环境变量 SPARK_ADMIN_PWD（请在 CI Secrets 或本地 export 中设置管理员密码）');
  process.exit(1);
}
const hash = crypto.createHash('sha256').update(ADMIN_PWD).digest('hex');
console.log('[1] 管理员密码哈希已生成（明文不落地）:', hash.slice(0,8)+'...');

// 注入到 config.js（替换占位符，仅保留哈希，无明文）
const cfgPath = path.join(__dirname, '..', 'js', 'config.js');
let cfg = fs.readFileSync(cfgPath, 'utf8');
cfg = cfg.replace(/window\.__SPARK_ADMIN_HASH__\s*\|\|\s*'[^']*'/, `'${hash}'`);
fs.writeFileSync(cfgPath, cfg);
console.log('[1] 已注入 config.js（明文密码不入库）');

// ---------- 2) 校验 ----------
const required = [
  'index.html', 'js/config.js', 'js/app.js', 'js/airdrop.js', 'js/wallet.js',
  'js/storage.js', 'js/ai.js', 'js/upgrade.js', 'js/admin.js',
  '.github/workflows/deploy.yml'
];
const missing = required.filter(f => !fs.existsSync(path.join(__dirname, '..', f)));
if (missing.length) { console.error('缺少文件:', missing); process.exit(1); }
console.log('[2] 文件完整性校验通过');

// ---------- 3) Git 推送 ----------
const ROOT = path.join(__dirname, '..');
process.chdir(ROOT);
const token = process.env.GH_TOKEN;
if (!token) { console.error('缺少环境变量 GH_TOKEN'); process.exit(1); }

try { execSync('git rev-parse --is-inside-work-tree', { stdio:'ignore' }); }
catch(e){ execSync('git init -b main', { stdio:'inherit' }); }

execSync('git config user.email "spark@sparktoken.eth"', { stdio:'inherit' });
execSync('git config user.name "SPARK Bot"', { stdio:'inherit' });
execSync('git rm -rf . >/dev/null 2>&1 || true', { stdio:'inherit' });
execSync('git add -A', { stdio:'inherit' });
execSync('git commit -m "feat: SPARK full DApp - chat/airdrop/AI/shop/market + Android APK" || true', { stdio:'inherit' });

const authRemote = `https://${token}@github.com/${REPO}.git`;
execSync(`git remote add origin ${authRemote} 2>/dev/null || git remote set-url origin ${authRemote}`, { stdio:'inherit' });
console.log('[3] 推送到', REPO, '...');
execSync('git push -f origin main', { stdio:'inherit' });
console.log('[3] ✅ 推送完成');

// ---------- 4) 验证 ----------
console.log('[4] 等待 Pages 部署（约 30s）...');
setTimeout(() => {
  try {
    const res = execSync(`curl -s -o /dev/null -w "%{http_code}" ${SITE}`).toString();
    console.log(`[4] ${SITE} => HTTP ${res}`);
  } catch(e){ console.log('[4] 站点尚未就绪，稍后请手动访问'); }
  console.log('[4] 检查 Actions:', `https://github.com/${REPO}/actions`);
  console.log('[4] 检查 Releases (APK):', `https://github.com/${REPO}/releases`);
}, 15000);
