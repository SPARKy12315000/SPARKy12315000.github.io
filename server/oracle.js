/**
 * 价格预言机（Oracle）
 * ---------------------------------------------------------------
 *  模拟多数据源聚合价格（链上可替换为 Chainlink / Uniswap TWAP）。
 *  每 tick 对基准价做随机游走，产出各交易对中间价。
 * ---------------------------------------------------------------
 */
import logger from './logger.js';

const BASES = {
  'SPARK/ETH': 0.00042,
  'SPARK/USDT': 0.85,
  'SPARK/BNB': 0.0021,
};

class PriceOracle {
  constructor() {
    this.prices = { ...BASES };
    this.sources = ['chainlink', 'uniswap', 'binance'];
  }

  tick() {
    for (const [pair, base] of Object.entries(BASES)) {
      // 随机游走 ±1.2%
      const drift = 1 + (Math.random() - 0.5) * 0.024;
      this.prices[pair] = +(this.prices[pair] * drift).toFixed(8);
    }
    return this.prices;
  }

  /** 聚合报价（多源中位数） */
  aggregate(pair) {
    const base = this.prices[pair];
    if (!base) return null;
    const feeds = this.sources.map((s) => base * (1 + (Math.random() - 0.5) * 0.004));
    feeds.sort((a, b) => a - b);
    return +feeds[Math.floor(feeds.length / 2)].toFixed(8);
  }
}

export const oracle = new PriceOracle();
export default oracle;
