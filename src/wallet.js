/**
 * 钱包模块（问题1）
 * 目标：检测设备并连接【任何】去中心化钱包 —— 不硬编码 MetaMask。
 * 标准：EIP-1193（window.ethereum 注入） + WalletConnect v2 兜底。
 * 兼容：MetaMask、Coinbase Wallet、imToken、TokenPocket、Trust、OKX Wallet、
 *       Binance Web3 Wallet、Brave、Status、Phantom(ETH)、硬件钱包等。
 */
import { CONFIG } from './config.js';

export class Wallet {
  constructor() {
    this.provider = null;
    this.address = null;
    this.chainId = null;
    this.signer = null;
    this.listeners = new Set();
  }

  /** 检测环境中可用的钱包提供者（自动发现，不依赖具体品牌） */
  detect() {
    const found = [];
    if (typeof window === 'undefined') return found;

    // 1) EIP-1193 注入式（绝大多数桌面/移动钱包）
    if (window.ethereum) {
      const eth = window.ethereum;
      // 处理多个注入（如同时装了 MetaMask + Coinbase）
      const providers = Array.isArray(eth.providers) ? eth.providers : [eth];
      providers.forEach((p, i) => {
        found.push({
          type: 'eip1193',
          id: p.isMetaMask ? 'metamask'
            : p.isCoinbaseWallet ? 'coinbase'
            : p.isImToken ? 'imtoken'
            : p.isTokenPocket ? 'tokenpocket'
            : p.isTrust ? 'trust'
            : p.isOKXWallet ? 'okx'
            : p.isBinanceWallet ? 'binance'
            : `injected-${i}`,
          name: p.isMetaMask ? 'MetaMask'
            : p.isCoinbaseWallet ? 'Coinbase Wallet'
            : p.isImToken ? 'imToken'
            : p.isTokenPocket ? 'TokenPocket'
            : p.isTrust ? 'Trust Wallet'
            : p.isOKXWallet ? 'OKX Wallet'
            : p.isBinanceWallet ? 'Binance Web3'
            : 'Injected Wallet',
          provider: p,
        });
      });
    }

    // 2) 移动端深度链接/Universal Link（钱包浏览器内打开时）
    const ua = navigator.userAgent || '';
    this.isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    this.isWalletBrowser = /imToken|TokenPocket|Trust|MetaMask|Coinbase|OKX|Binance/i.test(ua);

    // 3) WalletConnect 兜底（本仓库若引入 walletconnect，则启用）
    if (window.WalletConnect || CONFIG.walletConnectProjectId) {
      found.push({ type: 'walletconnect', id: 'wc', name: 'WalletConnect' });
    }
    return found;
  }

  /** 连接指定钱包（自动切换到 ETH 主网并监听账户/链变化） */
  async connect(providerId) {
    let providers = this.detect();

    // 未指定则选第一个，移动钱包浏览器直接用当前注入
    let target = providers.find(p => p.id === providerId) || providers[0];

    // 移动端：若在非钱包浏览器且没有注入，引导跳转钱包
    if (!target && this.isMobile) return this.openInWallet();

    if (!target) throw new Error('WALLET_NOT_FOUND');

    const eth = target.provider;
    this.provider = eth;

    // 请求账户（标准 eth_requestAccounts）
    const accounts = await eth.request({ method: 'eth_requestAccounts' });
    this.address = accounts[0];
    this.chainId = await eth.request({ method: 'eth_chainId' });

    // 自动切到 ETH 主网
    if (this.chainId !== CONFIG.chainHex) {
      try {
        await eth.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: CONFIG.chainHex }],
        });
      } catch (e) { /* 用户拒绝或链未添加：给出提示但不断开 */ }
      this.chainId = await eth.request({ method: 'eth_chainId' });
    }

    // 持久化登录态（问题1：登录 = 连接钱包）
    localStorage.setItem('spark_wallet', JSON.stringify({
      address: this.address, providerId: target.id, connectedAt: Date.now(),
    }));

    this._bindEvents(eth);
    this._notify({ type: 'connect', address: this.address });
    return this.address;
  }

  /** 移动端：用钱包扫描/深度链接打开本站（通用 scheme，不绑定品牌） */
  openInWallet() {
    const url = encodeURIComponent(location.href);
    // 优先 WalletConnect，其次通用 ethereum: scheme
    location.href = `ethereum:${url}`; // 多数钱包可拦截
    return null;
  }

  _bindEvents(eth) {
    const onAccounts = (accs) => {
      if (!accs || !accs.length) return this.disconnect();
      this.address = accs[0];
      this._notify({ type: 'accounts', address: this.address });
    };
    const onChain = (cid) => {
      this.chainId = cid;
      this._notify({ type: 'chain', chainId: cid });
    };
    eth.on?.('accountsChanged', onAccounts);
    eth.on?.('chainChanged', onChain);
    this._ethEvents = { eth, onAccounts, onChain };
  }

  /** 恢复上一次会话（刷新不丢登录） */
  async restore() {
    const saved = JSON.parse(localStorage.getItem('spark_wallet') || 'null');
    if (!saved?.address) return null;
    const providers = this.detect();
    const target = providers.find(p => p.id === saved.providerId) || providers[0];
    if (!target) return null;
    try {
      const accounts = await target.provider.request({ method: 'eth_accounts' });
      if (accounts.includes(saved.address)) {
        this.provider = target.provider;
        this.address = saved.address;
        this.chainId = await target.provider.request({ method: 'eth_chainId' });
        this._bindEvents(target.provider);
        this._notify({ type: 'connect', address: this.address });
        return this.address;
      }
    } catch (e) { /* 忽略，视为未登录 */ }
    return null;
  }

  disconnect() {
    localStorage.removeItem('spark_wallet');
    this.address = null;
    this.provider = null;
    this._notify({ type: 'disconnect' });
  }

  isConnected() { return !!this.address; }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _notify(e) { this.listeners.forEach(fn => { try { fn(e); } catch (_) {} }); }

  /** 用钱包签名一段消息（登录/发聊天/下单的鉴权，问题3/2 用） */
  async signMessage(text) {
    if (!this.provider || !this.address) throw new Error('NOT_CONNECTED');
    return this.provider.request({
      method: 'personal_sign',
      params: [text, this.address],
    });
  }

  /** 发送一笔交易（问题8：营销钱包代付/扣费均走此） */
  async sendTransaction(tx) {
    if (!this.provider) throw new Error('NOT_CONNECTED');
    return this.provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: this.address, ...tx }],
    });
  }
}

export const wallet = new Wallet();
