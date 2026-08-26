/* ===== 商城 Shop（SPARK / 积分兑换，演示） ===== */
window.Shop = (function () {
  const PRODUCTS = [
    { id:'nft-avatar', name_zh:'SPARK 创世 NFT 头像', name_en:'SPARK Genesis NFT Avatar', price:50000000, stock:1000, icon:'fa-image' },
    { id:'vip', name_zh:'社区 VIP 身份（1年）', name_en:'Community VIP (1yr)', price:20000000, stock:5000, icon:'fa-crown' },
    { id:'merch', name_zh:'SPARK 周边礼盒', name_en:'SPARK Merch Box', price:100000000, stock:200, icon:'fa-gift' },
    { id:'airdrop-boost', name_zh:'空投加成卡（邀请奖励 x2）', name_en:'Airdrop Boost (2x invite)', price:30000000, stock:999, icon:'fa-rocket' },
    { id:'ai-pro', name_zh:'AI 助手 Pro 版（30天）', name_en:'AI Assistant Pro (30d)', price:15000000, stock:9999, icon:'fa-robot' },
    { id:'governance', name_zh:'治理投票权（季度）', name_en:'Governance Vote (Quarter)', price:80000000, stock:300, icon:'fa-vote-yea' }
  ];

  function render(){
    const grid = document.getElementById('shopGrid'); if (!grid) return;
    const lang = I18n.cur;
    grid.innerHTML = PRODUCTS.map(p => `
      <div class="shop-item">
        <i class="fas ${p.icon}" style="font-size:2rem;color:#FFD700;"></i>
        <div style="margin:8px 0;font-weight:bold;">${lang==='zh'?p.name_zh:p.name_en}</div>
        <div class="price">${ethers.utils.formatUnits(p.price.toString(), SPARK.TOKEN.decimals)} SPARK</div>
        <div class="stock">${I18n.t('stock')}: ${p.stock}</div>
        <button class="button" style="margin-top:10px;padding:6px 16px;font-size:.9rem;" onclick="Shop.buy('${p.id}')">
          <i class="fas fa-shopping-cart"></i> ${I18n.t('buy')}
        </button>
      </div>`).join('');
  }

  async function buy(id){
    const p = PRODUCTS.find(x => x.id === id); if (!p) return;
    if (!Wallet.require()) return;
    if (!confirm(`${I18n.cur==='zh'?'确认兑换':'Confirm'}: ${I18n.cur==='zh'?p.name_zh:p.name_en}？`)) return;
    // 记录到去中心化存储（演示，实际应链上结算）
    const orders = (await new Promise(res => Storage.get('shop-orders', v => res(v || [])))) ;
    orders.unshift({ id: Date.now(), product: id, user: Wallet.state().address, time: Date.now() });
    await Storage.put('shop-orders', orders);
    App.toast(`✅ ${I18n.t('buy')} ${ethers.utils.formatUnits(p.price.toString(), SPARK.TOKEN.decimals)} SPARK`, 'success');
    p.stock--;
    render();
  }

  return { render, buy };
})();
