/**
 * SPARK DApp 全局配置 v2.2.0
 * — 多语言 + 合约/官网自检升级中枢
 */
export const CONFIG = {
  version: '2.2.0-i18n',
  repo: 'SPARKy12315000/SPARKy12315000.github.io',
  site: 'https://sparky12315000.github.io/',

  // 合约（以太坊主网）
  contract: {
    address: '0xD580C7C9Cde5ce776fEed844310330A2a40078d9',
    chainId: 1,
    symbol: 'SPARK',
    name: '星火通证',
    decimals: 18,
    // 税率（经济模型）
    tax: { buy: 5, sell: 5, transfer: 0 },
    // 链上自动检测：启动时从合约 read 真实税率，与本配置交叉校验
    onChainVerify: true,
  },

  // 官网（保留原有）
  official: {
    email: 'SPARKTOKEN@TUTAMAIL.COM',
    sites: [
      'https://sparktoken.eth.limo/',
      'https://sparktoken.eth.link/',
      'https://sparktoken.eth/',
    ],
  },

  // IPFS 永久资源
  ipfs: {
    logoCID: 'bafkreig7xhotcsvptfcf7ipogm6wr3u3xikmfxaktcmw5xzzgvqu6xednm',
    bgCID:   'bafybeigtk7dpdzwtscb2pn2eovqbnwvmnhnrdrbmzebwahxc4tzy2vnbqu',
    gateways: [
      'https://ivory-cautious-stoat-562.mypinata.cloud/ipfs/',
      'https://ipfs.io/ipfs/',
      'https://cloudflare-ipfs.com/ipfs/',
      'https://gateway.pinata.cloud/ipfs/',
    ],
  },

  // 行情：GeckoTerminal 前 100 + SPARK 强制第一位
  market: {
    source: 'geckoterminal',
    fallback: ['coingecko', 'local'],
    sparkFirst: true,
    topN: 100,
  },

  // 多语言（本轮新增）
  i18n: {
    defaultLocale: 'zh-CN',
    supported: ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'],
    // 检测顺序：URL ?lang= → localStorage → navigator.language → default
    detectOrder: ['query', 'storage', 'navigator', 'default'],
    // 首次加载若浏览器语言不在 supported 列表，自动 fallback 到 en
    autoFallback: true,
  },

  // AI 自检升级（管理员手动授权）
  ai: {
    enabled: true,
    autoApply: false, // 必须管理员确认
    checkIntervalMs: 30 * 60 * 1000,
  },

  // 管理员
  admin: {
    // 默认密码仅用于首次登录，上线前必须修改；运行时 SHA-256+salt，不存明文
    defaultPasswordHash: null,
  },
};

export default CONFIG;
