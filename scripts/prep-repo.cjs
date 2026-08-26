#!/usr/bin/env node
// 通过 GitHub API 准备仓库：验证 token、确保仓库存在、开启 Pages、设置 Actions 权限
// 用法：  GH_TOKEN=ghp_xxx node scripts/prep-repo.cjs
const https = require('https');
const TOKEN = process.env.GH_TOKEN;
const REPO = 'SPARKy12315000/SPARKy12315000.github.io';

function gh(method, path, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com', path, method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`, 'User-Agent': 'SPARK-Deploy/1.0',
        'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: d ? JSON.parse(d) : null }); } catch(e) { resolve({ status: res.statusCode, body: d }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  console.log('[1] 验证身份...');
  const user = await gh('GET', '/user');
  console.log('  user:', user.status, user.body && (user.body.login || user.body.message));
  if (user.status !== 200) { console.error('❌ PAT 无效'); process.exit(1); }

  console.log('[2] 检查仓库...');
  let repo = await gh('GET', `/repos/${REPO}`);
  console.log('  repo:', repo.status, repo.body && (repo.body.full_name || repo.body.message));
  if (repo.status === 404) {
    console.log('  创建仓库...');
    repo = await gh('POST', '/user/repos', { name: 'SPARKy12315000.github.io', description: 'SPARK 星火通证 - 去中心化应用', homepage: 'https://sparky12315000.github.io', private: false, auto_init: true, has_pages: true });
    console.log('  create:', repo.status, repo.body && (repo.body.full_name || repo.body.message));
  }

  console.log('[3] 配置 Pages → GitHub Actions...');
  const pages = await gh('PUT', `/repos/${REPO}/pages`, { source: { branch: 'main', path: '/' } });
  console.log('  pages:', pages.status, pages.body && (pages.body.status || pages.body.message));

  console.log('[4] 设置 Actions 权限为 write...');
  const perm = await gh('PUT', `/repos/${REPO}/actions/permissions/workflow`, { default_workflow_permissions: 'write', can_approve_pull_request_reviews: false });
  console.log('  perm:', perm.status, perm.body && (perm.body.default_workflow_permissions || perm.body.message));

  console.log('\n✅ 仓库准备完成');
})();
