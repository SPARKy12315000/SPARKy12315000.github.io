/**
 * 撮合引擎（Matching Engine）
 * ---------------------------------------------------------------
 *  维护各交易对订单簿（买单/卖单堆）、按价格-时间优先撮合、
 *  生成成交记录、聚合 K线、计算 Ticker 24h 统计。
 * ---------------------------------------------------------------
 */
import oracle from './oracle.js';
import logger from './logger.js';

const PAIRS = ['SPARK/ETH', 'SPARK/USDT', 'SPARK/BNB'];
const FEE_RATE = 0.001; // 0.1% 交易手续费

class MatchingEngine {
  constructor() {
    this.orderBooks = {};
    this.trades = {};
    this.klines = {};
    this.tickers = {};
    for (const pair of PAIRS) {
      this.orderBooks[pair] = { bids: [], asks: [] };
      this.trades[pair] = [];
      this.klines[pair] = {};
      this.tickers[pair] = {
        pair, price: oracle.prices[pair], change24h: 0,
        high24h: 0, low24h: 0, volume24h: 0, lastUpdate: Date.now(),
      };
    }
  }

  getPairs() {
    return PAIRS.map((p) => ({ pair: p, ...this.tickers[p] }));
  }
  getTicker(pair) { return this.tickers[pair] || null; }
  getTickers() { return Object.values(this.tickers); }

  applyOraclePrices(prices) {
    for (const pair of PAIRS) {
      const t = this.tickers[pair];
      if (!t) continue;
      const old = t.price || prices[pair];
      t.price = prices[pair];
      t.change24h = old ? +(((t.price - old) / old) * 100).toFixed(4) : 0;
      t.high24h = Math.max(t.high24h || t.price, t.price);
      t.low24h = t.low24h ? Math.min(t.low24h, t.price) : t.price;
      t.lastUpdate = Date.now();
    }
  }

  getOrderBook(pair) {
    const ob = this.orderBooks[pair];
    if (!ob) return { bids: [], asks: [] };
    return {
      bids: [...ob.bids].sort((a, b) => b.price - a.price).slice(0, 20),
      asks: [...ob.asks].sort((a, b) => a.price - b.price).slice(0, 20),
    };
  }

  getDepth(pair) {
    const { bids, asks } = this.getOrderBook(pair);
    const agg = (arr, key) => {
      const map = {};
      for (const o of arr) map[o.price] = (map[o.price] || 0) + o.amount;
      return Object.entries(map).map(([p, a]) => [+p, +a.toFixed(6)]);
    };
    return { bids: agg(bids), asks: agg(asks) };
  }

  getRecentTrades(pair) { return (this.trades[pair] || []).slice(-50).reverse(); }

  getKlines(pair, interval = '1m') {
    if (!this.klines[pair][interval]) this.klines[pair][interval] = [];
    return this.klines[pair][interval];
  }

  /** 下单 + 撮合 */
  placeOrder({ pair, side, price, amount, user }) {
    if (!this.orderBooks[pair]) return { error: 'invalid pair' };
    const px = +price, amt = +amount;
    if (!(px > 0 && amt > 0)) return { error: 'invalid price/amount' };

    const trade = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      pair, side, price: px, amount: amt,
      fee: +(amt * px * FEE_RATE).toFixed(8),
      user: user || '0x_anon',
      time: Date.now(),
    };
    this.trades[pair].push(trade);
    this.tickers[pair].volume24h += amt;
    this.appendKline(pair, '1m', trade);

    // 简化撮合：与对侧队列尝试成交
    const ob = this.orderBooks[pair];
    const opposite = side === 'buy' ? ob.asks : ob.bids;
    const sortFn = side === 'buy' ? (a, b) => a.price - b.price : (a, b) => b.price - a.price;
    opposite.sort(sortFn);
    let remain = amt;
    while (remain > 0 && opposite.length && this.crosses(side, opposite[0].price, px)) {
      const o = opposite[0];
      const fill = Math.min(remain, o.amount);
      remain -= fill; o.amount -= fill;
      if (o.amount <= 0) opposite.shift();
    }
    if (remain > 0) {
      const self = side === 'buy' ? ob.bids : ob.asks;
      self.push({ price: px, amount: remain, user: trade.user, time: Date.now() });
    }

    logger.info(`trade ${pair} ${side} @${px} amt=${amt}`);
    return { ok: true, trade, remaining: remain };
  }

  crosses(side, oppPrice, myPrice) {
    return side === 'buy' ? oppPrice <= myPrice : oppPrice >= myPrice;
  }

  appendKline(pair, interval, trade) {
    const arr = (this.klines[pair][interval] ||= []);
    const bucket = Math.floor(trade.time / 60_000) * 60_000;
    let k = arr[arr.length - 1];
    if (!k || k.time !== bucket) {
      k = { time: bucket, open: trade.price, high: trade.price, low: trade.price, close: trade.price, volume: 0 };
      arr.push(k);
    }
    k.close = trade.price;
    k.high = Math.max(k.high, trade.price);
    k.low = Math.min(k.low, trade.price);
    k.volume += trade.amount;
    if (arr.length > 500) arr.shift();
  }
}

export const matchingEngine = new MatchingEngine();
export default matchingEngine;
