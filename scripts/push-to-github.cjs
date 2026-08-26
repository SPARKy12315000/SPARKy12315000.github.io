#!/usr/bin/env node
// 将 spark-release/ 内容推送到 SPARKy12315000/SPARKy12315000.github.io
// 用法：  GH_TOKEN=ghp_xxx node scripts/push-to-github.cjs
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.GH_TOKEN;
const REPO = 'SPARKy12315000/SPARKy12315000.github.io';
const REPO_URL = `https://${TOKEN}@github.com/${REPO}.git`;
const SRC = __dirname; // spark-release/

if (!TOKEN) { console.error('缺少 GH_TOKEN'); process.exit(1); }

const tmp = '/data/workspace/_deploy_tmp';
try { execSync(`rm -rf ${tmp}`); } catch(e) {}
execSync(`git clone ${REPO_URL} ${tmp}`, { stdio: 'inherit' });

// 清空仓库内容（保留 .git），拷贝 release 文件
execSync(`rm -rf ${tmp}/* ${tmp}/.[!.]* 2>/dev/null || true`, { stdio: 'inherit' });

// 拷贝所有文件（含隐藏的 .github）
execSync(`cp -r "${SRC}/." "${tmp}/"`, { stdio: 'inherit' });

// 清理部署脚本自身与 node_modules，避免污染 Pages
[ 'scripts/push-to-github.cjs', 'scripts/inject-hash.cjs', 'scripts/e2e-test.cjs', 'scripts/validate.cjs', 'scripts/deploy.cjs', 'scripts/manifest.cjs', 'scripts/build-android.sh' ].forEach(f => {
  const p = path.join(tmp, f);
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
});

process.chdir(tmp);
execSync('git config user.email "deploy@spark.token"', { stdio: 'inherit' });
execSync('git config user.name "SPARK Deploy"', { stdio: 'inherit' });
execSync('git add -A', { stdio: 'inherit' });
const msg = `Deploy SPARK DApp (auto) — ${new Date().toISOString()}`;
try {
  execSync(`git commit -m "${msg}"`, { stdio: 'inherit' });
} catch(e) {
  console.log('无变更可提交');
}
execSync('git push origin HEAD:main', { stdio: 'inherit' });
console.log('✅ 推送完成');
