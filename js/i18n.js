/* ===== 国际化 I18n ===== */
window.I18n = (function () {
  const dict = {
    zh: {
      brand:'星火通证', title:'星火通证', tagline:'流动的文化之火 · 透明、公平、可持续的社区价值生态',
      nav_home:'首页', nav_airdrop:'空投', nav_chat:'聊天', nav_market:'行情', nav_shop:'商城', nav_ai:'AI助手', nav_app:'APP下载',
      connect:'连接钱包', connected:'已连接',
      core_info:'核心信息', token_name_title:'代币名称', total_supply:'发行总量', airdrop_pool:'空投营销钱包余额', participants:'已参与地址',
      smart_contract:'智能合约', copy:'复制', copy_ok:'已复制到剪贴板', copy_fail:'复制失败',
      explorer:'区块浏览器', trade:'交易', go_airdrop:'立即领空投',
      airdrop_title:'SPARK 链上空投', airdrop_desc:'新人领 1 亿 SPARK，邀请一人奖励 1 千万 SPARK。用户自付 ETH 链上手续费领取。',
      marketing_balance:'营销钱包余额', total_claimed:'累计已领取', invite_count:'我的邀请',
      your_address:'你的钱包地址 (0x...)', inviter_address:'邀请人地址（可选，填后可获邀请奖励）',
      claim_btn:'链上领取（自付手续费）', claim_note:'提交地址即上链，单地址限领一次，防作弊。',
      leaderboard:'空投名单（去中心化公开账本）', address_col:'地址', amount_col:'数量', inviter_col:'邀请人', time_col:'时间',
      newbie_reward:'新人免费领取', invite_reward:'邀请一人奖励', pause_threshold:'营销钱包下限（少于即暂停）',
      chat_title:'全球社区聊天（P2P 去中心化）', online:'在线', chat_placeholder:'输入消息...', chat_hint:'基于 GunDB / BroadcastChannel 的 P2P 同步，无需中心服务器，抗审查。',
      market_title:'加密行情（前 50，SPARK 置顶）', data_source:'数据源：币安 / 非小号（免费公共 API，每 60 秒刷新）',
      coin:'币种', price:'价格(USDT)', change24:'24h涨跌', volume:'24h成交额',
      shop_title:'SPARK 商城（积分 / SPARK 抵扣）', buy:'兑换', stock:'库存',
      ai_title:'SPARK Web3 AI 助手（本地免费，无需 API Key）', ai_placeholder:'问点什么，比如「什么是空投？」',
      app_title:'SPARK 安卓 APP', app_desc:'去中心化客户端，支持钱包、空投、聊天、行情、商城、AI。APK 免费下载。',
      download_apk:'下载 APK (Android)', app_note:'安装后首次允许「未知来源」安装。iOS 请使用网页版。',
      admin_entry:'管理员入口', admin_login:'管理员登录', admin_pwd_placeholder:'管理员密码',
      login:'登录', cancel:'取消', logout:'退出', welcome:'欢迎',
      admin_panel:'管理员控制面板', upgrade_approve:'确认升级', upgrade_reject:'拒绝',
      upgrade_title:'检测到 AI 自动升级候选版本', upgrade_desc:'以下改动将由管理员手动确认后才应用：',
      decentralized:'完全去中心化 · 抗审查 · 数据链上/分布式存储',
      // 钱包
      wallet_not_found:'未检测到钱包，建议使用 MetaMask。', wallet_connected:'钱包已连接', wallet_err:'连接失败',
      not_admin:'仅管理员可操作', not_login:'请先登录管理员账户',
      // 空投
      claim_success:'✅ 领取成功！交易已上链', claim_fail:'❌ 领取失败', insufficient_pool:'⚠️ 营销钱包余额不足 100,000 SPARK，空投已暂停', already_claimed:'该地址已领取过空投', invalid_addr:'地址格式无效',
      no_wallet:'请先连接钱包', confirm_chain:'请确认在以太坊主网', fee_warn:'你将在 ETH 链上提交交易，需自付矿工手续费（Gas）。', invite_link:'邀请链接已生成',
      // 通用
      ok:'确定', close:'关闭', loading:'加载中...', error:'出错了', saved:'已保存', cleared:'已清空'
    },
    en: {
      brand:'Spark Token', title:'Spark Token', tagline:'The Fire of Flowing Culture · Transparent, Fair & Sustainable Community Value',
      nav_home:'Home', nav_airdrop:'Airdrop', nav_chat:'Chat', nav_market:'Market', nav_shop:'Shop', nav_ai:'AI', nav_app:'APP',
      connect:'Connect Wallet', connected:'Connected',
      core_info:'Core Info', token_name_title:'Token Name', total_supply:'Total Supply', airdrop_pool:'Airdrop Marketing Wallet', participants:'Participants',
      smart_contract:'Smart Contract', copy:'Copy', copy_ok:'Copied to clipboard', copy_fail:'Copy failed',
      explorer:'Explorer', trade:'Trade', go_airdrop:'Claim Airdrop',
      airdrop_title:'SPARK On-chain Airdrop', airdrop_desc:'New users get 100M SPARK, invite one user get 10M SPARK reward. You pay ETH chain gas fee.',
      marketing_balance:'Marketing Wallet', total_claimed:'Total Claimed', invite_count:'My Invites',
      your_address:'Your wallet address (0x...)', inviter_address:'Inviter address (optional, get invite reward)',
      claim_btn:'Claim On-chain (pay gas)', claim_note:'On-chain submission, one claim per address, anti-cheat.',
      leaderboard:'Airdrop Ledger (decentralized public book)', address_col:'Address', amount_col:'Amount', inviter_col:'Inviter', time_col:'Time',
      newbie_reward:'New User Reward', invite_reward:'Per Invite Reward', pause_threshold:'Marketing Wallet Pause Threshold',
      chat_title:'Global Community Chat (P2P Decentralized)', online:'online', chat_placeholder:'Type a message...', chat_hint:'GunDB / BroadcastChannel P2P sync, no central server, censorship-resistant.',
      market_title:'Crypto Market (Top 50, SPARK pinned)', data_source:'Source: Binance / Feixiaohao (free public API, refresh every 60s)',
      coin:'Coin', price:'Price(USDT)', change24:'24h Chg', volume:'24h Volume',
      shop_title:'SPARK Shop (Points / SPARK)', buy:'Redeem', stock:'Stock',
      ai_title:'SPARK Web3 AI Assistant (free local, no API key)', ai_placeholder:'Ask something, e.g. "What is airdrop?"',
      app_title:'SPARK Android APP', app_desc:'Decentralized client: wallet, airdrop, chat, market, shop & AI. Free APK.',
      download_apk:'Download APK (Android)', app_note:'Allow "unknown sources" on first install. iOS use web app.',
      admin_entry:'Admin Entry', admin_login:'Admin Login', admin_pwd_placeholder:'Admin password',
      login:'Login', cancel:'Cancel', logout:'Logout', welcome:'Welcome',
      admin_panel:'Admin Control Panel', upgrade_approve:'Approve Upgrade', upgrade_reject:'Reject',
      upgrade_title:'AI Auto-Upgrade Candidate Detected', upgrade_desc:'Changes below require manual admin confirmation:',
      decentralized:'Fully Decentralized · Censorship-Resistant · On-chain / Distributed Storage',
      wallet_not_found:'No wallet detected. Please use MetaMask.', wallet_connected:'Wallet connected', wallet_err:'Connection failed',
      not_admin:'Admin only', not_login:'Please login as admin',
      claim_success:'✅ Claimed! Tx on-chain', claim_fail:'❌ Claim failed', insufficient_pool:'⚠️ Marketing wallet below 100,000 SPARK, airdrop paused', already_claimed:'Address already claimed', invalid_addr:'Invalid address',
      no_wallet:'Connect wallet first', confirm_chain:'Please switch to Ethereum mainnet', fee_warn:'You will submit a transaction on ETH chain and pay gas fee yourself.',
      invite_link:'Invite link generated',
      ok:'OK', close:'Close', loading:'Loading...', error:'Error', saved:'Saved', cleared:'Cleared'
    }
  };
  let cur = localStorage.getItem('spark_lang') || 'zh';
  function t(k){ return (dict[cur] && dict[cur][k]) || dict.zh[k] || k; }
  function apply(){
    document.documentElement.lang = cur === 'zh' ? 'zh-CN' : 'en';
    document.title = cur === 'zh' ? '星火通证 (SPARK) - 去中心化应用' : 'Spark Token (SPARK) - DApp';
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.getAttribute('data-i18n-placeholder')); });
    const lt = document.getElementById('langText'); if (lt) lt.textContent = cur === 'zh' ? 'EN' : '中文';
  }
  return {
    get cur(){ return cur; },
    t, apply,
    toggle(){
      cur = cur === 'zh' ? 'en' : 'zh';
      localStorage.setItem('spark_lang', cur);
      apply();
      // 通知各模块刷新 UI
      if (window.Airdrop) Airdrop.render();
      if (window.Chat) Chat.render();
      if (window.Market) Market.render();
      if (window.Shop) Shop.render();
    },
    init(){ apply(); }
  };
})();
