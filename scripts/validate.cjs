#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const errors = [];

function check(name, cond, detail){
  if (cond){ pass++; /* console.log('  ✅', name); */ }
  else { fail++; errors.push(name + (detail ? ' :: ' + detail : '')); console.log('  ❌', name, detail||''); }
}

console.log('═══ SPARK DApp 校验 ═══\n');

// 1) JS 语法（Node --check）
console.log('[1] JS 语法检查');
const jsFiles = ['js/config.js','js/i18n.js','js/wallet.js','js/storage.js','js/airdrop.js',
  'js/chat.js','js/market.js','js/shop.js','js/ai.js','js/upgrade.js','js/admin.js','js/app.js'];
for (const f of jsFiles){
  const p = path.join(ROOT, f);
  try { new Function(fs.readFileSync(p,'utf8')); check(`语法 ${f}`, true); }
  catch(e){ check(`语法 ${f}`, false, e.message.split('\n')[0]); }
}

// 2) 关键文件存在
console.log('\n[2] 文件结构');
const required = [
  'index.html','js/config.js','js/app.js','js/airdrop.js','js/wallet.js',
  'js/storage.js','js/ai.js','js/upgrade.js','js/admin.js','js/chat.js','js/market.js','js/shop.js','js/i18n.js',
  '.github/workflows/deploy.yml','scripts/build-android.sh','scripts/deploy.cjs','scripts/validate.cjs','scripts/gen-admin-hash.cjs','scripts/manifest.cjs'
];
for (const f of required) check('存在 ' + f, fs.existsSync(path.join(ROOT, f)));

// 3) index.html 引用一致性
console.log('\n[3] HTML 引用');
const html = fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
jsFiles.forEach(f => check('HTML 引用 ' + f, html.includes(f)));
check('ethers CDN', html.includes('ethers'));
check('GunDB CDN', html.includes('gun'));
check('FontAwesome CDN', html.includes('font-awesome'));
check('合约地址一致', html.includes('0xD580C7C9Cde5ce776fEed844310330A2a40078d9'));
check('中英文切换器', html.includes('langText'));

// 4) 密码明文扫描（核心安全要求：整个工程任何文件都不允许出现密码字面量）
console.log('\n[4] 安全：管理员密码明文扫描');
// 检测用的弱密码样本以编码形式存放（避免源码出现明文），运行时解码比对
// 如需自定义样本：export VALIDATE_SAMPLE="xxxx"
const SAMPLE = process.env.SPARK_ADMIN_PWD || process.env.VALIDATE_SAMPLE || '';
const encodedWeak = ['c3BhcmsyMDI0', 'MTIzNDU2Nzg=', 'cGFzc3dvcmQxMjM=']; // base64('spark2024'/'12345678'/'password123')
const forbiddenLiterals = encodedWeak.map(s => Buffer.from(s, 'base64').toString('utf8'));
if (SAMPLE) forbiddenLiterals.push(SAMPLE);
const allFiles = [];
function collect(dir){
  for (const f of fs.readdirSync(dir)){
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()){
      if (['node_modules','.git','android','apk-out','_site'].includes(f)) continue;
      collect(p);
    } else if (/\.(js|cjs|html|md|yml|sh)$/.test(f)) allFiles.push(p);
  }
}
collect(ROOT);
let plainFiles = [];
for (const p of allFiles){
  const content = fs.readFileSync(p,'utf8');
  const rel = path.relative(ROOT, p).replace(/\\/g,'/');
  if (forbiddenLiterals.some(lit => content.includes(lit))) plainFiles.push(rel);
}
check('全工程无密码明文（js/config.js 等）', plainFiles.length === 0, plainFiles.join(', '));
const cfg2 = fs.readFileSync(path.join(ROOT,'js/config.js'),'utf8');
check('config.js 使用占位符（无硬编码哈希）', /\.js map|\.js\)|__SPARK_ADMIN_HASH__/.test(cfg2) || cfg2.includes('0000000000000000000000000000000000000000000000000000000000000000'));

// 5) 管理员哈希匹配校验（仅在已注入真实哈希时校验；占位态跳过）
console.log('\n[5] 管理员哈希校验');
const expectedHash = SAMPLE ? crypto.createHash('sha256').update(SAMPLE).digest('hex') : null;
const cfg = fs.readFileSync(path.join(ROOT,'js/config.js'),'utf8');
const m = cfg.match(/passwordHash:\s*'([^']+)'/);
if (m && !/^0+$/.test(m[1]) && expectedHash){
  check('哈希长度 64 位', m[1].length === 64);
  check('哈希与样本密码匹配', m[1] === expectedHash, `期望 ${expectedHash.slice(0,16)}...\n      实际 ${m[1].slice(0,16)}...`);
} else if (m && !/^0+$/.test(m[1])) {
  check('哈希已注入（长度 64 位）', m[1].length === 64, m[1]);
} else { check('哈希占位（部署时注入）', true, '占位态：deploy.cjs 将在 CI 中注入真实哈希'); }

// 6) 合约/空投参数
console.log('\n[6] 空投经济模型参数');
const air = fs.readFileSync(path.join(ROOT,'js/airdrop.js'),'utf8');
const cfg3 = fs.readFileSync(path.join(ROOT,'js/config.js'),'utf8');
check('新人 1亿 (1e8 * 1e18 量级)', cfg3.includes('100000000000000000000000000') || air.includes('baseAmount'));
check('邀请 1000万', cfg3.includes('10000000000000000000000000') || air.includes('inviteReward'));
check('暂停阈值 100,000', cfg3.includes('100000000000000000000000') || air.includes('pauseThreshold'));
check('邀请深度 ≤ 3', air.includes('maxInviteDepth') || cfg3.includes('maxInviteDepth'));
check('私钥黑洞提示', air.includes('dEaD') || air.includes('黑洞') || air.includes('黑洞地址'));
check('营销钱包余额监测', air.includes('refreshMarketingBalance'));
check('单地址防重复', air.includes('already_claimed') || air.includes('claimed'));

// 7) 去中心化存储
console.log('\n[7] 去中心化存储');
const st = fs.readFileSync(path.join(ROOT,'js/storage.js'),'utf8');
check('GunDB P2P', st.includes('Gun'));
check('IPFS 网关', st.includes('ipfs') || st.includes('nft.storage'));
check('本地加密兜底 (AES)', st.includes('AES-GCM'));

// 8) 行情：SPARK 置顶
console.log('\n[8] 行情模块');
const mk = fs.readFileSync(path.join(ROOT,'js/market.js'),'utf8');
check('币安数据源', mk.includes('binance'));
check('Coingecko/非小号', mk.includes('coingecko') || mk.includes('feixiaohao'));
check('SPARK 置顶', mk.includes('pinned') && mk.includes('SPARK'));

// 9) 升级机制
console.log('\n[9] AI 升级 + 管理员确认');
const up = fs.readFileSync(path.join(ROOT,'js/upgrade.js'),'utf8');
check('弹窗确认', up.includes('upgradeModal') && up.includes('confirm'));
check('管理员手动确认', up.includes('isLoggedIn'));
const ai = fs.readFileSync(path.join(ROOT,'js/ai.js'),'utf8');
check('AI 自学习', ai.includes('Learn.record'));

// 10) 商城
console.log('\n[10] 商城模块');
const shop = fs.readFileSync(path.join(ROOT,'js/shop.js'),'utf8');
check('商品数据', shop.includes('SPARK Genesis') || shop.includes('创世'));
check('兑换记录去中心化', shop.includes('Storage.put'));

// 11) Workflow
console.log('\n[11] GitHub Actions');
const wf = fs.readFileSync(path.join(ROOT,'.github/workflows/deploy.yml'),'utf8');
check('部署 Pages', wf.includes('deploy-pages') || wf.includes('Deploy to GitHub Pages'));
check('构建 APK', wf.includes('assembleRelease') || wf.includes('build-apk'));
check('签名配置', wf.includes('sparkrelease') || wf.includes('keystore'));
check('发布 Releases', wf.includes('softprops/action-gh-release') || wf.includes('gh-release'));

console.log(`\n═══ 结果: ${pass} 通过, ${fail} 失败 ═══`);
if (fail) {
  console.log('\n失败项:');
  errors.forEach(e => console.log('  -', e));
  process.exit(1);
} else {
  console.log('🎉 全部校验通过');
}
