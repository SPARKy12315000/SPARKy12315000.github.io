/**
 * 主应用 v2.2.0 —— 编排各模块 + 多语言 + 官网自愈
 */
import { CONFIG } from './config.js';
import { LanguageDetector } from './language-detector.js';
import { locales } from './i18n.js';
import { Wallet } from './wallet.js';
import { Chat } from './chat.js';
import { Shop } from './shop.js';
import { Market } from './market.js';
import { VideoRewards } from './video.js';
import { Admin } from './admin.js';
import { AIUpgrader } from './ai-upgrader.js';

export class App {
  constructor() {
    this.lang = new LanguageDetector(this._env());
    this.wallet = new Wallet();
    this.chat = new Chat(this.wallet);
    this.shop = new Shop(this.wallet);
    this.market = new Market();
    this.video = new VideoRewards(this.wallet);
    this.admin = new Admin();
    this.ai = new AIUpgrader({ siteHtml: document?.documentElement?.outerHTML });
    this.locale = CONFIG.i18n.defaultLocale;
    this.t = (k, ...a) => k;
  }

  /** 启动：注销旧 SW → 检测语言 → 翻译 UI → 挂载动态数据 */
  async boot() {
    this._disableOldSW();
    this.locale = this.lang.detect();
    this.t = this.lang.translator(this.locale);
    this._translate();
    this._renderLanguageSwitcher();
    this._bindEvents();
    await this._loadDynamic();
  }

  // —— 私有 ——

  _env() {
    if (typeof window === 'undefined') return {}; // Node 测试环境
    return {
      getQuery: () => {
        const p = new URLSearchParams(location.search);
        return { lang: p.get('lang') };
      },
      getStorage: (k) => localStorage.getItem(k),
      setStorage: (k, v) => localStorage.setItem(k, v),
      getNavigator: () => navigator.language || '',
    };
  }

  /** 注销所有旧 Service Worker + 清缓存（根治乱码/头像消失） */
  _disableOldSW() {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const r of regs) r.unregister();
    }).catch(() => {});
    if ('caches' in window) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {});
  }

  /** 扫描所有 [data-i18n] 节点并替换文本 */
  _translate() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const val = this.t(key);
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = val;
      else el.textContent = val;
    });
    document.title = this.t('app.title');
    document.documentElement.lang = this.locale;
  }

  _renderLanguageSwitcher() {
    const select = document.querySelector('[data-i18n-switch]');
    if (!select) return;
    select.innerHTML = '';
    for (const opt of this.lang.available()) {
      const o = document.createElement('option');
      o.value = opt.code; o.textContent = `${opt.flag} ${opt.name}`;
      if (opt.code === this.locale) o.selected = true;
      select.appendChild(o);
    }
    select.onchange = (e) => this._switchLanguage(e.target.value);
  }

  async _switchLanguage(code) {
    if (!this.lang.save(code)) return;
    this.locale = code;
    this.t = this.lang.translator(code);
    this._translate();
    this._renderLanguageSwitcher();
    // 首次进入后强制刷新一次，破除 CDN/SW 缓存
    if (!sessionStorage.getItem('spark:refreshed')) {
      sessionStorage.setItem('spark:refreshed', '1');
      location.reload(true);
    }
  }

  _bindEvents() {
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-action]');
      if (!t) return;
      const action = t.getAttribute('data-action');
      this[action]?.();
    });
  }

  async _loadDynamic() {
    // 行情：将 SPARK 注入首位
    try {
      const list = await this.market.getTop(100);
      const el = document.querySelector('[data-market]');
      if (el) el.textContent = JSON.stringify(list.slice(0, 5), null, 0);
    } catch {}
  }

  // —— 对外动作（data-action 绑定）——
  async connectWallet() {
    try { const r = await this.wallet.connect(); alert(this.t('wallet.connected') + ': ' + r.address); }
    catch (e) { alert(e.message); }
  }
  async scanAndUpgrade() {
    if (!this.admin.isLoggedIn()) { alert(this.t('ai.upgrade')); return; }
    const proposal = await this.ai.scan();
    console.log('[AI Upgrade Proposal]', proposal);
    alert(`扫描完成：${proposal.findings.length} 项发现，${proposal.actions.length} 项可升级（需管理员授权）`);
    return proposal;
  }
}

// 浏览器自动启动
if (typeof window !== 'undefined') {
  window.__SPARK__ = new App();
  window.addEventListener('DOMContentLoaded', () => window.__SPARK__.boot());
}

export default App;
