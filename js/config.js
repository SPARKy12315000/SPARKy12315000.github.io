/* ===== SPARK 全局配置（纯前端，无后端） ===== */
window.SPARK = {
  // 代币 / 合约（与主网合约地址一致）
  TOKEN: {
    name: '星火通证',
    symbol: 'SPARK',
    address: '0xD580C7C9Cde5ce776fEed844310330A2a40078d9',
    decimals: 18,
    chainId: 1,                    // 以太坊主网
    rpcPool: [
      'https://eth.llamarpc.com',
      'https://rpc.ankr.com/eth',
      'https://ethereum.publicnode.com',
      'https://1rpc.io/eth'
    ]
  },

  // 空投营销钱包（由系统自助生成 / 可替换）
  // 说明：私钥安全由「多签 + 黑洞提示」策略处理，详见 airdrop.js
  MARKETING_WALLET: '0xSparkMarketing000000000000000000000000000A1R', // 占位，部署时由脚本替换
  MULTISIG_WALLET:   '0xSparkMultisig00000000000000000000000000A1D',  // 占位

  // 空投经济模型（单位：SPARK，含 18 位小数）
  AIRDROP: {
    baseAmount:    '100000000000000000000000000', // 1 亿 SPARK
    inviteReward:  '10000000000000000000000000',  // 1000 万 SPARK
    pauseThreshold:'100000000000000000000000',    // 营销钱包余额 < 100,000 暂停空投
    maxInviteDepth: 3,                            // 邀请链最大深度（防传销）
  },

  // 管理员（密码以 SHA-256 哈希存放，不暴露明文；见 admin.js 校验）
  // 部署时由 scripts/gen-admin-hash.cjs 生成的哈希注入此处；代码库内绝不出现密码本身
  ADMIN: {
    passwordHash: window.__SPARK_ADMIN_HASH__ || '0000000000000000000000000000000000000000000000000000000000000000',
    sessionHours: 24
  },

  // 去中心化存储配置（免费）
  STORAGE: {
    gunPeers: [
      'https://gun-manhattan.herokuapp.com/gun',
      'https://gun-eu.herokuapp.com/gun',
      'https://peer.wallie.io/gun'
    ],
    ipfsGateways: [
      'https://ipfs.io/ipfs/',
      'https://cloudflare-ipfs.com/ipfs/',
      'https://gateway.pinata.cloud/ipfs/'
    ]
  },

  // 行情数据源（免费，无需 API Key）
  MARKET: {
    binance: 'https://api.binance.com/api/v3',
    feixiaohao: 'https://api.coingecko.com/api/v3', // 非小号数据同源公开替代
    refreshMs: 60000
  },

  // AI 升级：自动学习开关（管理员手动确认才应用）
  UPGRADE: {
    autoLearn: true,
    checkIntervalMs: 5 * 60 * 1000   // 每 5 分钟扫描候选升级
  }
};
