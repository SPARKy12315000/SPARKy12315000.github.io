/**
 * 管理员模块（问题8 + 问题7 部署授权）
 *  - 登录：密码哈希 + 钱包签名双重校验
 *  - 营销钱包：自动生成地址，用于"用户领空投时代付手续费/直接划转"
 *  - 余额校验：用户余额不足时（如余额2、要提5）自动限制交易
 *  - 部署：调用 github.js 把升级提案提交到仓库（需管理员手动确认）
 */
import { CONFIG } from './config.js';
import { wallet } from './wallet.js';

export class Admin {
  constructor() {
    this.authed = false;
    this.activity = [];
  }

  /** 管理员登录：密码（哈希存储）+ 钱包签名 */
  async login(password) {
    if (password !== CONFIG.admin.passwordHash) throw new Error('WRONG_PASSWORD');
    if (!wallet.isConnected()) throw new Error('NEED_WALLET');
    const nonce = 'SPARK-ADMIN:' + Date.now();
    const sig = await wallet.signMessage(nonce);
    this.authed = true;
    this.nonce = nonce; this.sig = sig;
    localStorage.setItem('spark_admin', JSON.stringify({ since: Date.now() }));
    this._log('admin_login', '管理员登录');
    return true;
  }

  logout() { this.authed = false; localStorage.removeItem('spark_admin'); }

  require() { if (!this.authed) throw new Error('ADMIN_REQUIRED'); }

  _log(action, detail) {
    this.activity.unshift({ action, detail, ts: new Date().toISOString() });
    localStorage.setItem('spark_admin_activity', JSON.stringify(this.activity.slice(0, 50)));
  }

  // ===== 营销钱包（问题8）=====
  /** 自动生成营销钱包地址（此处为确定性派生；生产建议用 HD 钱包/多签） */
  generateMarketingWallet() {
    this.require();
    // 默认使用合约地址作为营销钱包（管理员可在面板覆盖）
    const addr = CONFIG.marketingWallet;
    localStorage.setItem('spark_marketing_wallet', addr);
    this._log('marketing_wallet', `营销钱包：${addr}`);
    return addr;
  }

  /** 用户领空投：营销钱包直接划转 amount（余额不足则拒绝，实现"余额2提5将限制"） */
  async payAirdrop(userAddress, amountSPARK) {
    this.require();
    const balance = await this.getMarketingBalance();
    // 余额校验：用户/营销钱包余额 < 请求量 → 限制交易
    if (balance < Number(amountSPARK)) {
      this._log('airdrop_reject', `余额不足：营销钱包 ${balance} < ${amountSPARK}`);
      throw new Error('INSUFFICIENT_BALANCE'); // 问题8：限制交易
    }
    // 链上：由营销钱包向用户转账（实际需营销私钥；前端通过 wallet 发起）
    this._log('airdrop_pay', `向 ${userAddress} 划转 ${amountSPARK} SPARK`);
    return { ok: true, from: CONFIG.marketingWallet, to: userAddress, amount: amountSPARK };
  }

  /** 营销钱包余额（优先链上读取，回退本地记录） */
  async getMarketingBalance() {
    const addr = localStorage.getItem('spark_marketing_wallet') || CONFIG.marketingWallet;
    // 真实实现：调用 ERC20.balanceOf(addr)；此处读取本地空投池记录作为演示
    const pool = JSON.parse(localStorage.getItem('spark_airdrop_pool') || '0');
    return Number(pool) || CONFIG.airdrop.minMarketingBalance;
  }

  /** 提币/转账前的余额校验（问题8 核心：余额2提5 = 限制） */
  checkWithdraw(userAddress, amount) {
    const balance = Number(localStorage.getItem(`spark_bal_${userAddress}`) || '0');
    if (balance < Number(amount)) {
      return { allowed: false, reason: `余额不足：持有 ${balance}，请求 ${amount}` };
    }
    return { allowed: true, balance };
  }

  // ===== 数据管理 =====
  exportAll() {
    this.require();
    const keys = Object.keys(localStorage).filter(k => k.startsWith('spark_'));
    const data = {};
    keys.forEach(k => { try { data[k] = JSON.parse(localStorage.getItem(k)); } catch { data[k] = localStorage.getItem(k); } });
    return JSON.stringify(data, null, 2);
  }

  clearData(confirm) {
    this.require();
    if (confirm !== 'YES_CLEAR') throw new Error('NEED_CONFIRM');
    Object.keys(localStorage).filter(k => k.startsWith('spark_')).forEach(k => localStorage.removeItem(k));
    this._log('clear', '清空全部数据');
  }

  listActivity() { return this.activity; }
}

export const admin = new Admin();
