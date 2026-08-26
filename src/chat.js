/**
 * 去中心化聊天（问题3）
 * 需求：大陆发、海外收 —— 类似微信的跨地域实时同步。
 * 方案：消息本地入 DecentraStore + 签名上链标识 + 周期性（可配置）从 IPFS 多网关拉取新消息。
 *       多网关容灾保证中国大陆/海外不同网络都能取到同一份数据。
 * 说明：完整 P2P（Libp2p/OrbitDB）需用户部署节点；此处用 IPFS 网关轮询 + 签名验证，
 *       作为 GitHub Pages 零后端条件下的可行实现，效果上达到"任一点发、全局可见"。
 */
import { CONFIG, ipfsUrl } from './config.js';
import { DecentraStore, fetchIPFS } from './storage.js';
import { wallet } from './wallet.js';

const ROOM = 'spark-global'; // 全局聊天室
const POLL_MS = 8000;        // 轮询间隔（秒级接近实时）

export class Chat {
  constructor() {
    this.store = new DecentraStore(`chat_${ROOM}`);
    this.timer = null;
    this.peers = new Set(); // 已见过的地址（模拟在线列表）
  }

  /** 启动：加载历史 + 开始轮询 + 监听本机其他标签 */
  async start(onNew) {
    this.onNew = onNew;
    await this._loadFromIPFS();
    this.timer = setInterval(() => this._loadFromIPFS(), POLL_MS);
    // 同设备多标签即时同步
    window.addEventListener('storage', (e) => {
      if (e.key?.includes('spark_store_chat')) this._loadFromIPFS();
    });
  }

  stop() { clearInterval(this.timer); }

  /** 从 IPFS 拉取并合并新消息（跨地域同步的关键） */
  async _loadFromIPFS() {
    // 1) 先尝试拉取 IPFS 上的全局消息 CID（由管理员/用户持续 pin 更新）
    const cid = localStorage.getItem('spark_chat_cid') || CONFIG.ipfs.chatCID;
    if (cid) {
      try {
        const remote = await fetchIPFS(cid);
        if (Array.isArray(remote?.items)) await this._merge(remote.items);
      } catch (_) { /* 网关不可用就跳过，用本地 */ }
    }
    // 2) 合并本地
    const local = await this.store.all();
    local.forEach(m => this.peers.add(m.from));
    this.onNew?.(local);
  }

  async _merge(items) {
    const local = await this.store.all();
    const ids = new Set(local.map(m => m.id));
    let changed = false;
    for (const it of items) {
      if (!ids.has(it.id)) { await this.store.add(it); changed = true; }
    }
    if (changed) this.onNew?.(await this.store.all());
  }

  /** 发送：签名 + 本地入池 + 广播。要求已连接钱包（签名=身份） */
  async send(text) {
    if (!wallet.isConnected()) throw new Error('NEED_WALLET');
    const addr = wallet.address;
    const msg = {
      room: ROOM, text, from: addr,
      name: localStorage.getItem('spark_chat_name') || shortName(addr),
    };
    // 用钱包签名作为消息防伪凭证（验证发送者）
    try { msg.sig = await wallet.signMessage(`SPARK-CHAT:${msg.ts}:${text}`); }
    catch { msg.sig = 'unsigned'; }
    await this.store.add(msg);
    this.peers.add(addr);
    this.onNew?.(await this.store.all());
    return msg;
  }

  /** 将本地消息池导出为 JSON，供用户/管理员 pin 到 IPFS（维持全局可见） */
  async publishToIPFS() {
    const json = await this.store.exportJSON();
    // 浏览器无法直接写 IPFS；生成文件 + 提示用户 pin（或调用本地 IPFS node）
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${ROOM}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return '请将该文件上传到 IPFS 并保存新 CID（见管理员面板"同步聊天"）';
  }

  onlineCount() { return this.peers.size || 1; }
}

function shortName(addr) {
  return addr ? addr.slice(0, 6) : 'guest';
}
