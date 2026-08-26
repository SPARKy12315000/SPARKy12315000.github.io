#!/usr/bin/env node
// 端到端测试：模拟空投领取逻辑（不依赖真实链上合约，验证纯业务逻辑）
const crypto = require('crypto');

const decimals = 18n;
const baseAmount = 100000000n * 10n ** decimals;       // 1 亿
const inviteReward = 10000000n * 10n ** decimals;      // 1000 万
const pauseThreshold = 100000n * 10n ** decimals;      // 100,000

let ledger = [];
let claimed = new Set();
const invites = {}; // addr -> count
let marketingBalance = 500000000n * 10n ** decimals; // 初始 5 亿 SPARK（足够发放，验证阈值机制）

function claim(addr, inviter){
  if (marketingBalance < pauseThreshold) return { ok:false, msg:'暂停：余额不足' };
  if (claimed.has(addr.toLowerCase())) return { ok:false, msg:'已领取' };
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return { ok:false, msg:'地址无效' };
  claimed.add(addr.toLowerCase());
  marketingBalance -= baseAmount;
  const entry = { address:addr, inviter: inviter||null, amount:baseAmount };
  ledger.push(entry);
  if (inviter && claimed.has(inviter.toLowerCase())){
    invites[inviter] = (invites[inviter]||0n) + inviteReward; // 简化：仅计数
  }
  return { ok:true, msg:'领取成功' };
}

// 测试
const A = '0x' + 'a'.repeat(40);
const B = '0x' + 'b'.repeat(40);
const C = '0x' + 'c'.repeat(40);
const BAD = '0x123';

console.log('测试 1 - 新人 A 领取（无邀请人）:', JSON.stringify(claim(A)));
console.log('测试 2 - B 通过 A 邀请领取:', JSON.stringify(claim(B, A)));
console.log('测试 3 - C 通过 A 邀请领取:', JSON.stringify(claim(C, A)));
console.log('测试 4 - A 重复领取（应失败）:', JSON.stringify(claim(A)));
console.log('测试 5 - 无效地址（应失败）:', JSON.stringify(claim(BAD)));

// 模拟余额耗尽至阈值以下
let i = 0;
while (marketingBalance >= pauseThreshold && i < 100){ marketingBalance -= baseAmount; i++; }
console.log(`\n营销钱包已发放 ${i} 次，剩余: ${marketingBalance / 10n**decimals} SPARK`);

const D = '0x' + 'd'.repeat(40);
console.log('测试 6 - 余额不足时领取（应暂停）:', JSON.stringify(claim(D)));

console.log('\n== 统计 ==');
console.log('领取人数:', ledger.length);
console.log('A 邀请人数:', Object.keys(invites).length ? invites[A] : 0);
console.log('A 邀请奖励总额:', invites[A] ? invites[A] / 10n**decimals + ' SPARK' : '0');
console.log('每地址奖励:', baseAmount / 10n**decimals, 'SPARK (=1亿)');
console.log('邀请奖励:', inviteReward / 10n**decimals, 'SPARK (=1000万)');

// 管理员哈希验证（密码仅来自环境变量，无硬编码默认值）
const adminPwd = process.env.SPARK_ADMIN_PWD || '';
const hash = crypto.createHash('sha256').update(adminPwd).digest('hex');
console.log('\n管理员密码哈希(SHA-256):', hash);
console.log('哈希长度:', hash.length, '(应为64)');

// 校验
const ok = ledger.length === 3 && claimed.has(A) && claimed.has(B) && claimed.has(C) && !claimed.has(D);
console.log('\n' + (ok ? '✅ 全部业务逻辑测试通过' : '❌ 测试失败'));
process.exit(ok ? 0 : 1);
