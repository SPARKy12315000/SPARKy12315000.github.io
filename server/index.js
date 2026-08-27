/**
 * SPARK DEX · 后端服务主入口
 * ---------------------------------------------------------------
 *  模块化架构：日志 / 去中心化存储（自动修复）/ 价格预言机 /
 *  撮合引擎 / 治理升级管理器
 *  接口：REST（行情 / 订单簿 / 下单 / 交易对 / 合约元信息 / 健康检查）
 *        WebSocket /ws（实时推送）
 *  自动维护：价格更新 + 存储修复（周期任务）
 * ---------------------------------------------------------------
 */
import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';

import logger from './logger.js';
import { store, STORAGE_FILE } from './storage.js';
import { oracle } from './oracle.js';
import { matchingEngine } from './engine.js';
import { upgradeManager } from './upgrade.js';
import { normalize, isValid } from './pair.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const CONTRACT = '0xD580C7C9Cde5ce776fEed844310330A2a40078d9';

/* ================= 健康检查 ================= */
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'spark-dex',
    version: upgradeManager.currentVersion,
    time: Date.now(),
    pairs: matchingEngine.getPairs().length,
  });
});

/* ================= 合约元信息 ================= */
app.get('/api/contract', (req, res) => {
  res.json({
    address: CONTRACT,
    symbol: 'SPARK',
    name: '星火通证 SPARK',
    network: 'ethereum',
    taxRate: 0.05, // 5% 营销回流
    decimals: 18,
  });
});

/* ================= 交易对 ================= */
app.get('/api/pairs', (req, res) => {
  res.json(matchingEngine.getPairs());
});

/* ================= 行情 Tickers ================= */
app.get('/api/tickers', (req, res) => {
  res.json(matchingEngine.getTickers());
});

app.get('/api/ticker/*', (req, res) => {
  const pair = normalize(req.params[0]);
  if (!isValid(pair)) return res.status(400).json({ error: 'invalid pair, expect BASE/QUOTE' });
  const t = matchingEngine.getTicker(pair);
  if (!t) return res.status(404).json({ error: 'pair not found' });
  res.json(t);
});

/* ================= K线 ================= */
app.get('/api/klines/*', (req, res) => {
  const pair = normalize(req.params[0]);
  const interval = req.query.interval || '1m';
  res.json(matchingEngine.getKlines(pair, interval));
});

/* ================= 订单簿 ================= */
app.get('/api/orderbook/*', (req, res) => {
  const pair = normalize(req.params[0]);
  res.json(matchingEngine.getOrderBook(pair));
});

/* ================= 深度 ================= */
app.get('/api/depth/*', (req, res) => {
  const pair = normalize(req.params[0]);
  res.json(matchingEngine.getDepth(pair));
});

/* ================= 最新成交 ================= */
app.get('/api/trades/*', (req, res) => {
  const pair = normalize(req.params[0]);
  res.json(matchingEngine.getRecentTrades(pair));
});

/* ================= 下单 ================= */
app.post('/api/order', (req, res) => {
  const { pair: rawPair, side, price, amount, user } = req.body || {};
  const pair = normalize(rawPair);
  if (!isValid(pair) || !side || !price || !amount) {
    return res.status(400).json({ error: 'missing or invalid fields (pair must be BASE/QUOTE)' });
  }
  const result = matchingEngine.placeOrder({ pair, side, price, amount, user });
  if (result.error) return res.status(400).json(result);
  broadcast({ type: 'orderbook', pair, data: matchingEngine.getOrderBook(pair) });
  broadcast({ type: 'trade', pair, data: result.trade });
  res.json(result);
});

/* ================= 治理：升级提案 ================= */
app.get('/api/upgrade/proposals', (req, res) => {
  res.json(upgradeManager.list());
});
app.post('/api/upgrade/propose', (req, res) => {
  const { version, changelog, proposer } = req.body || {};
  const p = upgradeManager.propose({ version, changelog, proposer });
  res.json(p);
});
app.post('/api/upgrade/approve/:id', (req, res) => {
  const { approver } = req.body || {};
  const r = upgradeManager.approve(req.params.id, approver);
  if (r.error) return res.status(400).json(r);
  // 管理员授权确认 + 自动部署
  if (r.status === 'approved') {
    upgradeManager.execute(req.params.id);
    broadcast({ type: 'upgrade', data: upgradeManager.currentVersion });
  }
  res.json(r);
});

/* ================= 持久化（管理员确认后写入） ================= */
app.post('/api/admin/persist', (req, res) => {
  const { admin } = req.body || {};
  if (!upgradeManager.isAdmin(admin)) {
    return res.status(403).json({ error: 'forbidden: admin only' });
  }
  store.flush();
  res.json({ ok: true, file: STORAGE_FILE });
});

/* ================= WebSocket ================= */
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
function broadcast(msg) {
  const payload = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(payload);
  }
}
wss.on('connection', (ws) => {
  logger.info('ws connected');
  ws.send(JSON.stringify({ type: 'hello', version: upgradeManager.currentVersion }));
});

/* ================= 自动维护（周期任务） ================= */
// 价格预言机更新
setInterval(() => {
  oracle.tick();
  matchingEngine.applyOraclePrices(oracle.prices);
  broadcast({ type: 'tickers', data: matchingEngine.getTickers() });
}, 5000);
// 去中心化存储自动修复 + 快照
setInterval(() => {
  if (store.repair()) logger.info('storage auto-repaired');
  store.snapshot();
}, 30_000);

/* ================= 启动 ================= */
import { writeFileSync } from 'node:fs';
server.listen(PORT, () => {
  const realPort = server.address().port;
  logger.info(`spark_exchange_started port=${realPort}`);
  logger.info(`contract=${CONTRACT}`);
  // 若使用随机端口（PORT=0），将实际端口写入 .port 供探测脚本读取
  if (String(PORT) === '0') writeFileSync('.port', String(realPort));
  // 初始种子数据
  oracle.tick();
  matchingEngine.applyOraclePrices(oracle.prices);
});

export { app, server, broadcast };
