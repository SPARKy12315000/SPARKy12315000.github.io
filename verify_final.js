// 最终验证：前端 mock 数据结构 + 渲染逻辑 + 后端真实 API 三者对齐
const pairs = ['SPARK/ETH', 'SPARK/USDT', 'SPARK/BNB'];

function generateMockKlines(){ let p=0.85; const arr=[]; const now=Date.now(); for(let i=0;i<60;i++){const o=p;p*=1+(Math.random()-0.5)*0.02;arr.push({time:now-i*60000,open:o,high:Math.max(o,p)*1.001,low:Math.min(o,p)*0.999,close:p,volume:Math.random()*1000});} return arr.reverse(); }
function mockTicker(pair){ const base={ 'SPARK/ETH':0.00042,'SPARK/USDT':0.85,'SPARK/BNB':0.00135 }[pair]||1; const change=(Math.random()-0.5)*8; return { pair, price:base*(1+change/100), change24h:change, volume24h:Math.random()*50000+10000, high:base*1.05, low:base*0.95, time:Date.now() }; }
function mockOrderBook(pair){ const mid={ 'SPARK/ETH':0.00042,'SPARK/USDT':0.85,'SPARK/BNB':0.00135 }[pair]||1; const asks=[],bids=[]; for(let i=0;i<10;i++){asks.push({price:+(mid*(1+(i+1)*0.002)).toFixed(8),amount:+(Math.random()*2000+100).toFixed(2)});bids.push({price:+(mid*(1-(i+1)*0.002)).toFixed(8),amount:+(Math.random()*2000+100).toFixed(2)});} return {pair,asks,bids}; }
function mockDepth(pair){ const mid={ 'SPARK/ETH':0.00042,'SPARK/USDT':0.85,'SPARK/BNB':0.00135 }[pair]||1; const asks=[],bids=[]; for(let i=0;i<10;i++){asks.push([+(mid*(1+(i+1)*0.002)).toFixed(8),+(Math.random()*2000+100).toFixed(2)]);bids.push([+(mid*(1-(i+1)*0.002)).toFixed(8),+(Math.random()*2000+100).toFixed(2)]);} return {pair,asks,bids}; }

let pass=0, fail=0;
const assert=(c,m)=>{ if(c) pass++; else { fail++; console.log('  ✗ '+m); } };
const fmt=(n,d=4)=>Number(n||0).toFixed(d);

(async ()=>{
  // ===== A. 前端 mock 数据 + 渲染逻辑（对应 index.html）=====
  console.log('【A】前端 mock fallback + 渲染');
  // loadDepth 用元组解构 [p,a]
  const depth = mockDepth('SPARK/USDT');
  assert(Array.isArray(depth.asks)&&Array.isArray(depth.bids), 'depth 有 asks+bids');
  assert(Array.isArray(depth.asks[0]), 'depth.asks 是元组 [p,a]');
  const rowDepth=(arr,cls)=>arr.slice(0,8).map(([p,a])=>`${cls}:${fmt(p,6)}/${fmt(a,2)}`).join(' ');
  const dHtml = rowDepth(depth.asks,'down')+' '+rowDepth(depth.bids,'up');
  assert(dHtml.includes('down:')&&dHtml.includes('up:'), 'loadDepth 渲染正常');
  console.log('  ✓ loadDepth:', dHtml.slice(0,55)+'...');

  // loadOrderBook 用对象 o.price/o.amount
  const ob = mockOrderBook('SPARK/USDT');
  assert(ob.asks[0].price&&ob.asks[0].amount!==undefined, 'orderbook 是对象 {price,amount}');
  const rowOB=(arr,cls)=>arr.slice(0,8).map(o=>`${cls}:${fmt(o.price,6)}/${fmt(o.amount,2)}`).join(' ');
  const obHtml = rowOB(ob.asks,'down')+'|'+rowOB(ob.bids,'up');
  assert(obHtml.includes('|'), 'loadOrderBook 渲染正常');
  console.log('  ✓ loadOrderBook:', obHtml.slice(0,55)+'...');

  // loadTickers
  const tickers = pairs.map(mockTicker);
  assert(tickers.every(t=>t.price&&t.change24h!==undefined&&t.volume24h), 'ticker 字段完整');
  console.log('  ✓ loadTickers:', tickers.map(t=>t.pair+':'+t.price.toFixed(6)+' '+t.change24h.toFixed(2)+'%').join('  '));

  // drawKline fallback
  const kl = generateMockKlines();
  assert(kl.length===60&&kl[0].close!==undefined, 'klines 60根含 close');
  console.log('  ✓ drawKline: 60根');

  // ===== B. 后端真实 API 与前端渲染契约对齐 =====
  console.log('\n【B】后端真实 API（先下单填充订单簿，再校验结构）');
  const { matchingEngine } = await import('./server/engine.js');
  // 填充买卖盘：卖单挂 asks，买单留 bids（撮合后买卖两侧都有挂单）
  matchingEngine.placeOrder({ pair:'SPARK/USDT', side:'sell', price:0.0009, amount:50, user:'0xSELL' });
  matchingEngine.placeOrder({ pair:'SPARK/USDT', side:'buy',  price:0.0008, amount:30, user:'0xBUY' }); // 不穿越，留 bids
  matchingEngine.placeOrder({ pair:'SPARK/USDT', side:'sell', price:0.0010, amount:40, user:'0xSELL2' }); // 不穿越，留 asks
  const realDepth = matchingEngine.getDepth('SPARK/USDT');
  const realOB = matchingEngine.getOrderBook('SPARK/USDT');
  assert(realDepth.asks.length>0&&Array.isArray(realDepth.asks[0]), '后端 depth 是元组 [p,a]');
  assert(realDepth.bids.length>0&&Array.isArray(realDepth.bids[0]), '后端 depth bids 也是元组');
  assert(realOB.asks.length>0&&realOB.asks[0].price&&realOB.asks[0].amount!==undefined, '后端 orderbook 是对象 {price,amount}');
  console.log('  ✓ 后端 /api/depth: 元组 ✓', `(${realDepth.bids.length}档bids/${realDepth.asks.length}档asks)`);
  console.log('  ✓ 后端 /api/orderbook: 对象 ✓', `(${realOB.bids.length}档bids/${realOB.asks.length}档asks)`);

  console.log(`\n─────────────────────────────\n通过: ${pass}   失败: ${fail}`);
  process.exit(fail?1:0);
})();
