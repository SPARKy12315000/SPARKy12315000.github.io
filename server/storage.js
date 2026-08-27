/**
 * 去中心化存储抽象层
 * ---------------------------------------------------------------
 *  模拟 IPFS 式内容寻址：每条记录 => hash(内容)，多副本冗余。
 *  支持：自动修复（副本缺失时补全）、快照、持久化到本地文件。
 *  真实部署可替换为 ipfs-http-client / Filecoin 等。
 * ---------------------------------------------------------------
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import logger from './logger.js';

export const STORAGE_FILE = path.resolve('data/state.json');

class DecentralizedStore {
  constructor() {
    this.records = new Map(); // cid -> { data, replicas: [] }
    this.filePath = STORAGE_FILE;
    this.REPLICA = 3;
    this.load();
  }

  /** 内容寻址：写入即得 CID */
  put(data) {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    const cid = 'bafy' + crypto.createHash('sha256').update(str).digest('hex').slice(0, 40);
    const replicas = Array.from({ length: this.REPLICA }, (_, i) => `node-${i + 1}`);
    this.records.set(cid, { data: str, replicas, healthy: true });
    return cid;
  }

  get(cid) {
    return this.records.get(cid) || null;
  }

  /** 自动修复：检测缺失副本并补充 */
  repair() {
    let fixed = false;
    for (const [cid, rec] of this.records) {
      if (rec.replicas.length < this.REPLICA) {
        while (rec.replicas.length < this.REPLICA) {
          rec.replicas.push(`node-${rec.replicas.length + 1}`);
        }
        rec.healthy = true;
        fixed = true;
        logger.debug(`repaired ${cid}`);
      }
    }
    return fixed;
  }

  /** 周期性快照 */
  snapshot() {
    const state = {
      time: Date.now(),
      records: [...this.records.entries()].map(([cid, r]) => ({
        cid, size: r.data.length, replicas: r.replicas.length,
      })),
    };
    this.put(state);
    return state;
  }

  /** 持久化到磁盘（管理员授权后调用） */
  flush() {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const dump = {
        version: 1,
        time: Date.now(),
        records: [...this.records.entries()].map(([cid, r]) => ({
          cid, data: r.data, replicas: r.replicas,
        })),
      };
      fs.writeFileSync(this.filePath, JSON.stringify(dump, null, 2));
      logger.info(`state persisted -> ${this.filePath}`);
      return true;
    } catch (e) {
      logger.error('flush failed', e.message);
      return false;
    }
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const dump = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        for (const r of dump.records || []) {
          this.records.set(r.cid, { data: r.data, replicas: r.replicas, healthy: true });
        }
        logger.info(`state loaded: ${this.records.size} records`);
      }
    } catch (e) {
      logger.warn('load failed, starting fresh:', e.message);
    }
  }
}

export const store = new DecentralizedStore();
export default store;
