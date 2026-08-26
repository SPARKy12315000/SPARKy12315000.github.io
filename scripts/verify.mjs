#!/usr/bin/env node
/**
 * 运行时验证：mock 浏览器 API，逐个跑通各模块核心逻辑，确认无运行时错误。
 * 转换逻辑与 build.mjs 完全一致：保留声明 + 末尾统一挂载 window。
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');

// ===== Mock 浏览器全局 =====
const store = {};
const localStorageMock = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  key: i => Object.keys(store)[i],
  get length() { return Object.keys(store).length; },
};
async function ethRequest({ method }) {
  if (method === 'eth_requestAccounts' || method === 'eth_accounts') return ['0xAAA0000000000000000000000000000000000001'];
  if (method === 'eth_chainId') return '0x1';
  return null;
}
const ethereumMock = { isMetaMask: true, request: ethRequest, on: () => {} };
const noop = () => {};
const domEl = { click: noop, style: {}, setAttribute: noop, addEventListener: noop };

const sandbox = {
  console, setTimeout, clearInterval: noop, Date, Math, JSON, Array, Object, String, Number, BigInt, RegExp,
  encodeURIComponent, atob: b => Buffer.from(b, 'base64').toString(), btoa: s => Buffer.from(s).toString('base64'),
  localStorage: localStorageMock,
  navigator: { userAgent: 'Mozilla/5.0 (test)' },
  location: { href: 'https://sparky12315000.github.io/' },
  window: {
    addEventListener: noop, removeEventListener: noop,
    ethereum: ethereumMock, localStorage: localStorageMock, navigator: { userAgent: 'test' },
  },
  document: {
    documentElement: { lang: 'zh-CN' },
    createElement: () => domEl, getElementById: () => null, querySelectorAll: () => [],
    addEventListener: noop,
  },
  fetch: async () => ({ ok: true, text: async () => '', json: async () => ({ data: [] }) }),
  AbortController: class { abort() {} signal = {} },
  BroadcastChannel: class { addEventListener = noop; postMessage = noop },
  URL: { createObjectURL: () => 'blob:x' },
  alert: () => {},
};
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);

// ===== 与 build.mjs 一致的转换 =====
function transform(code) {
  code = code
    .replace(/^import\s*\{[^}]*\}\s*from\s*['"][^'"]+['"]\s*;?$/gm, '')
    .replace(/^export\s*\{[^}]*\}\s*;?$/gm, '')
    .replace(/^export\s+(default\s+)?/gm, '$1');
  const declNames = [];
  code = code.replace(/^(?:class|function|async\s+function)\s+(\w+)/gm, (_, n) => { declNames.push(n); return _; });
  code = code.replace(/^const\s+(\w+)\s*=/gm, (_, n) => { declNames.push(n); return _; });
  code += '\n' + declNames.map(n => `window.${n} = ${n};`).join('\n');
  return code;
}

const files = ['config', 'wallet', 'storage', 'chat', 'market', 'shop', 'video', 'ai', 'admin', 'github', 'app'];
let combined = '';
for (const f of files) combined += '\n' + transform(readFileSync(join(SRC, `${f}.js`), 'utf8'));
vm.runInContext(combined, sandbox, { filename: 'combined.js' });

const { CONFIG, wallet, admin, marketplace, Chat, VideoRewards, UpgradeAgent, GitHubDeploy, App, TRANSLATIONS } = sandbox.window;

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.error(`  ❌ ${name}`); } };

(async () => {
  console.log('\n🔑 问题1：钱包（兼容任意 EIP-1193）');
  const providers = wallet.detect();
  ok('自动发现钱包', providers.length >= 1);
  ok('识别 MetaMask', providers.some(p => p.id === 'metamask'));
  const addr = await wallet.connect('metamask');
  ok('连接成功并返回地址', /^0x/.test(addr));
  ok('登录态持久化', wallet.isConnected());

  console.log('\n🛒 问题2：商城 C2C');
  const g = await marketplace.listGoods({ title: '测试闲置手机', priceSPARK: '100', category: 'other' });
  ok('用户可上架商品', g && g.seller === addr);
  const orderErr = await marketplace.createOrder(g.id).catch(e => e.message);
  ok('禁止自己买自己（防刷）', orderErr === 'CANNOT_BUY_OWN');

  console.log('\n💬 问题3：聊天签名同步');
  const chat = new Chat();
  const sent = await chat.send('hello').catch(e => e.message);
  ok('已连接钱包可发送', sent && sent.from === addr);
  const list = await chat.store.all();
  ok('消息入存储', Array.isArray(list));

  console.log('\n📺 问题4：短剧奖励');
  const v = new VideoRewards();
  const rec = await v.completeWatch('f1', 60);
  ok('完整观看得奖励', rec && rec.reward === '10');
  const rec2 = await v.completeWatch('f2', 5).catch(e => e.message);
  ok('时长不足不奖励', rec2 === 'TOO_SHORT');

  console.log('\n📈 问题6：行情（GeckoTerminal 优先 + CoinGecko 回退 + 本地兜底）');
  const marketMod = await import(join(SRC, 'market.js'));
  const { getMarketList, getSPARKStats } = marketMod;
  const spark = await getSPARKStats();
  ok('SPARK 统计可用', spark && 'price' in spark);
  // mock fetch 让其走 fallback（沙盒无外网），验证容灾与 SPARK 置顶
  sandbox.fetch = async () => { throw new Error('network blocked'); };
  const marketResult = await getMarketList();
  ok('返回结构含 list + source', Array.isArray(marketResult.list) && marketResult.source);
  ok('SPARK 强制第一位（rank=1）', marketResult.list[0]?.rank === 1 && marketResult.list[0]?.isSPARK === true);
  ok('列表长度 ≤ 100', marketResult.list.length <= 100 + 1);

  console.log('\n🤖 问题7：AI 自检（不自动执行）');
  const up = new UpgradeAgent();
  const sources = {}; files.forEach(f => sources[`src/${f}.js`] = readFileSync(join(SRC, `${f}.js`), 'utf8'));
  const proposal = up.propose(sources);
  ok('生成升级提案', proposal && Array.isArray(proposal.findings));
  ok('提案未自动应用（需管理员确认）', proposal.status !== 'approved');

  console.log('\n🔐 问题8：管理员 + 营销钱包 + 余额限制');
  const loginRes = await admin.login('spark2024').catch(e => e.message);
  ok('管理员密码校验通过', loginRes === true);
  // 模拟用户余额 = 2，尝试提 5 → 应被限制
  localStorageMock.setItem(`spark_bal_${addr}`, '2');
  const balCheck = admin.checkWithdraw(addr, 5);
  ok('余额2提5 → 限制交易', balCheck.allowed === false);
  const mw = admin.generateMarketingWallet();
  ok('营销钱包生成', /^0x/.test(mw));

  console.log('\n🌐 问题9：保留资源');
  ok('邮箱保留', CONFIG.email === 'SPARKTOKEN@TUTAMAIL.COM');
  ok('官网2/3/4 保留', CONFIG.officialSites.length >= 4);
  ok('Logo CID 保留', CONFIG.ipfs.logoCID.includes('bafkreig7xhot'));
  ok('背景 CID 保留', CONFIG.ipfs.bgCID.includes('bafybeigtk7'));
  ok('税率 5/5/0', CONFIG.tax.buy === 5 && CONFIG.tax.sell === 5 && CONFIG.tax.transfer === 0);
  ok('合约地址正确', CONFIG.contractAddress.toLowerCase() === '0xd580c7c9cde5ce776feed844310330a2a40078d9');
  ok('双语字典完整', Object.keys(TRANSLATIONS.zh).length > 10 && Object.keys(TRANSLATIONS.en).length > 10);

  console.log('\n🚀 问题7：GitHub 部署通道');
  const gh = new GitHubDeploy('ghp_test');
  ok('PAT 设置', gh.pat === 'ghp_test');

  console.log(`\n==== 结果: ${pass} 通过, ${fail} 失败 ====`);
  process.exit(fail ? 1 : 0);
})();
