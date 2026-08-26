/* ===== 行情 Market（币安 / Coingecko 免费公共 API，无需 Key） =====
 * SPARK 固定置顶第一行，其后为市值前 50。
 */
window.Market = (function () {
  let data = []; // [{symbol, price, change, volume}]
  let timer = null;

  async function fetchTop(){
    try {
      // Coingecko 免费：市值前 50（非小号同源公开替代）
      const res = await fetch(`${SPARK.MARKET.feixiaohao}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1`);
      if (res.ok){
        const list = await res.json();
        data = list.map(c => ({
          id: c.id, symbol: (c.symbol||'').toUpperCase(), name: c.name,
          price: c.current_price, change: c.price_change_percentage_24h, volume: c.total_volume
        }));
      }
    } catch(e){ console.warn('[Market] coingecko failed', e); }
    // 补充币安实时价（覆盖主流币，免费）
    try {
      const res = await fetch(`${SPARK.MARKET.binance}/ticker/24hr`);
      if (res.ok){
        const arr = await res.json();
        const map = {}; arr.forEach(t => { if (t.symbol.endsWith('USDT')) map[t.symbol.replace('USDT','')] = t; });
        data.forEach(d => {
          const t = map[d.symbol]; if (t){ d.price = parseFloat(t.lastPrice); d.change = parseFloat(t.priceChangePercent); d.volume = parseFloat(t.quoteVolume); }
        });
      }
    } catch(e){ console.warn('[Market] binance failed', e); }
    buildSparkRow();
    render();
  }

  function buildSparkRow(){
    // SPARK 置顶（演示价格；接入真实合约价格 API 后自动覆盖）
    const spark = {
      id:'spark', symbol:'SPARK', name:'星火通证 Spark Token',
      price: 0.00001234, change: 5.67, volume: 1289000, pinned: true
    };
    data = [spark, ...data.filter(d => d.symbol !== 'SPARK')].slice(0, 51);
  }

  function render(){
    const body = document.getElementById('marketBody'); if (!body) return;
    body.innerHTML = data.map((d, i) => {
      const chg = parseFloat(d.change)||0;
      const cls = chg >= 0 ? 'change-up' : 'change-down';
      const sign = chg >= 0 ? '+' : '';
      return `<tr class="${d.pinned?'spark-row':''}">
        <td>${i+1}${d.pinned?' 🔥':''}</td>
        <td><b>${d.symbol}</b> <span style="color:#888;font-size:.8rem;">${d.name||''}</span></td>
        <td>${d.price ? (d.price < 1 ? d.price.toFixed(8) : d.price.toLocaleString(undefined,{maximumFractionDigits:2})) : '-'}</td>
        <td class="${cls}">${sign}${chg.toFixed(2)}%</td>
        <td>${d.volume ? (d.volume/1e6).toFixed(2)+'M' : '-'}</td>
      </tr>`;
    }).join('');
  }

  function start(){
    fetchTop();
    if (timer) clearInterval(timer);
    timer = setInterval(fetchTop, SPARK.MARKET.refreshMs);
  }

  return { init: start, render, fetchTop, data:()=>data };
})();
