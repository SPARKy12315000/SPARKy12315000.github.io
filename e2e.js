/**
 * SPARK DEX · 端到端测试（自包含版）
 * ---------------------------------------------------------------
 *  直接 import server 模块（自动监听），用真实 http 环回请求所有路由，
 *  测试完成后自动退出。单次命令完成，无需后台进程。
 * ---------------------------------------------------------------
 */
import http from 'node:http';
import { setTimeout as wait } from 'node:timers/promises';
import { readFileSync, existsSync } from 'node:fs';

// 1) 动态 import server（会触发 server.listen）
const serverModulePromise = import('./server/index.js');

// 2) 等待 .port 文件出现（server 用 PORT=0 随机端口，写入 .port）
let port = null;
for (let i = 0; i < 60; i++) {
  if (existsSync('.port')) { try { port = +readFileSync('.port', 'utf8').trim(); if (port) break; } catch {} }
  await wait(100);
}
if (!port) { console.error('FAIL: server did not write .port'); process.exit(2); }

const BASE = `http://127.0.0.1:${port}`;
const get = (path) => new Promise((resolve) => {
  http.get(`${BASE}${path}`, (r) => { let b = ''; r.on('data', (c) => (b += c)); r.on('end', () => resolve({ s: r.statusCode, b })); })
    .on('error', (e) => resolve({ s: 0, b: e.message }));
});
const post = (path, data) => new Promise((resolve) => {
  const body = JSON.stringify(data);
  const req = http.request({ host: '127.0.0.1', port, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (r) => {
    let b = ''; r.on('data', (c) => (b += c)); r.on('end', () => resolve({ s: r.statusCode, b })); });
  req.on('error', (e) => resolve({ s: 0, b: e.message })); req.write(body); req.end();
});

let passed = 0, failed = 0, errors = [];
const assert = (cond, msg) => { if (cond) passed++; else { failed++; errors.push(msg); } };

const PAIR = 'SPARK/USDT';
const URL_SAFE = encodeURIComponent(PAIR);
const ADMIN = '0xD580C7C9Cde5ce776fEed844310330A2a40078d9';

const tests = [
  ['GET  /api/health', async () => { const r = await get('/api/health'); assert(r.s === 200, `200 got ${r.s}`); const j = JSON.parse(r.b); assert(j.ok === true && j.pairs >= 3, `ok+pairs(${j.pairs})`); }],
  ['GET  /api/contract (taxRate 5%)', async () => { const r = await get('/api/contract'); assert(r.s === 200, `200 got ${r.s}`); const j = JSON.parse(r.b); assert(j.address === ADMIN, 'address') || assert(j.taxRate === 0.05, 'taxRate'); }],
  ['GET  /api/pairs', async () => { const r = await get('/api/pairs'); assert(r.s === 200, `200 got ${r.s}`); const j = JSON.parse(r.b); assert(Array.isArray(j) && j.length >= 3, `len>=3 (${j.length})`); }],
  ['GET  /api/tickers', async () => { const r = await get('/api/tickers'); assert(r.s === 200, `200 got ${r.s}`); assert(Array.isArray(JSON.parse(r.b)), 'array'); }],
  ['GET  /api/ticker/SPARK%2FUSDT (含斜杠 pair ★)', async () => { const r = await get(`/api/ticker/${URL_SAFE}`); assert(r.s === 200, `200 got ${r.s} ${r.b.slice(0, 80)}`); const j = JSON.parse(r.b); assert(j.pair === PAIR, `pair=${j.pair}`); }],
  ['GET  /api/orderbook/SPARK%2FUSDT', async () => { const r = await get(`/api/orderbook/${URL_SAFE}`); assert(r.s === 200, `200 got ${r.s}`); const j = JSON.parse(r.b); assert(Array.isArray(j.bids) && Array.isArray(j.asks), 'bids+asks'); }],
  ['GET  /api/depth/SPARK%2FUSDT', async () => { const r = await get(`/api/depth/${URL_SAFE}`); assert(r.s === 200, `200 got ${r.s}`); const j = JSON.parse(r.b); assert(Array.isArray(j.bids) && Array.isArray(j.asks), 'bids+asks'); }],
  ['GET  /api/trades/SPARK%2FUSDT', async () => { const r = await get(`/api/trades/${URL_SAFE}`); assert(r.s === 200, `200 got ${r.s}`); assert(Array.isArray(JSON.parse(r.b)), 'array'); }],
  ['GET  /api/klines/SPARK%2FUSDT', async () => { const r = await get(`/api/klines/${URL_SAFE}?interval=1m`); assert(r.s === 200, `200 got ${r.s}`); assert(Array.isArray(JSON.parse(r.b)), 'array'); }],
  ['GET  /api/ticker/INVALID -> 400', async () => { const r = await get('/api/ticker/INVALID'); assert(r.s === 400, `400 got ${r.s}`); }],
  ['POST /api/order 买入', async () => { const r = await post('/api/order', { pair: PAIR, side: 'buy', price: 0.001, amount: 100, user: '0xTEST' }); assert(r.s === 200, `200 got ${r.s} ${r.b.slice(0, 100)}`); const j = JSON.parse(r.b); assert(j.ok === true && j.trade, 'ok+trade'); }],
  ['POST /api/order 卖出(撮合)', async () => { const r = await post('/api/order', { pair: PAIR, side: 'sell', price: 0.0009, amount: 50, user: '0xTEST2' }); assert(r.s === 200, `200 got ${r.s}`); }],
  ['POST /api/order 非法pair -> 400', async () => { const r = await post('/api/order', { pair: 'BAD', side: 'buy', price: 1, amount: 1 }); assert(r.s === 400, `400 got ${r.s}`); }],
  ['POST /api/upgrade/propose', async () => { const r = await post('/api/upgrade/propose', { version: '1.2.0', changelog: 'e2e', proposer: 'admin' }); assert(r.s === 200, `200 got ${r.s}`); }],
  ['POST /api/upgrade/approve (多签+执行)', async () => { const p = await post('/api/upgrade/propose', { version: '1.3.0', changelog: 'exec', proposer: 'admin' }); const pj = JSON.parse(p.b); const a = await post(`/api/upgrade/approve/${pj.id}`, { approver: ADMIN }); assert(a.s === 200, `200 got ${a.s} ${a.b.slice(0, 100)}`); const aj = JSON.parse(a.b); assert(aj.status === 'approved' || aj.status === 'executed', `status=${aj.status}`); }],
  ['GET  /api/upgrade/proposals', async () => { const r = await get('/api/upgrade/proposals'); assert(r.s === 200, `200 got ${r.s}`); assert(Array.isArray(JSON.parse(r.b)), 'array'); }],
  ['POST /api/admin/persist (admin)', async () => { const r = await post('/api/admin/persist', { admin: ADMIN }); assert(r.s === 200, `200 got ${r.s}`); }],
];

(async () => {
  // 等待 server 模块加载完成
  await serverModulePromise;
  console.log(`\n🚀 SPARK DEX E2E · ${BASE}\n`);
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  ✓ ${name}`); } catch (e) { failed++; errors.push(`${name}: ${e.message}`); console.log(`  ✗ ${name}`); }
  }
  console.log(`\n─────────────────────────────`);
  console.log(`通过: ${passed}   失败: ${failed}`);
  if (errors.length) { console.log('\n失败明细:'); errors.forEach((e) => console.log('  • ' + e)); }
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
