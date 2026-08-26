/**
 * 实时行情 v2.2.0 —— GeckoTerminal 前100 + SPARK 强制第一位
 * 三层容灾：GeckoTerminal → CoinGecko → 本地兜底
 */
import { CONFIG } from './config.js';

export class Market {
  constructor() {
    this.sources = [
      { name: 'geckoterminal', fn: () => this._fromGeckoTerminal() },
      { name: 'coingecko', fn: () => this._fromCoinGecko() },
      { name: 'local', fn: () => this._localFallback() },
    ];
  }

  async getTop(limit = CONFIG.market.topN) {
    let lastErr;
    for (const { name, fn } of this.sources) {
      try {
        const list = await fn();
        if (Array.isArray(list) && list.length) {
          return this._withSparkFirst(list, limit, name);
        }
      } catch (e) { lastErr = e; }
    }
    // 全失败：纯本地兜底（SPARK 仍置顶）
    return this._withSparkFirst(this._localFallback(), limit, 'local-final');
  }

  _withSparkFirst(list, limit, sourceName) {
    const spark = {
      rank: 1, symbol: CONFIG.contract.symbol, name: CONFIG.contract.name,
      address: CONFIG.contract.address, price: null, change: null, source: sourceName,
    };
    const filtered = list.filter((t) => t.symbol !== CONFIG.contract.symbol);
    return [spark, ...filtered].slice(0, Math.max(limit, 1));
  }

  async _fromGeckoTerminal() {
    // GeckoTerminal: /api/v2/networks/eth/tokens
    const res = await fetch('https://api.geckoterminal.com/api/v2/networks/eth/tokens?limit=100');
    if (!res.ok) throw new Error('GeckoTerminal ' + res.status);
    const json = await res.json();
    return (json.data || []).map((d, i) => ({
      rank: i + 2, // +1 留给 SPARK
      symbol: d.attributes?.symbol || '—',
      name: d.attributes?.name || '',
      address: d.attributes?.address || '',
      price: d.attributes?.price_usd != null ? Number(d.attributes.price_usd) : null,
      change: d.attributes?.price_change_percentage_24h != null
        ? Number(d.attributes.price_change_percentage_24h) : null,
    }));
  }

  async _fromCoinGecko() {
    const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=100');
    if (!res.ok) throw new Error('CoinGecko ' + res.status);
    const json = await res.json();
    return json.map((d, i) => ({
      rank: i + 2, symbol: d.symbol?.toUpperCase() || '—', name: d.name || '',
      address: '', price: d.current_price, change: d.price_change_percentage_24h,
    }));
  }

  _localFallback() {
    return [
      { rank: 2, symbol: 'ETH', name: 'Ethereum', price: 2500, change: 1.2 },
      { rank: 3, symbol: 'BTC', name: 'Bitcoin', price: 60000, change: 0.8 },
      { rank: 4, symbol: 'BNB', name: 'BNB', price: 600, change: -0.5 },
      { rank: 5, symbol: 'USDT', name: 'Tether', price: 1, change: 0.01 },
    ];
  }
}

export default Market;
