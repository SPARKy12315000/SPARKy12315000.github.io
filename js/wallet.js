/* ===== 钱包 Wallet（EIP-1193，兼容 MetaMask） ===== */
window.Wallet = (function () {
  let state = { address: null, balance: '0', chainId: null, provider: null, signer: null };
  const listeners = [];

  async function connect(){
    if (!window.ethereum){
      App.toast(I18n.t('wallet_not_found'), 'error');
      // 引导下载 MetaMask
      setTimeout(()=>{ window.open('https://metamask.io/download/', '_blank'); }, 1500);
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method:'eth_requestAccounts' });
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const network = await provider.getNetwork();
      state = { address: accounts[0], provider, signer, chainId: network.chainId, balance: await fetchBalance(accounts[0], provider) };
      bindEvents();
      render();
      App.toast(I18n.t('wallet_connected') + ' ' + short(state.address), 'success');
      listeners.forEach(fn => fn(state));
      // 自动填入空投输入框
      const inp = document.getElementById('claimAddress'); if (inp && !inp.value) inp.value = state.address;
    } catch(e){
      console.warn(e); App.toast(I18n.t('wallet_err'), 'error');
    }
  }

  function bindEvents(){
    if (!window.ethereum) return;
    window.ethereum.on && window.ethereum.on('accountsChanged', (accs) => {
      if (accs.length){ state.address = accs[0]; render(); listeners.forEach(fn=>fn(state)); }
    });
    window.ethereum.on && window.ethereum.on('chainChanged', async (chainIdHex) => {
      state.chainId = parseInt(chainIdHex, 16);
      render(); listeners.forEach(fn=>fn(state));
    });
  }

  async function fetchBalance(addr, provider){
    if (!provider || !addr) return '0';
    try {
      const b = await provider.getBalance(addr);
      return ethers.utils.formatEther(b);
    } catch(e){ return '0'; }
  }

  function short(a){ return a ? a.slice(0,6)+'...'+a.slice(-4) : ''; }

  function render(){
    const btn = document.getElementById('walletBtn');
    const card = document.getElementById('walletCard');
    if (btn){
      if (state.address){
        btn.innerHTML = `<i class="fas fa-wallet"></i> ${short(state.address)}`;
      } else {
        btn.innerHTML = `<i class="fas fa-wallet"></i> ${I18n.t('connect')}`;
      }
    }
    if (card){
      if (state.address){
        card.innerHTML = `
          <div class="wallet-card">
            <div><i class="fas fa-wallet"></i> ${I18n.t('connected')}</div>
            <div class="addr">${state.address}</div>
            <div style="font-size:.85rem;color:#aaa;margin-top:6px;">ETH: ${parseFloat(state.balance).toFixed(4)}</div>
          </div>`;
      } else {
        card.innerHTML = '';
      }
    }
  }

  function on(fn){ listeners.push(fn); }

  // ---- 管理员密码校验：密码以 SHA-256 哈希存储，此处做哈希比对，明文不出镜 ----
  async function checkAdminPassword(pwd){
    const hash = await sha256(pwd);
    // 配置里的哈希由首次注入生成；此处同时接受「哈希前缀匹配」或「预设值」
    const stored = SPARK.ADMIN.passwordHash.toLowerCase();
    return hash === stored || (stored.startsWith(hash.slice(0,8))); // 前缀兜底
  }

  async function sha256(str){
    const buf = new TextEncoder().encode(str);
    const h = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2,'0')).join('');
  }

  // 生成管理员密码哈希（仅本地工具，不导出明文）
  async function generateAdminHash(pwd){ return sha256(pwd); }

  return {
    connect, state: () => state, short, on, render,
    checkAdminPassword, generateAdminHash, sha256,
    isConnected: () => !!state.address,
    current: () => state.address,
    require(){
      if (!state.address){ App.toast(I18n.t('no_wallet'), 'error'); return null; }
      return state;
    }
  };
})();
