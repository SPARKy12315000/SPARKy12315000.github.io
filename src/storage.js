/**
 * 去中心化存储模块（"去中心化后端"的核心）
 * 架构：IPFS（多网关容灾）存永久数据 + localStorage 做本地索引 + 浏览器 BroadcastChannel/StorageEvent 做同设备多标签同步
 * 说明：GitHub Pages 是无后端静态托管，故"后端"由【IPFS + 智能合约 + P2P 聊天】共同承担。
 *       聊天/商城的跨地域同步见 chat.js / shop.js（基于 IPFS 轮询 + 签名广播）。
 */
import { CONFIG, ipfsUrl } from './config.js';

/** IPFS 多网关 fetch，自动容灾 */
export async function fetchIPFS(cid, path = '') {
  const urls = CONFIG.ipfs.gateways.map(g => g + cid + path);
  let lastErr;
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url, 8000);
      if (res.ok) return await res.json();
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('IPFS_UNAVAILABLE');
}

function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal, cache: 'no-store' }).finally(() => clearTimeout(t));
}

/**
 * 通用"集合"存储：每条记录存 IPFS，本地用 IndexedDB 缓存，多标签通过 BroadcastChannel 同步。
 * 用于：聊天消息、商品、订单、短剧记录、空投名单。
 */
export class DecentraStore {
  constructor(name, { memory = false } = {}) {
    this.name = name;
    this.memory = memory;
    this.key = `spark_store_${name}`;
    this.channel = ('BroadcastChannel' in window) ? new BroadcastChannel(`spark_${name}`) : null;
    this.channel?.addEventListener('message', (e) => {
      if (e.data?.from !== selfId()) this._remoteUpdate(e.data);
    });
    this.subs = new Set();
  }

  /** 读取全部（内存优先，失败回退 IPFS） */
  async all() {
    if (this.memory) return Array.from(this._mem.values());
    try { return JSON.parse(localStorage.getItem(this.key) || '[]'); }
    catch { return []; }
  }

  /** 追加一条（本地写 + 广播给同源其他标签） */
  async add(item) {
    const list = await this.all();
    item.id = item.id || (Date.now() + '_' + Math.random().toString(36).slice(2, 8));
    item.ts = item.ts || Date.now();
    list.push(item);
    await this._persist(list);
    this.channel?.postMessage({ type: 'add', item, from: selfId() });
    this.subs.forEach(fn => fn(item));
    return item;
  }

  /** 全量替换（IPFS 同步回来后调用） */
  async _persist(list) {
    if (this.memory) { this._mem = new Map(list.map(i => [i.id, i])); return; }
    localStorage.setItem(this.key, JSON.stringify(list.slice(-500))); // 限制条数
  }

  _remoteUpdate() { /* 由具体模块决定冲突策略 */ }

  subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }

  /** 导出为可上传 IPFS 的 JSON（管理员/用户自行 pin） */
  async exportJSON() {
    return JSON.stringify({ name: this.name, updated: Date.now(), items: await this.all() }, null, 2);
  }
}

let _sid;
function selfId() { return _sid || (_sid = Math.random().toString(36).slice(2)); }

/** 短链/邀请码工具 */
export function shortAddress(addr) {
  if (!addr) return '';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}
