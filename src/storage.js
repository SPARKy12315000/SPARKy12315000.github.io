/**
 * 去中心化存储 v2.2.0
 * IPFS 多网关容灾 + IndexedDB 本地持久（聊天/商城/订单）
 */
import { CONFIG } from './config.js';

export class DStorage {
  constructor() { this.gateways = CONFIG.ipfs.gateways; }

  /** 多网关探测：任一成功即返回，保障大陆/海外均可访问 */
  async resolveCID(cid) {
    const errors = [];
    for (const gw of this.gateways) {
      try {
        const res = await fetch(gw + cid, { method: 'GET' });
        if (res.ok) return gw + cid;
      } catch (e) { errors.push(e.message); }
    }
    return null; // 全部失败，降级本地
  }

  /** 加载图片（头像/背景）：带 onerror 兜底 */
  loadImage(cid, imgEl, fallbackDataUrl) {
    let i = 0;
    const tryNext = () => {
      if (i >= this.gateways.length) {
        if (fallbackDataUrl) imgEl.src = fallbackDataUrl;
        return;
      }
      imgEl.src = this.gateways[i++] + cid;
      imgEl.onerror = tryNext;
    };
    tryNext();
  }

  // —— IndexedDB 封装（聊天同步本地层）——
  async _open(name = 'spark-dapp') {
    return new Promise((res, rej) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const store of ['chat', 'shop', 'orders', 'airdrop']) {
          if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  async put(store, record) {
    const db = await this._open();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(record);
      tx.oncomplete = () => res(true);
      tx.onerror = () => rej(tx.error);
    });
  }

  async all(store) {
    const db = await this._open();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    });
  }
}

export default DStorage;
