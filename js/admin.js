/* ===== 管理员 Admin（密码登录，哈希校验，密码明文不出镜） =====
 * 登录方式：管理员密码（与用户钱包登录分离）
 * 安全：密码 → SHA-256 后与配置哈希比对；登录态 24h 会话
 * 功能：数据导出、刷新、清空、生成营销钱包（多签/黑洞私钥策略）
 */
window.Admin = (function () {
  const SESSION_KEY = 'admin-session';
  let loggedIn = false;

  function open(){
    if (loggedIn){ showPanel(); return; }
    document.getElementById('adminLoginModal').classList.add('show');
    setTimeout(()=>{ const p=document.getElementById('adminPwd'); if(p) p.focus(); }, 100);
  }
  function closeLogin(){ document.getElementById('adminLoginModal').classList.remove('show'); }

  async function login(){
    const pwd = document.getElementById('adminPwd').value;
    if (!pwd){ App.toast(I18n.t('admin_pwd_placeholder'), 'error'); return; }
    const ok = await Wallet.checkAdminPassword(pwd);
    if (ok){
      loggedIn = true;
      localStorage.setItem(SESSION_KEY, JSON.stringify({ at: Date.now() }));
      closeLogin();
      document.getElementById('adminPwd').value = ''; // 立即清空，不留明文
      App.toast(I18n.t('welcome') + ' Admin', 'success');
      showPanel();
      Upgrade.check();
    } else {
      App.toast(I18n.t('login') + ' ❌', 'error');
      document.getElementById('adminPwd').value = '';
    }
  }

  function logout(){ loggedIn=false; localStorage.removeItem(SESSION_KEY); App.toast(I18n.t('logout'), 'success'); hidePanel(); }

  function isLoggedIn(){
    if (loggedIn) return true;
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY)||'{}');
      if (s.at && (Date.now() - s.at) < SPARK.ADMIN.sessionHours*3600*1000){ loggedIn=true; return true; }
    } catch(e){}
    return false;
  }

  function showPanel(){
    let panel = document.getElementById('adminPanel');
    if (!panel){
      panel = document.createElement('div');
      panel.id = 'adminPanel';
      panel.className = 'admin-panel';
      panel.innerHTML = `
        <h3 style="color:var(--accent);text-align:center;"><i class="fas fa-user-shield"></i> ${I18n.t('admin_panel')}</h3>
        <div class="admin-controls">
          <button class="admin-btn" onclick="Admin.exportCSV()"><i class="fas fa-download"></i> ${I18n.t('copy')} CSV</button>
          <button class="admin-btn" onclick="Airdrop.render();Market.fetchTop()"><i class="fas fa-sync-alt"></i> ${I18n.t('ok')}</button>
          <button class="admin-btn" onclick="Admin.genWallet()"><i class="fas fa-wallet"></i> ${I18n.cur==='zh'?'生成营销钱包':'Gen Marketing Wallet'}</button>
          <button class="admin-btn" onclick="Admin.showLogs()"><i class="fas fa-history"></i> ${I18n.cur==='zh'?'升级日志':'Upgrade Log'}</button>
          <button class="admin-btn" onclick="Admin.clearAll()" style="border-color:#f44336;color:#f44336;"><i class="fas fa-trash"></i> ${I18n.t('cleared')}</button>
          <button class="admin-btn" onclick="Admin.logout()"><i class="fas fa-sign-out-alt"></i> ${I18n.t('logout')}</button>
        </div>
        <div id="adminData" style="max-height:300px;overflow:auto;background:rgba(0,0,0,.25);border-radius:10px;padding:10px;font-family:monospace;font-size:.8rem;"></div>`;
      document.querySelector('.container').insertBefore(panel, document.querySelector('.footer'));
    }
    panel.style.display = 'block';
    renderData();
  }
  function hidePanel(){ const p=document.getElementById('adminPanel'); if(p) p.style.display='none'; }

  function renderData(){
    const el = document.getElementById('adminData'); if (!el) return;
    Storage.get('airdrop-ledger', v => {
      const list = (v && Array.isArray(v)) ? v : [];
      el.innerHTML = `<div style="color:#FFD700;margin-bottom:6px;">${I18n.t('leaderboard')}: ${list.length}</div>` +
        list.slice(0,50).map((e,i)=> `<div>${i+1}. ${e.address} | ${ethers.utils.formatUnits(e.amount||'0',SPARK.TOKEN.decimals)} | ${new Date(e.time).toLocaleString()}</div>`).join('');
    });
  }

  function exportCSV(){
    Storage.get('airdrop-ledger', v => {
      const list = (v && Array.isArray(v)) ? v : [];
      if (!list.length){ App.toast(I18n.t('loading'), 'error'); return; }
      const rows = [['address','inviter','amount','time','tx']];
      list.forEach(e => rows.push([e.address, e.inviter||'', ethers.utils.formatUnits(e.amount||'0',SPARK.TOKEN.decimals), new Date(e.time).toISOString(), e.tx||'']));
      const csv = rows.map(r => r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
      const blob = new Blob(['\ufeff'+csv], {type:'text/csv'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `spark-airdrop-${new Date().toISOString().slice(0,10)}.csv`; a.click();
      App.toast(I18n.t('saved'), 'success');
    });
  }

  function clearAll(){
    if (!confirm(I18n.cur==='zh'?'确定清空所有本地/分布式数据？此操作仅影响本端索引，链上数据不可撤销。':'Clear all local data? On-chain data is irreversible.')) return;
    ['airdrop-ledger','airdrop-claimed','airdrop-invites','shop-orders','ai-learnings'].forEach(k=> localStorage.removeItem('spark-dapp:'+k));
    App.toast(I18n.t('cleared'), 'success'); renderData();
  }

  // 生成营销钱包：建议多签；若需彻底放弃控制权，私钥发送至黑洞地址
  function genWallet(){
    const r = Airdrop.generateMarketingWallet();
    App.toast(I18n.cur==='zh' ? `新地址：${r.address}（建议用 Gnosis Safe 多签；私钥可发送至黑洞 0x...dEaD 永久锁定）` : `New: ${r.address}`, 'success');
    console.info('[Admin] 营销钱包策略:', r.warning);
  }

  function showLogs(){
    Storage.get('upgrade-log', v => {
      alert(I18n.cur==='zh' ? '升级日志（最新）:\n' + JSON.stringify(v, null, 2) : 'Upgrade log:\n' + JSON.stringify(v, null, 2));
    });
  }

  return { open, closeLogin, login, logout, isLoggedIn, exportCSV, clearAll, genWallet, showLogs, renderData };
})();
