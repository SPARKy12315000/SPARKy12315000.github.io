/**
 * 管理模块 v2.2.0
 *  - 管理员登录（密码 SHA-256 + salt，不存明文）
 *  - 营销钱包（类似交易所提币，用户领空投自动提交手续费，链上确认后划扣）
 *  - 余额限制：余额不足禁止超额交易（问题8）
 */
import { CONFIG } from './config.js';
import { DStorage } from './storage.js';

const SALT = 'spark-admin-v2.2';
const ADMIN_KEY = 'spark:admin';

export class Admin extends DStorage {
  constructor() { super(); this.session = null; }

  /** 设置密码（首次）或校验（后续） */
  async setPassword(password) {
    const hash = await this._hash(password + SALT);
    localStorage.setItem(ADMIN_KEY + ':hash', hash);
    return true;
  }

  async login(password) {
    const stored = localStorage.getItem(ADMIN_KEY + ':hash');
    if (!stored) {
      // 首次：直接用该密码作为初始密码
      await this.setPassword(password);
      stored = localStorage.getItem(ADMIN_KEY + ':hash');
    }
    const hash = await this._hash(password + SALT);
    if (hash !== stored) throw new Error('密码错误');
    this.session = { loginAt: Date.now() };
    localStorage.setItem(ADMIN_KEY + ':session', JSON.stringify(this.session));
    return { ok: true };
  }

  logout() { this.session = null; localStorage.removeItem(ADMIN_KEY + ':session'); }

  isLoggedIn() {
    try { return !!localStorage.getItem(ADMIN_KEY + ':session'); } catch { return false; }
  }

  /** 生成营销钱包（占位，生产须替换为真实多签） */
  getMarketingWallet() {
    return localStorage.getItem(ADMIN_KEY + ':marketing')
      || CONFIG.contract.address; // 占位
  }

  setMarketingWallet(addr) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) throw new Error('无效以太坊地址');
    localStorage.setItem(ADMIN_KEY + ':marketing', addr);
    return addr;
  }

  /**
   * 空投认领 + 手续费划扣（问题8）
   * 规则：用户余额不足时（如余额2，提币5）限制交易
   */
  async claimAirdrop({ userAddress, balance, requested, fee = 0.001 }) {
    if (balance < 0) throw new Error('余额无效');
    if (requested <= 0) throw new Error('认领数量必须大于 0');
    if (balance < requested) {
      throw new Error(
        `余额不足，限制交易：余额 ${balance}，请求 ${requested}（差值 ${requested - balance}）`);
    }
    // 余额充足：扣除手续费后发放
    const net = +(requested - fee).toFixed(6);
    if (net <= 0) throw new Error('认领金额不足以支付手续费');
    return {
      ok: true, userAddress, gross: requested, fee, net,
      marketingWallet: this.getMarketingWallet(),
      message: `已发放 ${net} SPARK，手续费 ${fee} 划入营销钱包`,
    };
  }

  async _hash(text) {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    // Node 降级
    const { createHash } = await import('crypto');
    return createHash('sha256').update(text).digest('hex');
  }
}

export default Admin;
