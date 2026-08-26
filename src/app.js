/**
 * SPARK DApp - 主应用入口
 * 串联：钱包 / 聊天 / 行情 / 商城 / 视频 / AI / 管理员 / GitHub部署
 * 路由：hash 路由（兼容 GitHub Pages 子路径）
 */
import { CONFIG, ipfsUrl } from './config.js';
import { wallet } from './wallet.js';
import { Chat } from './chat.js';
import { getMarketList, getSPARKStats } from './market.js';
import { marketplace } from './shop.js';
import { VideoRewards } from './video.js';
import { AIChat, UpgradeAgent } from './ai.js';
import { admin } from './admin.js';
import { GitHubDeploy } from './github.js';

// 读取构建期注入的源码快照（独立 script[type=application/json]，避免破坏主 script）
try {
  const el = document.getElementById('spark-sources');
  if (el) window.__SPARK_SOURCES__ = JSON.parse(el.textContent || '{}');
} catch (e) {
  window.__SPARK_SOURCES__ = {};
}

export class App {
  constructor() {
    this.lang = localStorage.getItem('spark_lang') || 'zh';
    this.chat = new Chat();
    this.video = new VideoRewards();
    this.ai = new AIChat();
    this.upgrade = new UpgradeAgent();
    this.github = new GitHubDeploy();
    this.currentPage = 'home';
  }

  async init() {
    this.applyStaticI18n();
    this.renderCommon();
    this.bindEvents();
    await wallet.restore();
    this.updateWalletUI();
    this.route();
    window.addEventListener('hashchange', () => this.route());
    // 钱包变化全局响应
    wallet.on((e) => { this.updateWalletUI(); if (e.type === 'chain') this.toast(this.t('chain_changed'), 'info'); });
    // 自动拉行情（问题6）
    this.refreshMarket();
  }

  // ===== 路由 =====
  route() {
    const page = location.hash.replace('#', '') || 'home';
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
    document.querySelectorAll('.nav-link[data-page]').forEach(l => l.classList.toggle('active', l.dataset.page === page));
    this.currentPage = page;
    if (page === 'chat') this.startChat();
    if (page === 'market') this.refreshMarket();
    if (page === 'shop') this.renderShop();
    if (page === 'video') this.renderVideo();
    if (page === 'ai') this.renderAI();
  }

  // ===== 通用渲染 =====
  renderCommon() {
    // 星空
    const stars = document.getElementById('stars');
    if (stars && !stars.children.length) {
      for (let i = 0; i < 60; i++) {
        const s = document.createElement('div');
        s.className = 'star';
        s.style.cssText = `top:${Math.random()*100}%;left:${Math.random()*100}%;width:${Math.random()*2+1}px;height:${s.style.width};animation-delay:${Math.random()*5}s`;
        stars.appendChild(s);
      }
    }
    // 语言按钮
    document.getElementById('langText').textContent = this.lang === 'zh' ? 'EN' : '中文';

    // ===== 头像 & 背景图：本地 base64 优先，IPFS 作增强（根治头像消失/乱码）=====
    const localLogo = CONFIG.localAssets && CONFIG.localAssets.logo && !String(CONFIG.localAssets.logo).includes('__LOGO_BASE64__')
      ? CONFIG.localAssets.logo : '';
    const localBg = CONFIG.localAssets && CONFIG.localAssets.background && !String(CONFIG.localAssets.background).includes('__BG_BASE64__')
      ? CONFIG.localAssets.background : '';
    const ipfsLogo = ipfsUrl(CONFIG.ipfs.logoCID);
    const ipfsBg = ipfsUrl(CONFIG.ipfs.bgCID);

    // Logo：先设本地内嵌图（必定成功），再尝试 IPFS 高清原图覆盖
    document.querySelectorAll('[data-logo]').forEach(el => {
      if (localLogo) el.src = localLogo;           // 本地兜底，永不失联
      el.onerror = () => { if (localLogo) el.src = localLogo; }; // IPFS 失败回到本地
      if (ipfsLogo) {
        const t = new Image();
        t.onload = () => { el.src = ipfsLogo; };   // IPFS 成功则用原图
        t.src = ipfsLogo;
      }
    });

    // 背景图：本地内嵌优先写入 CSS 变量，IPFS 成功后再覆盖
    const root = document.documentElement;
    const applyBg = (url) => root.style.setProperty('--bg-image', `url("${url}")`);
    if (localBg) applyBg(localBg);
    if (ipfsBg) {
      const probe = new Image();
      probe.onload = () => applyBg(ipfsBg);        // 主网关成功则用 IPFS 原图
      probe.onerror = () => {                       // 主网关失败：遍历其余网关
        for (const gw of CONFIG.ipfs.gateways) {
          if (gw.includes('ivory-cautious-stoat-562')) continue;
          const tryUrl = gw + CONFIG.ipfs.bgCID;
          const p2 = new Image();
          p2.onload = () => applyBg(tryUrl);
          p2.src = tryUrl;
        }
      };
      probe.src = ipfsBg;
    }

    // IPFS 区块里的背景图缩略图：与全站背景同源（本地 base64 优先）
    const bgThumb = document.getElementById('ipfsBgThumb');
    if (bgThumb) {
      bgThumb.src = localBg || ipfsBg;
      bgThumb.onerror = () => { if (localBg) bgThumb.src = localBg; };
    }
  }

  bindEvents() {
    document.getElementById('connectBtn')?.addEventListener('click', () => this.connectWallet());
    document.getElementById('claimBtn')?.addEventListener('click', () => this.claimAirdrop());
  }

  // ===== 问题1：连接钱包 =====
  async connectWallet() {
    try {
      const providers = wallet.detect();
      // 若检测到多个钱包，弹出选择；否则直接连
      let pid;
      if (providers.length > 1) {
        pid = await this.pickProvider(providers);
        if (!pid) return;
      }
      const addr = await wallet.connect(pid);
      this.toast(this.t('connect_success') + ' ' + addr.slice(0, 6) + '...', 'success');
      this.updateWalletUI();
      this.refreshAirdropUI();
    } catch (e) {
      this.toast(this.t('connect_failed') + ': ' + e.message, 'error');
    }
  }

  pickProvider(providers) {
    return new Promise((res) => {
      const names = providers.map(p => p.name).join('\n');
      const pick = prompt(this.t('pick_wallet') + '\n\n' + names, providers[0].id);
      res(pick);
    });
  }

  updateWalletUI() {
    const box = document.getElementById('walletConnect');
    if (!box) return;
    if (wallet.isConnected()) {
      const short = wallet.address.slice(0, 6) + '...' + wallet.address.slice(-4);
      box.innerHTML = `<span class="wallet-address"><i class="fas fa-wallet"></i> ${short}</span>
        <button class="btn btn-secondary btn-sm" onclick="app.disconnect()" style="padding:4px 10px;font-size:.8rem">${this.t('disconnect')}</button>`;
    } else {
      box.innerHTML = `<button class="btn btn-primary btn-sm" onclick="app.connectWallet()" id="connectBtn" style="padding:6px 14px;font-size:.85rem">
        <i class="fas fa-wallet"></i> ${this.t('connect_wallet')}</button>`;
    }
  }

  disconnect() { wallet.disconnect(); this.updateWalletUI(); this.toast(this.t('disconnected'), 'info'); }

  // ===== 问题6：行情 =====
  async refreshMarket() {
    const body = document.getElementById('marketBody');
    if (!body) return;
    body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px"><div class="loading"></div></td></tr>`;
    try {
      const { list, source } = await getMarketList();
      const sparkStats = await getSPARKStats().catch(() => null);
      this.updateHeroStats(sparkStats || { price: null, marketCap: null });
      setText('marketSource', `${this.t('market_source')} · ${source}`); // 显示当前数据源
      body.innerHTML = list.map(t => `
        <tr class="${t.isSPARK ? 'spark-row market-pinned' : ''}">
          <td><strong>${t.rank}</strong>${t.isSPARK ? ' 🔥' : ''}</td>
          <td><strong>${t.name}</strong> <span style="color:#888">${t.symbol || ''}</span></td>
          <td>$${t.price != null ? formatNum(t.price) : '—'}</td>
          <td class="${t.change24h >= 0 ? 'price-up' : 'price-down'}">${t.change24h != null ? (t.change24h >= 0 ? '+' : '') + t.change24h.toFixed(2) + '%' : '—'}</td>
          <td>$${t.marketCap != null ? formatNum(t.marketCap) : '—'}</td>
          <td>$${t.volume24h != null ? formatNum(t.volume24h) : '—'}</td>
        </tr>`).join('');
    } catch (e) {
      body.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#f44336;padding:30px">${this.t('market_error')}: ${e.message}</td></tr>`;
    }
  }

  updateHeroStats(s) {
    setText('statPrice', '$' + formatNum(s && s.price != null ? s.price : '—'));
    setText('statMarketCap', '$' + formatNum(s && s.marketCap != null ? s.marketCap : '—'));
  }

  // ===== 问题2：商城 =====
  async renderShop() {
    const list = await marketplace.allGoods();
    const el = document.getElementById('productList');
    if (!el) return;
    if (!list.length) { el.innerHTML = `<p style="color:#888">${this.t('no_goods')}</p>`; return; }
    el.innerHTML = list.map(g => `
      <div class="product-card">
        <img class="product-image" src="${g.imageCID ? ipfsUrl(g.imageCID) : ipfsUrl(CONFIG.ipfs.bgCID)}" alt="${g.title}">
        <div class="product-info">
          <h4>${g.title}</h4>
          <p style="font-size:.8rem;color:#aaa">${g.desc || ''}</p>
          <div class="product-price">${g.priceSPARK} SPARK</div>
          <button class="btn btn-primary btn-sm" style="width:100%;margin-top:8px" onclick="app.buyGood('${g.id}')">${this.t('buy')}</button>
        </div>
      </div>`).join('');
  }

  async buyGood(id) { this.toast(this.t('order_created'), 'success'); await marketplace.createOrder(id); }

  // ===== 问题3：聊天 =====
  async startChat() {
    const onNew = (msgs) => {
      const el = document.getElementById('chatMessages');
      if (!el) return;
      el.innerHTML = msgs.slice(-100).map(m => `
        <div class="chat-message ${m.from === wallet.address ? 'own' : 'other'}">
          <div class="chat-username">${m.name || m.from?.slice(0,6)}</div>
          <div>${escapeHtml(m.text)}</div>
          <div class="chat-time">${new Date(m.ts).toLocaleTimeString()}</div>
        </div>`).join('');
      el.scrollTop = el.scrollHeight;
      setText('onlineCount', this.chat.onlineCount());
    };
    await this.chat.start(onNew);
    document.getElementById('chatInput').onkeypress = (e) => { if (e.key === 'Enter') this.sendChat(); };
  }

  async sendChat() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim(); if (!text) return;
    try { await this.chat.send(text); input.value = ''; }
    catch (e) { this.toast(this.t('need_wallet_first'), 'error'); }
  }

  // ===== 问题4：视频 =====
  async renderVideo() {
    const list = await this.video.getFilms();
    const el = document.getElementById('videoList');
    if (!el) return;
    el.innerHTML = list.map(f => `
      <div class="product-card">
        <video class="product-image" src="${f.src}" style="object-fit:cover" muted preload="metadata"></video>
        <div class="product-info">
          <h4>${f.title}</h4>
          <button class="btn btn-primary btn-sm" style="width:100%;margin-top:8px" onclick="app.watchFilm('${f.id}', ${f.duration || 60})">${this.t('watch_earn')} (+${CONFIG.video.rewardPerWatch} SPARK)</button>
        </div>
      </div>`).join('');
  }

  async watchFilm(id, duration) {
    if (!wallet.isConnected()) return this.toast(this.t('need_wallet_first'), 'error');
    const watched = duration; // 演示：完整观看
    try {
      const rec = await this.video.completeWatch(id, watched);
      this.toast(`${this.t('reward_get')} +${rec.reward} SPARK`, 'success');
    } catch (e) { this.toast(e.message, 'error'); }
  }

  // ===== 问题5：APP 下载（修复 404，安卓+苹果）=====
  showAppDownload() {
    document.getElementById('appDownloadModal').classList.add('active');
  }
  closeAppDownload() { document.getElementById('appDownloadModal').classList.remove('active'); }
  installPWA() {
    this.toast(this.t('pwa_hint'), 'info');
    if (window.deferredPrompt) window.deferredPrompt.prompt();
  }

  // ===== 问题7：AI =====
  renderAI() { /* 动态内容由 sendAIMessage 处理 */ }
  async sendAIMessage() {
    const input = document.getElementById('aiInput');
    const text = input.value.trim(); if (!text) return;
    input.value = '';
    this.appendAIBubble('user', text);
    const reply = await this.ai.ask(text);
    this.appendAIBubble('bot', reply);
  }
  appendAIBubble(role, text) {
    const el = document.getElementById('aiMessages');
    const avatar = role === 'bot' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';
    el.innerHTML += `<div class="ai-message"><div class="ai-avatar ${role}">${avatar}</div><div class="ai-bubble ${role}">${text}</div></div>`;
    el.scrollTop = el.scrollHeight;
  }

  // ===== 管理员（问题8 + 7）=====
  showAdminModal() { document.getElementById('adminModal').classList.add('active'); }
  closeAdminModal() { document.getElementById('adminModal').classList.remove('active'); }
  async adminLogin() {
    const pwd = document.getElementById('adminPassword').value;
    try { await admin.login(pwd); this.closeAdminModal(); this.toast(this.t('admin_login_success'), 'success'); this.openAdminPanel(); }
    catch (e) { this.toast(e.message, 'error'); }
  }
  openAdminPanel() {
    document.getElementById('adminPanelModal').classList.add('active');
    this.renderAdminStats();
  }
  closeAdminPanel() { document.getElementById('adminPanelModal').classList.remove('active'); }
  renderAdminStats() {
    setText('adminTotalClaims', String(JSON.parse(localStorage.getItem('spark_store_shop_orders') || '[]').length));
  }

  /** 问题7：运行 AI 自检，生成升级提案（不自动执行） */
  async runUpgradeScan() {
    const sources = {};
    for (const f of ['config','wallet','storage','chat','market','shop','video','ai','admin','github']) {
      try { const m = await import(`./${f}.js`); sources[`src/${f}.js`] = m.__source || ''; } catch {}
    }
    const proposal = this.upgrade.propose(sources);
    this._pendingUpgrade = proposal;
    this.toast(proposal.summary, proposal.findings.some(f => f.level === 'error') ? 'error' : 'info');
    document.getElementById('adminActivity').innerHTML =
      `<pre style="white-space:pre-wrap;color:#ccc">${JSON.stringify(proposal, null, 2)}</pre>`;
    return proposal;
  }

  /** 管理员手动确认后才部署（问题7 的"手动开启"） */
  async applyUpgrade() {
    if (!this._pendingUpgrade) return this.toast(this.t('no_upgrade'), 'warning');
    const pat = prompt(this.t('enter_pat'));
    if (!pat) return;
    this.github.setPAT(pat);
    try {
      // 管理员确认：把升级提案作为版本记录提交到仓库
      await this.github.commitFile(`upgrades/${this._pendingUpgrade.id}.json`,
        JSON.stringify(this._pendingUpgrade, null, 2),
        `chore(ai): apply upgrade ${this._pendingUpgrade.id}`);
      admin.apply(this._pendingUpgrade, { adminPassword: CONFIG.admin.passwordHash, adminAddress: wallet.address });
      this.toast(this.t('upgrade_deployed'), 'success');
    } catch (e) { this.toast(e.message, 'error'); }
  }

  // ===== 空投（含问题8 营销钱包代付）=====
  async claimAirdrop() {
    if (!wallet.isConnected()) return this.toast(this.t('need_wallet_first'), 'error');
    const addr = wallet.address;
    // 问题8：校验用户余额（演示，关联营销钱包/用户余额）
    const check = admin.checkWithdraw(addr, CONFIG.airdrop.claimAmount);
    if (!check.allowed) return this.toast(check.reason + ' → ' + this.t('trade_limited'), 'error');
    try {
      await admin.payAirdrop(addr, CONFIG.airdrop.claimAmount); // 营销钱包直接划转
      this.toast(this.t('claim_success'), 'success');
    } catch (e) { this.toast(e.message, 'error'); }
  }

  // ===== 国际化 =====
  applyStaticI18n() {
    document.documentElement.lang = this.lang === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(el => { const k = el.dataset.i18n; el.innerHTML = this.t(k); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => el.placeholder = this.t(el.dataset.i18nPlaceholder));
  }
  toggleLanguage() {
    this.lang = this.lang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('spark_lang', this.lang);
    document.getElementById('langText').textContent = this.lang === 'zh' ? 'EN' : '中文';
    this.applyStaticI18n();
    this.refreshMarket();
  }
  t(key) { return (TRANSLATIONS[this.lang] || {})[key] || TRANSLATIONS.zh[key] || key; }

  toast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    if (!c) return alert(msg);
    const div = document.createElement('div');
    div.className = `toast toast-${type}`; div.textContent = msg;
    c.appendChild(div); setTimeout(() => div.remove(), 4000);
  }
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function formatNum(n) {
  if (n == null) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return Number(n).toFixed(6);
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

export const app = new App();

// 双语字典（覆盖9大问题相关的全部 UI）
export const TRANSLATIONS = {
  zh: {
    connect_wallet: '连接钱包', disconnect: '断开', connect_success: '钱包连接成功', connect_failed: '连接失败',
    pick_wallet: '检测到多个钱包，请选择', chain_changed: '已切换链', disconnected: '已断开',
    need_wallet_first: '请先连接钱包', no_goods: '暂无商品，连接钱包后可上架', buy: '购买',
    order_created: '订单已创建（C2C托管）', watch_earn: '观看赚币', reward_get: '获得奖励',
    market_error: '行情加载失败', no_upgrade: '暂无升级提案，请先运行自检', enter_pat: '请输入 GitHub PAT（ghp_...）',
    upgrade_deployed: '升级提案已提交到仓库，等待 GitHub Pages 发布', admin_login_success: '管理员登录成功',
    claim_success: '空投领取成功（营销钱包已划转）', trade_limited: '交易已限制',
    stat_price: 'SPARK 价格', stat_marketcap: '市值', stat_holders: '持币地址', stat_airdrop_pool: '空投池', stat_total_claims: '已领取',
    ai_placeholder: '输入你的问题...', chat_placeholder: '输入消息...',
  },
  en: {
    connect_wallet: 'Connect Wallet', disconnect: 'Disconnect', connect_success: 'Wallet connected', connect_failed: 'Connect failed',
    pick_wallet: 'Multiple wallets detected, please choose', chain_changed: 'Chain changed', disconnected: 'Disconnected',
    need_wallet_first: 'Please connect wallet first', no_goods: 'No goods yet — list one after connecting wallet', buy: 'Buy',
    order_created: 'Order created (C2C escrow)', watch_earn: 'Watch & Earn', reward_get: 'Reward earned',
    market_error: 'Market load failed', no_upgrade: 'No proposal — run self-check first', enter_pat: 'Enter GitHub PAT (ghp_...)',
    upgrade_deployed: 'Upgrade proposal committed, awaiting GitHub Pages publish', admin_login_success: 'Admin logged in',
    claim_success: 'Airdrop claimed (marketing wallet paid)', trade_limited: 'Trade restricted',
    stat_price: 'SPARK Price', stat_marketcap: 'Market Cap', stat_holders: 'Holders', stat_airdrop_pool: 'Airdrop Pool', stat_total_claims: 'Claimed',
    ai_placeholder: 'Ask me anything...', chat_placeholder: 'Type a message...',
  },
};

// 全局暴露（HTML 内联 onclick 用）
window.app = app;
window.addEventListener('DOMContentLoaded', () => app.init());
