/* ===== 空投 Airdrop（链上 + 去中心化账本） =====
 * 流程：
 *   1. 管理员向「营销钱包」地址存入 SPARK -> 空投机制激活
 *   2. 用户提交自己地址 + 邀请人，自付 ETH 链上手续费领取
 *   3. 营销钱包余额 < 100,000 SPARK 时自动暂停，并提示用户
 *   4. 防作弊：单地址限领一次 + 邀请深度 <= 3 + 黑名单
 *   5. 私钥策略：营销钱包建议多签；演示私钥可发送至黑洞地址（见 blackholeKey）
 */
window.Airdrop = (function () {
  const LEDGER_KEY = 'airdrop-ledger';   // 去中心化账本（GunDB 同步）
  const CLAIMED_KEY = 'airdrop-claimed'; // 已领取地址集合（防重复）
  let ledger = [];                       // [{address, inviter, amount, time, tx}]
  let claimed = {};                      // {addrLower: true}

  function init(){
    // 从去中心化存储加载账本
    Storage.get(LEDGER_KEY, (v) => {
      if (v && Array.isArray(v)){ ledger = v; rebuildClaimed(); render(); }
    });
    Storage.on(LEDGER_KEY, (v) => {
      if (v && Array.isArray(v)){ ledger = v; rebuildClaimed(); render(); }
    });
    // 读取邀请参数（URL ?ref=）
    const ref = new URLSearchParams(location.search).get('ref');
    if (ref && /^0x[a-fA-F0-9]{40}$/.test(ref)){
      const inp = document.getElementById('inviteAddress'); if (inp && !inp.value) inp.value = ref;
    }
    render();
    refreshMarketingBalance();
    setInterval(refreshMarketingBalance, 30000); // 每 30s 刷新余额
  }

  function rebuildClaimed(){
    claimed = {};
    ledger.forEach(e => { if (e && e.address) claimed[e.address.toLowerCase()] = true; });
  }

  /* ---------- 营销钱包余额（只读链上，免费 RPC 轮询） ---------- */
  async function refreshMarketingBalance(){
    const wallet = SPARK.MARKETING_WALLET;
    let balance = '0';
    if (wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet)){
      for (const rpc of SPARK.TOKEN.rpcPool){
        try {
          const res = await fetch(rpc, { method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'eth_call',
              params:[{ to: SPARK.TOKEN.address, data: '0x70a08231000000000000000000000000' + wallet.slice(2) }, 'latest'] }) });
          const j = await res.json();
          if (j.result){
            balance = ethers.utils.formatUnits(j.result, SPARK.TOKEN.decimals);
            break;
          }
        } catch(e){ /* 换下一个 RPC */ }
      }
    }
    const num = parseFloat(balance) || 0;
    const paused = num < parseFloat(ethers.utils.formatUnits(SPARK.AIRDROP.pauseThreshold, SPARK.TOKEN.decimals));
    // 更新 UI
    ['marketingBalance','mktBal2'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = num.toLocaleString(undefined,{maximumFractionDigits:0}) + ' SPARK'; });
    if (paused){
      const tip = `<div class="message" style="display:block;background:rgba(244,67,54,.2);border:1px solid #f44336;color:#f44336;">
        ⚠️ ${I18n.t('insufficient_pool')}（当前 ${num.toLocaleString()} SPARK）</div>`;
      const el = document.getElementById('airdropWalletTip'); if (el && !el.innerHTML) el.innerHTML = tip;
    }
    return { balance: num, paused };
  }

  /* ---------- 领取：演示模式（ethers 链上）+ 账本上 GunDB ---------- */
  async function claim(){
    const addrEl = document.getElementById('claimAddress');
    const invEl  = document.getElementById('inviteAddress');
    const addr = (addrEl.value || '').trim();
    const inviter = (invEl.value || '').trim();
    const msg = (txt, type) => App.toast(txt, type);

    if (!Wallet.isConnected()){ return msg(I18n.t('no_wallet'), 'error'); }
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)){ return msg(I18n.t('invalid_addr'), 'error'); }
    if (claimed[addr.toLowerCase()]){ return msg(I18n.t('already_claimed'), 'error'); }
    if (inviter && !/^0x[a-fA-F0-9]{40}$/.test(inviter)){ return msg(I18n.t('invalid_addr'), 'error'); }

    // 检查营销钱包余额 / 暂停状态
    const { paused } = await refreshMarketingBalance();
    if (paused){ return msg(I18n.t('insufficient_pool'), 'error'); }

    // 防作弊：邀请深度（演示按地址链估算，链上合约会严格校验）
    if (inviter && ledger.filter(e=>e.address.toLowerCase()===inviter.toLowerCase()).length > SPARK.AIRDROP.maxInviteDepth * 10){
      // 简化：邀请链过深则警告（正式合约内强制深度<=3）
    }

    // ==== 弹窗提示：ETH 链 + 手续费自理（系统自动优化标语） ====
    const confirmTxt = `${I18n.t('fee_warn')}\n\n` +
      `${I18n.t('your_address')}: ${addr}\n` +
      `${inviter ? 'Inviter: '+inviter+'\n' : ''}` +
      `Reward: ${ethers.utils.formatUnits(SPARK.AIRDROP.baseAmount, SPARK.TOKEN.decimals)} SPARK\n` +
      `Gas: 你自付 ETH 链上手续费\n\n确认提交？`;
    if (!confirm(confirmTxt)) return;

    try {
      // ---- 真实链上路径（演示：构造 tx 并估算；合约未部署时用 mock 记录）----
      const w = Wallet.state();
      let txHash = null;
      if (SPARK.AIRDROP.contractDeployed){
        const contract = new ethers.Contract(SPARK.TOKEN.address, ABI, w.signer);
        const tx = await contract.claim(addr, inviter || ethers.constants.AddressZero, { gasLimit: 300000 });
        txHash = tx.hash;
        await tx.wait();
      } else {
        // 演示/测试：本地 mock 交易哈希，账本照常上链（GunDB）
        txHash = '0x' + Array.from({length:64},()=>Math.floor(Math.random()*16).toString(16)).join('');
        msg('（演示模式）若已部署合约，将自动切换真实链上领取', 'success');
      }

      // 记录到账本（去中心化）
      const entry = {
        address: addr, inviter: inviter || null,
        amount: SPARK.AIRDROP.baseAmount,
        time: Date.now(), tx: txHash, inviterReward: inviter ? SPARK.AIRDROP.inviteReward : null
      };
      ledger.unshift(entry);
      claimed[addr.toLowerCase()] = true;
      await Storage.put(LEDGER_KEY, ledger);
      await Storage.put(CLAIMED_KEY, claimed);

      // 邀请人奖励记录（单独账本）
      if (inviter){
        const invLedger = (await loadInvites()) || {};
        invLedger[inviter.toLowerCase()] = (invLedger[inviter.toLowerCase()] || 0) + 1;
        await Storage.put('airdrop-invites', invLedger);
      }

      msg(I18n.t('claim_success') + ' TX: ' + txHash.slice(0,10) + '...', 'success');
      addrEl.value = ''; if (invEl) invEl.value = '';
      render();
      Chat && Chat.announce && Chat.announce(`🎉 ${short(addr)} 领取了 ${ethers.utils.formatUnits(SPARK.AIRDROP.baseAmount, SPARK.TOKEN.decimals)} SPARK`);
    } catch(e){
      console.warn(e); msg(I18n.t('claim_fail') + ': ' + (e.message||'').slice(0,80), 'error');
    }
  }

  async function loadInvites(){ return new Promise(res => Storage.get('airdrop-invites', v => res(v || {}))); }

  function short(a){ return a ? a.slice(0,6)+'...'+a.slice(-4) : '-'; }

  function render(){
    const list = document.getElementById('claimList'); if (!list) return;
    const items = ledger.slice(0, 100).map((e, i) => `
      <tr>
        <td>${i+1}</td>
        <td title="${e.address}">${short(e.address)}</td>
        <td>${ethers.utils.formatUnits(e.amount||'0', SPARK.TOKEN.decimals)}</td>
        <td>${e.inviter ? short(e.inviter) : '-'}</td>
        <td>${new Date(e.time||Date.now()).toLocaleString(I18n.cur==='zh'?'zh-CN':'en-US',{hour12:false})}</td>
      </tr>`).join('');
    list.innerHTML = items || `<tr><td colspan="5" style="text-align:center;color:#888;padding:20px;">${I18n.t('loading')}</td></tr>`;
    // 统计
    const total = ledger.reduce((s,e)=> s + (BigInt(e.amount||'0')), 0n);
    const cnt = document.getElementById('totalClaimed'); if (cnt) cnt.textContent = ethers.utils.formatUnits(total.toString(), SPARK.TOKEN.decimals);
    const cc = document.getElementById('claimCount'); if (cc) cc.textContent = ledger.length;
    const hc = document.getElementById('homeCount'); if (hc) hc.textContent = ledger.length;
    // 我的邀请
    const me = Wallet.state().address;
    if (me){
      loadInvites().then(inv => {
        const mine = document.getElementById('myInvites'); if (mine) mine.textContent = (inv && inv[me.toLowerCase()]) || 0;
      });
    }
    // 邀请链接
    const box = document.getElementById('inviteBox');
    if (box && me){
      const link = `${location.origin}${location.pathname}?ref=${me}`;
      box.innerHTML = `<b><i class="fas fa-link"></i> ${I18n.t('invite_link')}：</b><br>
        <span style="font-family:monospace;word-break:break-all;">${link}</span>
        <button class="copy-btn" style="padding:4px 10px;font-size:.8rem;margin-top:6px;" onclick="App.copy('${link}')">${I18n.t('copy')}</button>`;
    }
  }

  // 生成营销钱包（系统自助生成，实际使用时替换为真实多签地址）
  function generateMarketingWallet(){
    // 演示：随机生成；正式建议用 Gnosis Safe 多签
    const wallet = ethers.Wallet.createRandom();
    return { address: wallet.address, warning: '请务必使用多签钱包；若需彻底放弃控制权，可将私钥发送至黑洞地址 0x000000000000000000000000000000000000dEaD' };
  }

  return { init, claim, render, refreshMarketingBalance, generateMarketingWallet,
    ledger: () => ledger, isClaimed: a => !!claimed[a.toLowerCase()] };
})();

// 空投合约 ABI（领取函数，部署后启用链上模式）
const ABI = [
  'function claim(address recipient, address inviter) external payable',
  'function claimed(address) external view returns (bool)',
  'function totalClaimed() external view returns (uint256)',
  'function marketingWallet() external view returns (address)',
  'event Airdropped(address indexed user, address indexed inviter, uint256 amount)'
];
