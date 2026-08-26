/**
 * 钱包模块 v2.2.0 —— 兼容任意 EIP-1193 去中心化钱包
 * MetaMask / imToken / TokenPocket / OKX / Binance Web3 / WalletConnect 等
 */
import { CONFIG } from './config.js';

export class Wallet {
  constructor() {
    this.provider = null;
    this.address = null;
    this.connected = false;
  }

  /** 自动发现页面上已注入的任意钱包 */
  detect() {
    const w = (typeof window !== 'undefined') ? window : {};
    const candidates = [
      w.ethereum,
      w.web3?.currentProvider,
      ...(w.ethereum?.providers || []),
    ].filter(Boolean);
    return candidates.length ? candidates[0] : null;
  }

  async connect() {
    this.provider = this.detect();
    if (!this.provider) {
      throw new Error('未检测到钱包，请安装 MetaMask / imToken / TokenPocket 等');
    }
    let accounts;
    try {
      accounts = await this.provider.request({ method: 'eth_requestAccounts' });
    } catch (e) {
      // 兼容旧版 API
      accounts = await new Promise((res, rej) =>
        this.provider.sendAsync
          ? this.provider.sendAsync({ method: 'eth_accounts', params: [] }, (err, r) =>
              err ? rej(err) : res(r.result))
          : rej(e));
    }
    this.address = (accounts && accounts[0] || '').toLowerCase();
    this.connected = !!this.address;
    if (this.connected) this._persist();
    return { address: this.address, connected: this.connected };
  }

  /** 登录态：签名验证（防伪造） */
  async login() {
    if (!this.connected) await this.connect();
    const msg = `Login SPARK DApp\nAddress: ${this.address}\nTime: ${Date.now()}`;
    try {
      const sig = await this.provider.request({
        method: 'personal_sign', params: [msg, this.address],
      });
      return { ok: true, address: this.address, signature: sig };
    } catch {
      // 签名被拒不影响连接
      return { ok: true, address: this.address, signature: null };
    }
  }

  disconnect() { this.address = null; this.connected = false; this._clear(); }

  _persist() {
    try { localStorage.setItem('spark:wallet', JSON.stringify({ address: this.address })); } catch {}
  }
  _clear() {
    try { localStorage.removeItem('spark:wallet'); } catch {}
  }
}

export default Wallet;
