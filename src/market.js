/**
 * 行情模块（问题6）
 * 数据源（多层容灾，自动降级）：
 *   1) GeckoTerminal（优先，免费，无需 Key）—— /networks/{n}/tokens?sort=h24_volume_usd_desc
 *   2) CoinGecko（回退）—— /coins/markets?order=market_cap_desc
 *   3) 本地兜底（all 源不可达时，保证页面不空白）
 * 规则：取前 100，SPARK 强制排到第一位（问题6 明确要求）。
 *
 * ⚠️ 若所有外部源 403/超时，前端会显示"数据源不可用"并展示本地占位，
 *    部署到公网后 GeckoTerminal/CoinGecko 通常可正常访问（403 多为沙盒/IP 限制）。
 */
import { CONFIG } from './config.js';

const { apiBase, network, topN } = CONFIG.market;
const CG = 'https://api.coingecko.com/api/v3';

async function getJSON(url, timeout = 10000, headers = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store', headers });
    clearTimeout(t);
    if (!res.ok) throw new Error('HTTP_' + res.status);
    return await res.json();
  } catch (e) { clearTimeout(t); throw e; }
}

// ---------- GeckoTerminal ----------
async function fetchGeckoTherminal() {
  const pages = Math.ceil(topN / 50);
  const all = [];
  for (let p = 1; p <= pages && all.length < topN; p++) {
    const url = `${apiBase}/networks/${network}/tokens?sort=h24_volume_usd_desc&page=${p}&per_page=50`;
    const json = await getJSON(url);
    const items = (json.data || []).map(normalizeGT).filter(Boolean);
    all.push(...items);
  }
  return all.slice(0, topN);
}
function normalizeGT(t) {
  const a = t.attributes || {};
  return {
    rank: a.market_cap_rank || 0, name: a.name, symbol: a.symbol,
    address: (t.id || '').split('_').pop(),
    price: num(a.price_usd), change24h: num(a.price_change_percentage_h24),
    marketCap: num(a.market_cap_usd), volume24h: num(a.volume_usd_h24),
  };
}

// ---------- CoinGecko 回退 ----------
async function fetchCoinGecko() {
  const json = await getJSON(`${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${topN}&page=1&sparkline=false`);
  return json.map((c, i) => ({
    rank: c.market_cap_rank || i + 1, name: c.name, symbol: c.symbol?.toUpperCase(),
    address: '', price: num(c.current_price), change24h: num(c.price_change_percentage_24h),
    marketCap: num(c.market_cap), volume24h: num(c.total_volume),
  }));
}

// ---------- 本地兜底 ----------
function fallbackList() {
  const names = ['Bitcoin','Ethereum','Tether','BNB','Solana','USDC','XRP','Dogecoin','Cardano','Avalanche'];
  return names.slice(0, topN).map((n, i) => ({
    rank: i + 2, name: n, symbol: n.slice(0, 3).toUpperCase(), address: '',
    price: Math.random() * 1000, change24h: (Math.random() - 0.5) * 10,
    marketCap: (100 - i) * 1e9, volume24h: (10 - i) * 1e8,
  }));
}

function num(v) { const n = Number(v); return isFinite(n) ? n : null; }

/** 拉取 SPARK 自身行情（GeckoTerminal，失败则给占位） */
async function fetchSPARK() {
  try {
    const url = `${apiBase}/networks/eth/tokens/${CONFIG.contractAddress.toLowerCase()}`;
    const json = await getJSON(url, 8000);
    const a = json.data?.attributes || {};
    return makeSPARK(num(a.price_usd), num(a.price_change_percentage_h24), num(a.market_cap_usd), num(a.volume_usd_h24));
  } catch {
    // 兜底：价格未知但结构保留，前端显示为 "--"
    return makeSPARK(null, 0, null, null);
  }
}
function makeSPARK(price, change24h, marketCap, volume24h) {
  return { rank: 1, name: CONFIG.name, symbol: CONFIG.symbol, address: CONFIG.contractAddress, isSPARK: true,
    price, change24h, marketCap, volume24h };
}

/** 对外：返回 [SPARK, ...前99]，自动容灾 */
export async function getMarketList() {
  let tokens = [];
  let source = 'unknown';
  try { tokens = await fetchGeckoTherminal(); source = 'GeckoTerminal'; }
  catch { try { tokens = await fetchCoinGecko(); source = 'CoinGecko'; } catch { tokens = fallbackList(); source = 'fallback'; } }
  const spark = await fetchSPARK();
  const list = [spark];
  const seen = new Set([CONFIG.contractAddress.toLowerCase()]);
  for (const t of tokens) {
    if (list.length >= topN) break;
    if (t.address && seen.has(t.address.toLowerCase())) continue;
    if (t.symbol === CONFIG.symbol) continue; // 去重 SPARK
    list.push(t); seen.add((t.address || t.symbol).toLowerCase());
  }
  list.forEach((t, i) => { if (!t.rank) t.rank = i + 1; });
  return { list, source }; // 返回数据源标识，前端展示
}

export async function getSPARKStats() {
  const spark = await fetchSPARK();
  return { price: spark.price ?? 0, marketCap: spark.marketCap ?? 0, change24h: spark.change24h ?? 0 };
}
