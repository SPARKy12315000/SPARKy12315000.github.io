// scripts/dom-smoke.mjs —— jsdom 端到端测试
// 说明：jsdom 不自动执行 <script type="module">，故手动提取内联代码，在 window 全局作用域 eval，
// 这是目前最贴近真实浏览器的可行方式（same-origin + 真实 DOM）。
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const g = globalThis;
const html = readFileSync(join(__dirname, '..', 'dist', 'index.html'), 'utf8');

const dom = new JSDOM(html, { url: 'https://sparky12315000.github.io/?lang=en', pretendToBeVisual: true });
const { window } = dom;

// 准备浏览器全局（jsdom 的 crypto/navigator 配置，均用 defineProperty 防御 getter）
const def = (obj, key, val) => { try { Object.defineProperty(obj, key, { value: val, configurable: true, writable: true }); } catch { try { obj[key] = val; } catch {} } };

def(window.navigator, 'language', 'en-US');
def(window, 'crypto', { subtle: { digest: async () => new Uint8Array(32).buffer } });
def(window, 'fetch', async () => ({ ok: true, json: async () => [], text: async () => '' }));

// localStorage：jsdom 默认提供，若无则提供内存版
let storage;
try { storage = window.localStorage; } catch {}
if (!storage) {
  const s = {}; storage = { getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: (k) => { delete s[k]; } };
  def(window, 'localStorage', storage);
}

// 补齐 jsdom 全局（内联代码以「严格模式 + 全局引用」运行，需 window 上的 location/URLSearchParams 等）
def(window, 'location', { href: 'https://sparky12315000.github.io/?lang=en', search: '?lang=en', pathname: '/' });
def(g, 'location', window.location);
def(g, 'URLSearchParams', window.URLSearchParams);
def(window, 'navigator', window.navigator);

// jsdom 无 IndexedDB：注入极简内存垫片（keyValue 存储，满足 Shop/Chat 的 put/getAll）
// 所有 store 方法均返回 IDBRequest 形态（{result, onsuccess}），并在微任务触发 onsuccess，
// 使 DStorage.put/all 的 `req.onsuccess = ...` + `req.result` 逻辑正常工作。
const idbStores = {};
function idbRequest(initial) {
  const r = { onsuccess: null, onerror: null, result: initial };
  Promise.resolve().then(() => r.onsuccess?.(null));
  return r;
}
function makeStore(name) {
  idbStores[name] = idbStores[name] || {};
  const store = {
    put: (record) => { idbStores[name][record.id] = record; return idbRequest(record); },
    add: (record) => { idbStores[name][record.id] = record; return idbRequest(record); },
    get: (id) => idbRequest(idbStores[name][id] || null),
    getAll: () => idbRequest(Object.values(idbStores[name])),
    delete: (id) => { delete idbStores[name][id]; return idbRequest(undefined); },
  };
  // 每次操作后触发所属事务的 oncomplete（模拟 IDB 事务自动提交）
  for (const k of ['put', 'add', 'delete']) {
    const orig = store[k];
    store[k] = (...a) => { const r = orig(...a); Promise.resolve().then(() => store._tx?.oncomplete?.()); return r; };
  }
  return store;
}
function makeTx(storeName) {
  const store = makeStore(storeName);
  const tx = { objectStore: () => store, oncomplete: null, onerror: null };
  store._tx = tx;
  return tx;
}
function makeDB() {
  return {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => ({}),
    transaction: (storeName) => makeTx(storeName),
  };
}
function idbOpen() {
  const r = { onsuccess: null, onerror: null, result: makeDB() };
  Promise.resolve().then(() => r.onsuccess?.(null));
  return r;
}
def(g, 'indexedDB', { open: idbOpen, deleteDatabase: () => ({}) });

// 提取内联脚本（产物中唯一带 "class App" 的 script 块）
const doc = window.document;
const inline = [...doc.querySelectorAll('script[type="module"]')]
  .map((s) => s.textContent).filter((t) => /class App/.test(t))[0];

if (!inline) { console.error('❌ 未找到内联 App 脚本'); process.exit(1); }

// 在 window 作用域执行（window 作为全局对象）
let ls;
try { ls = window.localStorage; } catch { ls = storage; }
// 用异步函数包裹：内联代码含函数级 `await`（动态 import 等），需 async 作用域
const exec = new window.Function(
  'window', 'document', 'localStorage', 'crypto', 'fetch',
  '"use strict";' + inline + '\n;return (window.__SPARK__ || window.App);'
);
const app = await exec(window, doc, ls, window.crypto, window.fetch);

const results = [];
const check = (n, c) => results.push([n, !!c]);

// 模拟启动
await app.boot();
await new Promise((r) => setTimeout(r, 100));

check('App 已实例化', app instanceof Object);
check('title 翻译为英文 (SPARK Token)', /SPARK Token/.test(doc.title));
check('页面 lang=en', doc.documentElement.lang === 'en');
check('中文 slogan 已翻译', !doc.querySelector('[data-i18n="hero.slogan"]').textContent.includes('星火流转'));
check('英文 slogan (Flow)', /flow|sparks/i.test(doc.querySelector('[data-i18n="hero.slogan"]').textContent));
check('语言切换器 5 个选项', doc.querySelector('[data-i18n-switch]').options.length === 5);
check('税率 5% 5% 0% 齐全', ['5%', '5%', '0%'].every((t) => doc.body.textContent.includes(t)));
check('合约地址在位', doc.body.textContent.toLowerCase().includes('0xd580c7c9cde5ce776feed844310330a2a40078d9'));
check('Logo base64 已注入', doc.querySelector('img.logo').src.startsWith('data:image'));
check('背景图 base64 已注入', doc.querySelector('img[data-bg]').src.startsWith('data:image'));
check('IPFS Logo CID 在位', doc.body.textContent.includes('bafkreig7xhotcsvptfcf7ipogm6wr3u3xikmfxaktcmw5xzzgvqu6xednm'));
check('IPFS 背景 CID 在位', doc.body.textContent.includes('bafybeigtk7dpdzwtscb2pn2eovqbnwvmnhnrdrbmzebwahxc4tzy2vnbqu'));
check('官网链接 eth.limo', doc.body.textContent.includes('sparktoken.eth.limo'));
check('邮箱在位', doc.body.textContent.includes('SPARKTOKEN@TUTAMAIL.COM'));
check('营销钱包默认占位=合约地址', app.admin.getMarketingWallet().toLowerCase() === '0xd580c7c9cde5ce776feed844310330a2a40078d9');

// 余额限制（问题8）：余额为 2，提币/认领 5 应被拒绝（claimAirdrop 场景）
let balanceError = null;
try {
  await app.admin.claimAirdrop({ userAddress: '0xabc', balance: 2, requested: 5 });
  check('余额不足禁止超额交易', false);
} catch (e) {
  balanceError = e;
  check('余额不足禁止超额交易', /余额不足|限制交易/i.test(e.message));
}
// 余额充足（5 >= 5）应成功
try {
  const ok = await app.admin.claimAirdrop({ userAddress: '0xabc', balance: 10, requested: 5 });
  check('余额充足可正常认领', ok && ok.ok === true && ok.net === 5 - 0.001);
} catch (e) {
  check('余额充足可正常认领', false);
}

// AI 自检升级
const proposal = await app.ai.scan();
check('AI 扫描产出提案', Array.isArray(proposal.findings));
check('提案需管理员授权', proposal.requiresAdmin === true);
check('autoApply=false（安全边界）', proposal.autoApply === false);
check('提案含升级动作', Array.isArray(proposal.actions));

// 管理员登录 + 授权
try { await app.admin.login('spark2024'); } catch {}
const applied = app.ai.apply('admin-token');
check('管理员授权后 apply 返回合法结构', applied && typeof applied === 'object' && 'ok' in applied);

let pass = 0;
for (const [n, r] of results) { console.log(`   ${r ? '✅' : '❌'} ${n}`); if (r) pass++; }
console.log(`\n[DOM smoke] ${pass}/${results.length} 通过`);
process.exit(pass === results.length ? 0 : 1);
