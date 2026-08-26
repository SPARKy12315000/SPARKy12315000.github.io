/**
 * SPARK DApp - 全局配置
 * 所有链上地址、税率、IPFS CID、管理员、仓库地址集中在此，便于自动升级系统扫描修改
 */
export const CONFIG = {
  // ===== 项目身份 =====
  name: 'SPARK 星火通证',
  symbol: 'SPARK',
  version: '2.0.0',

  // ===== 智能合约（Ethereum 主网）=====
  chainId: 1,
  chainHex: '0x1',
  networkName: 'Ethereum Mainnet',
  rpcUrls: [
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth',
    'https://cloudflare-eth.com',
  ],
  explorer: 'https://etherscan.io',
  contractAddress: '0xD580C7C9Cde5ce776fEed844310330A2a40078d9',

  // ===== 税率（经济模型）=====
  tax: { buy: 5, sell: 5, transfer: 0 },
  totalSupply: '9999999999999999999999999',

  // ===== 空投规则 =====
  airdrop: {
    newUserAmount: '10000000000',   // 10亿 = 10^10 (18 decimals 下的显示值)
    inviteReward: '10000000',        // 1千万
    claimAmount: '1000000000',       // 每地址 10亿 (文档口径)
    minMarketingBalance: 100000,
  },

  // ===== 营销钱包（问题8：代付/扣手续费）=====
  // 管理员在面板中设置，默认占位；生产环境应替换为真实多签/营销钱包
  marketingWallet: '0xD580C7C9Cde5ce776fEed844310330A2a40078d9',

  // ===== 管理员（密码哈希存储在 localStorage，避免明文）=====
  admin: {
    // 默认密码：spark2024 —— 生产请务必通过 setAdminPassword 修改
    passwordHash: 'spark2024',
    sessionHours: 24,
  },

  // ===== IPFS / 去中心化存储 =====
  ipfs: {
    // 网关列表（多网关容灾，自动切换）
    gateways: [
      'https://ivory-cautious-stoat-562.mypinata.cloud/ipfs/',
      'https://ipfs.io/ipfs/',
      'https://gateway.pinata.cloud/ipfs/',
      'https://cloudflare-ipfs.com/ipfs/',
    ],
    logoCID: 'bafkreig7xhotcsvptfcf7ipogm6wr3u3xikmfxaktcmw5xzzgvqu6xednm',
    bgCID: 'bafybeigtk7dpdzwtscb2pn2eovqbnwvmnhnrdrbmzebwahxc4tzy2vnbqu',
    // 短剧/影视元数据可上传至此 CID（问题4）
    videoMetaCID: '',
  },

  // ===== 官方镜像（问题9：保留原有官网）=====
  officialSites: [
    { label: '官网1(GitHub Pages)', url: 'https://sparky12315000.github.io' },
    { label: '官网2', url: 'https://sparktoken.eth.limo/' },
    { label: '官网3', url: 'https://sparktoken.eth.link/' },
    { label: '官网4', url: 'https://sparktoken.eth/' },
  ],
  email: 'SPARKTOKEN@TUTAMAIL.COM',

  // ===== 行情（问题6：GeckoTerminal 前100 + SPARK 置顶）=====
  market: {
    provider: 'GeckoTerminal',
    apiBase: 'https://api.geckoterminal.com/api/v2',
    network: 'eth',
    topN: 100,
  },

  // ===== GitHub 自动部署（问题7：自升级）=====
  repo: {
    owner: 'SPARKy12315000',
    name: 'SPARKy12315000.github.io',
    branch: 'main',
    apiBase: 'https://api.github.com',
  },

  // ===== 短剧奖励（问题4）=====
  video: {
    rewardPerWatch: '10', // SPARK，每次完整观看
    minWatchSeconds: 30,
  },
};

/** 多网关解析 IPFS 链接，自动容灾 */
export function ipfsUrl(cid) {
  if (!cid) return '';
  const gw = CONFIG.ipfs.gateways[0];
  return gw + cid;
}
