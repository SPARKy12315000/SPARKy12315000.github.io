# 🔥 SPARK 星火通证 · 去中心化交易所（DEX）

基于以太坊的创新型营销回流代币，构建透明、公平、可持续的社区价值生态。

> 合约地址（以太坊）：`0xD580C7C9Cde5ce776fEed844310330A2a40078d9`
> 官方网站：https://sparky12315000.github.io/

## ✨ 特性

- **完整 DEX 模块**：实时行情 Tickers / K线图 / 深度图 / 订单簿 / 现货交易
- **多交易对**：SPARK/ETH · SPARK/USDT · SPARK/BNB
- **5% 营销回流**：买卖各 5% 税费自动注入资金池
- **去中心化存储**：自动修复 + 周期快照
- **治理升级**：多签 + 时间锁 + 管理员授权确认 + 自动部署
- **可学习 / 可编程 / 可自行升级**：模块化架构（撮合引擎 / 预言机 / 治理）
- **Web3 钱包**：MetaMask 连接、钱包签名下单

## 🏗 架构

```
.
├── index.html              # 前端 DApp（单文件，无构建依赖）
├── server/
│   ├── index.js            # 后端主入口（Express + WebSocket）
│   ├── engine.js           # 撮合引擎（订单簿/深度/K线/成交）
│   ├── oracle.js           # 价格预言机
│   ├── storage.js          # 去中心化存储（自动修复/快照）
│   ├── upgrade.js          # 治理升级管理器
│   ├── pair.js             # 交易对编解码
│   └── logger.js           # 统一日志
├── contracts/
│   └── SPARKToken.sol      # ERC20 + 5%回流 + 可升级代理
├── .github/workflows/
│   └── deploy.yml          # GitHub Pages 自动部署 + E2E 测试
└── e2e.js                  # 端到端测试（30 断言）
```

## 🚀 本地开发

```bash
npm install
node server/index.js        # 后端启动（默认 :3000）

# 或运行 E2E 测试
PORT=0 node e2e.js
```

前端 `index.html` 可直接打开，或部署到 GitHub Pages。

## 🔐 安全

- 管理员地址：`0xD580C7C9Cde5ce776fEed844310330A2a40078d9`
- 所有升级需多签授权 + 时间锁 + 管理员确认
- PAT / 私钥等敏感信息仅通过 GitHub Secrets 管理，不入库
