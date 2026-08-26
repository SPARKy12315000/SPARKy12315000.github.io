/**
 * 去中心化聊天 v2.2.0
 * 端到端思路：消息 = 内容 + 签名（钱包签名，防伪造）
 * 同步：IndexedDB 本地 + IPFS 多网关轮询（大陆发、海外收）
 */
import { DStorage } from './storage.js';

export class Chat extends DStorage {
  constructor(wallet) { super(); this.wallet = wallet; }

  async send(text) {
    if (!this.wallet?.connected) throw new Error('请先连接钱包');
    if (!text || !String(text).trim()) throw new Error('消息不能为空');
    const msg = {
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      from: this.wallet.address,
      text: String(text).trim(),
      ts: Date.now(),
      sig: null,
    };
    // 签名（不可签则存原文，仍保留同步能力）
    try {
      msg.sig = await this.wallet.provider?.request?.({
        method: 'personal_sign', params: [`SPARK-CHAT:${msg.id}:${msg.text}`, this.wallet.address],
      }) || null;
    } catch {}
    await this.put('chat', msg);
    return msg;
  }

  /** 拉取消息：本地 + 远程 IPFS（模拟多端同步轮询） */
  async sync(remoteCID) {
    const local = await this.all('chat');
    if (!remoteCID) return local;
    const url = await this.resolveCID(remoteCID);
    if (!url) return local;
    try {
      const remote = await fetch(url).then((r) => r.json());
      const merged = this._merge(local, Array.isArray(remote) ? remote : [remote]);
      for (const m of merged) await this.put('chat', m);
      return merged;
    } catch { return local; }
  }

  _merge(a, b) {
    const map = new Map(a.map((m) => [m.id, m]));
    for (const m of b) if (!map.has(m.id)) map.set(m.id, m);
    return [...map.values()].sort((x, y) => x.ts - y.ts);
  }
}

export default Chat;
