#!/usr/bin/env node
// 部署前一步：将管理员密码 SHA-256 哈希注入 index.html（作为内联脚本设置 window.__SPARK_ADMIN_HASH__）
// 用法：  SPARK_ADMIN_PWD="Yy12315000" node scripts/inject-hash.cjs
// 策略：哈希只来自环境变量，源码/config.js 内绝不出现密码明文
const crypto = require('crypto');
const fs = require('fs');

const pwd = process.env.SPARK_ADMIN_PWD;
if (!pwd) { console.error('缺少环境变量 SPARK_ADMIN_PWD'); process.exit(1); }
const hash = crypto.createHash('sha256').update(pwd).digest('hex');
console.log('管理员密码 SHA-256:', hash);

// 注入到 index.html：在 </head> 前插入哈希内联脚本（若已存在则替换）
const htmlPath = 'index.html';
let html = fs.readFileSync(htmlPath, 'utf8');
const marker = '<script>window.__SPARK_ADMIN_HASH__=';
if (html.includes('__SPARK_ADMIN_HASH__')) {
  html = html.replace(/<script>window\.__SPARK_ADMIN_HASH__="[^"]*"<\/script>/, '');
}
html = html.replace('</head>', `<script>window.__SPARK_ADMIN_HASH__="${hash}"</script>\n</head>`);
fs.writeFileSync(htmlPath, html);
console.log('✅ 哈希已注入 index.html（密码明文未入源码）');
