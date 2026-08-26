# SPARK 星火通证 - 去中心化应用 (DApp) v2.0

> AI 驱动的去中心化加密货币生态系统：钱包 · 空投 · 聊天 · 行情 · 商城 · 短剧 · AI 自升级  
> 合约地址（ETH 主网）：`0xD580C7C9Cde5ce776fEed844310330A2a40078d9`

## 🚀 一键部署到 GitHub Pages

```bash
# 1. 安装依赖（仅构建时用）
npm install

# 2. 构建（生成 dist/index.html，单文件，可直接打开）
npm run build

# 3. 部署到 SPARKy12315000/SPARKy12315000.github.io
export SPARK_GITHUB_PAT=ghp_你的PAT
npm run deploy
# 或直接： node scripts/deploy.mjs ghp_xxx
```

部署后访问 **https://sparky12315000.github.io/** 即可看到全新 DApp。

> PAT 需要 `repo` 权限（经典令牌）或 `Contents: Read and write` + `Metadata`（Fine-grained）。
> 也可在站点「管理」面板中填入 PAT，由 AI 自检后**手动确认**提交升级。

## 📦 "去中心化后端"架构

GitHub Pages 是纯静态托管，无法运行传统后端。本项目的"去中心化后端"由三层组成：

| 层 | 职责 | 位置 |
|---|---|---|
| **智能合约** (Solidity) | 代币、空投托管、C2C 托管 | `contracts/SPARK.sol` |
| **IPFS** (多网关) | 永久存储：图片/聊天/片单/订单 | `src/storage.js` |
| **前端直连钱包** (EIP-1193) | 鉴权、签名、链上交易 | `src/wallet.js` |

## 🔑 9 大问题对照

| # | 问题 | 实现 | 关键文件 |
|---|---|---|---|
| 1 | 连接任意去中心化钱包 | EIP-1193 自动发现，兼容 MetaMask/imToken/TokenPocket/OKX/Binance 等；移动端深度链接 | `wallet.js` |
| 2 | 商城 C2C 溢货平台 | 用户自行上架；`pending→paid→released` 托管，支持申诉，规则同欧易/币安 | `shop.js`, `Marketplace.sol` |
| 3 | 聊天跨地域同步 | 钱包签名 + IPFS 多网关轮询 + BroadcastChannel | `chat.js`, `storage.js` |
| 4 | 短剧看视频赚币 | 免费影视源 + 观看奖励 + 每日上限防刷 | `video.js` |
| 5 | APP 下载 404 修复 | Android APK / iOS App Store / PWA 三通道 | `index.html` 下载弹窗 |
| 6 | 行情 SPARK 置顶 | GeckoTerminal 前 100 + SPARK 强制 rank=1 | `market.js` |
| 7 | AI 自动升级（管理员授权） | AI 自检生成提案 → **手动确认** → GitHub API 提交 | `ai.js`, `github.js` |
| 8 | 营销钱包代付 + 余额限制 | `payAirdrop` 直接划转；`checkWithdraw` 余额不足拒绝 | `admin.js`, `Airdrop.sol` |
| 9 | 保留原有资源 | 邮箱、官网2/3/4、Logo/背景 CID、税率均保留 | `config.js` |

## ⚠️ 安全提醒（务必阅读）

1. **管理员密码**：默认 `spark2024`，**生产环境必须改**——调用 `admin.setPassword()` 或改 `CONFIG.admin.passwordHash`。
2. **营销钱包**：默认复用合约地址占位，**上线前必须替换为真实多签/营销钱包**，且由管理员安全保管私钥。前端只能**发起**代付交易，私钥绝不进浏览器。
3. **PAT**：仅在管理员会话内存中使用，**不要**提交到仓库或写进 `localStorage`。
4. **短剧片源**：默认使用公有领域/CC0 内容，避免版权风险；"自动收录"需配合合法片源 API。
5. **合约**：`contracts/SPARK.sol` 为参考实现，**上线前必须经专业审计**；当前 `approve` 等为简化示意。

## 📁 目录结构

```
spark-dapp/
├── contracts/SPARK.sol        # 智能合约（代币+空投+商城托管）
├── src/
│   ├── index.html             # 入口（构建时被注入 CSS/JS）
│   ├── styles.css             # 全局样式
│   ├── config.js              # 全局配置（地址/税率/IPFS CID/仓库）
│   ├── wallet.js              # 问题1：钱包
│   ├── storage.js             # 去中心化存储（IPFS + IndexedDB）
│   ├── chat.js                # 问题3：聊天
│   ├── market.js              # 问题6：行情
│   ├── shop.js                # 问题2：商城
│   ├── video.js               # 问题4：短剧
│   ├── ai.js                  # 问题7：AI + 升级代理
│   ├── admin.js               # 问题8：管理员 + 营销钱包
│   ├── github.js              # GitHub API 部署
│   └── app.js                 # 主应用 + UI
├── scripts/
│   ├── build.mjs              # 打包为单文件 index.html
│   ├── deploy.mjs             # 用 PAT 提交到 GitHub
│   └── lint.mjs               # 自检
├── manifest.json              # PWA
└── package.json
```

## 🌐 IPFS / 去中心化镜像（可选）

```bash
# 将 dist/index.html 上传 IPFS，得到 CID 后写入 CONFIG.ipfs，实现双托管
ipfs add -r dist/
# 或用 web3.storage / Pinata
```

这样即使 GitHub Pages 不可用，站点仍可通过 `ipfs.io/ipfs/<CID>` 访问。
