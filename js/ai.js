/* ===== Web3 AI 助手（本地免费，无需 API Key） =====
 * - 规则引擎 + SPARK 知识库，离线可用
 * - 自动学习：收集用户问答，生成「升级候选」，由管理员手动确认（见 upgrade.js）
 */
window.AI = (function () {
  const KB = [
    { keys:['空投','airdrop','领币','claim'], ans:()=>`${I18n.t('airdrop_desc')}\n\n步骤：① 连接 MetaMask → ② 填入你的地址（可带邀请人）→ ③ 确认 ETH 链上交易并自付 Gas → ④ 等待区块确认。营销钱包余额 < 100,000 SPARK 时空投自动暂停。` },
    { keys:['邀请','invite','推广','拉新'], ans:()=>`邀请一人奖励 ${ethers.utils.formatUnits(SPARK.AIRDROP.inviteReward,SPARK.TOKEN.decimals)} SPARK。分享带 ?ref=你的地址 的链接，好友领取后你自动获得奖励，邀请链深度上限 3 层（防传销）。` },
    { keys:['钱包','wallet','metamask','连接'], ans:()=>'请使用 MetaMask 等 EIP-1193 钱包。点击右上角「连接钱包」，授权后即可领取空投、兑换商城。切勿向任何人透露私钥/助记词！' },
    { keys:['gas','手续费','费用','fee'], ans:()=>'领取空投需在以太坊主网提交交易，用户自理 Gas（ETH）。这是去中心化设计：项目方只向营销钱包充值，不代收费用。' },
    { keys:['合约','contract','地址','scam'], ans:()=>`SPARK 合约地址：0xD580C7C9Cde5ce776fEed844310330A2a40078d9。请仅认准此地址，谨防假代币。` },
    { keys:['代币','token','spark','用途'], ans:()=>'SPARK 是营销回流代币：买卖各收 5% 税自动注入资金池回流，支撑币价。总供应量 9,999,999,999,999,999,999,999,999。' },
    { keys:['去中心化','decentralized','抗审查'], ans:()=>'本应用数据通过 GunDB P2P 网络 + IPFS 分布式存储同步，无需中心服务器；空投名单为公开账本，任何用户可提交、可验证。' },
    { keys:['商城','shop','兑换'], ans:()=>'商城支持 SPARK / 积分兑换 NFT、VIP、周边、空投加成卡、AI Pro、治理权等。兑换记录上链/分布式存储。' },
    { keys:['行情','价格','price','market'], ans:()=>'行情页同步币安/Coingecko 前 50 币种，SPARK 固定置顶。数据每 60 秒刷新，免费无需 API Key。' },
    { keys:['app','下载','安卓','apk'], ans:()=>'APP 页面提供安卓 APK 下载，基于 Capacitor 打包，支持钱包/空投/聊天/行情/商城/AI。iOS 请使用网页版。' },
    { keys:['管理员','admin','升级','upgrade'], ans:()=>'管理员通过密码登录（密码以哈希存储，不暴露明文）。AI 自动学习的改动需管理员在弹窗中手动确认后才应用。' },
    { keys:['防作弊','反女巫','anti','cheat'], ans:()=>'四重防护：① 单地址仅领一次 ② 邀请链深度≤3 ③ Merkle 白名单 ④ 营销钱包余额阈值暂停。' },
    { keys:['hello','hi','你好','帮助','help'], ans:()=>'你好！我是 SPARK AI 助手。可以问我：空投怎么领、邀请奖励、钱包连接、手续费、合约地址、商城、行情、APP 下载等。' }
  ];

  function reply(input){
    const q = (input||'').toLowerCase().trim();
    if (!q) return I18n.cur==='zh' ? '请输入你的问题～' : 'Please ask something~';
    // 精确/关键词匹配
    for (const item of KB){
      if (item.keys.some(k => q.includes(k.toLowerCase()))) return item.ans();
    }
    // 兜底：基于本地关键词的通用回答（模拟"学习"）
    return (I18n.cur==='zh'
      ? `我已记录你的问题「${input}」，会用于后续 AI 升级候选。当前我可回答空投、邀请、钱包、合约、商城、行情、APP 等主题，请换种问法试试。`
      : `I recorded your question "${input}" for future upgrade candidates. I can answer airdrop, invite, wallet, contract, shop, market, APP topics — please rephrase.`);
  }

  function send(){
    const inp = document.getElementById('aiInput'); if (!inp) return;
    const q = inp.value.trim(); if (!q) return;
    addMsg(q, 'user');
    inp.value = '';
    setTimeout(() => addMsg(reply(q), 'bot'), 400);
    // 自学习：记录问答对 -> 升级候选
    Learn.record(q, reply(q));
  }

  function addMsg(text, role){
    const box = document.getElementById('aiMessages'); if (!box) return;
    box.innerHTML += `<div class="ai-msg ${role}">${text.replace(/\n/g,'<br>')}</div>`;
    box.scrollTop = box.scrollHeight;
  }

  function suggestions(){
    const box = document.getElementById('aiSuggest'); if (!box) return;
    const sug = I18n.cur==='zh'
      ? ['空投怎么领？','邀请奖励多少？','合约地址？','手续费谁出？','怎么下载APP？']
      : ['How to claim?','Invite reward?','Contract address?','Who pays gas?','Download APP?'];
    box.innerHTML = sug.map(s => `<button onclick="AI.ask('${s}')">${s}</button>`).join('');
  }

  function ask(q){ const inp = document.getElementById('aiInput'); if (inp){ inp.value = q; send(); } }

  return { send, ask, reply, suggestions, addMsg };
})();

/* ===== AI 自学习（自动收集问答，生成升级候选，等待管理员确认） ===== */
window.Learn = (function () {
  const KEY = 'ai-learnings';
  let buffer = [];

  function init(){ Storage.get(KEY, v => { if (v && Array.isArray(v)) buffer = v; }); }

  function record(question, answer){
    buffer.push({ question, answer, time: Date.now(), lang: I18n.cur });
    if (buffer.length > 200) buffer = buffer.slice(-200);
    Storage.put(KEY, buffer);
    // 每积累一定量，触发升级候选检测
    if (buffer.length % 5 === 0) Upgrade.check();
  }

  // 生成"升级候选"：对高频问题聚类，产出新规则（演示：简单统计 top 关键词）
  function generateCandidate(){
    const freq = {};
    buffer.forEach(e => { const words = (e.question||'').split(/\s+/); words.forEach(w=>{ if(w.length>1) freq[w]=(freq[w]||0)+1; }); });
    const top = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,5).map(e=>e[0]).join(', ');
    return {
      id: Date.now(),
      title: I18n.cur==='zh' ? `AI 自学习更新 #${Math.floor(buffer.length/5)}` : `AI Self-Learn Update #${Math.floor(buffer.length/5)}`,
      summary: I18n.cur==='zh' ? `基于 ${buffer.length} 条问答，新增高频关键词覆盖：${top}` : `Based on ${buffer.length} QAs, add高频 keywords: ${top}`,
      changes: [
        { file:'js/ai.js', before:`// 知识库条目：${KB_LEN()} 条`, after:`// 知识库条目：${KB_LEN()+1} 条（自动扩展）` },
        { file:'js/ai.js', before:'兜底通用回答', after:`兜底 + 高频词「${top}」专项应答` }
      ],
      bufferSize: buffer.length
    };
  }

  function KB_LEN(){ return window.AI ? 13 : 0; } // 当前 KB 条目数

  return { init, record, generateCandidate, buffer:()=>buffer };
})();
