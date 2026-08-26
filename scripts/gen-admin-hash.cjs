#!/usr/bin/env node
// 生成管理员密码的 SHA-256 哈希，供填入 config.js 的 SPARK.ADMIN.passwordHash
// 用法：  SPARK_ADMIN_PWD="你的密码" node scripts/gen-admin-hash.cjs
// 注意：密码仅来自环境变量，脚本本身不保存明文
const crypto = require('crypto');

const pwd = process.env.SPARK_ADMIN_PWD;
if (!pwd) {
  console.error('请先设置环境变量 SPARK_ADMIN_PWD');
  console.error('示例:  SPARK_ADMIN_PWD="xxxx" node scripts/gen-admin-hash.cjs');
  process.exit(1);
}
const hash = crypto.createHash('sha256').update(pwd).digest('hex');
console.log('将下面这行哈希填入 js/config.js 的 SPARK.ADMIN.passwordHash：\n');
console.log(hash);
