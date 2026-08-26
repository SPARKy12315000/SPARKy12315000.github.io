const fs = require('fs');
const { execSync } = require('child_process');

// 1. 提取 index.html 中的 JS
const html = fs.readFileSync('index.html', 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.log('❌ 未找到 <script>'); process.exit(1); }
const js = m[1];

// 2. 保存临时文件
fs.writeFileSync('_app.js', js);
try {
  execSync('node --check _app.js', { stdio: 'inherit' });
  console.log('✅ JS 语法校验通过');
} catch (e) {
  console.log('❌ JS 语法错误（见上）');
  process.exit(1);
}

// 3. 检查基本结构完整性
const checks = [
  ['Wallet.detect', /Wallet\.detect\s*\(/],
  ['Wallet.connect', /Wallet\.connect\s*\(/],
  ['Airdrop.claim', /Airdrop\.claim\s*\(/],
  ['Chat.send', /Chat\.send\s*\(/],
  ['Market.refresh', /Market\.refresh\s*\(/],
  ['SPARKShop.publish', /SPARKShop\.publish\s*\(/],
  ['Video.play', /Video\.play\s*\(/],
  ['AI.send', /AI\.send\s*\(/],
  ['Admin.login', /Admin\.login\s*\(/],
  ['Admin.confirmUpgrade', /Admin\.confirmUpgrade\s*\(/],
  ['SPARKStorage.put', /SPARKStorage\.put\s*\(/],
  ['GunDB relays', /RELAYS\s*:/],
  ['GeckoTerminal', /geckoterminal/i],
  ['Contract address', /0xD580C7C9Cde5ce776fEed844310330A2a40078d9/],
  ['Admin password hint', /Yy12315000/],
];
let ok = 0;
for (const [name, re] of checks) {
  if (re.test(js)) { console.log('  ✅', name); ok++; }
  else { console.log('  ❌', name, '— 缺失'); }
}
console.log(`\n${ok}/${checks.length} 模块检查通过`);

// 4. JSON 文件校验
for (const f of ['manifest.json', 'version.json']) {
  try { JSON.parse(fs.readFileSync(f, 'utf8')); console.log('✅', f); }
  catch (e) { console.log('❌', f, e.message); }
}

// 5. Solidity 合约（如有 solc）
if (fs.existsSync('contracts/SPARKToken.sol')) {
  console.log('✅ 合约文件存在');
}
