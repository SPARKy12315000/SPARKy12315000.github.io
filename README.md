# 🔥 星火通证 SPARK — 去中心化应用 (DApp)

> 流动的文化之火 · 透明、公平、可持续的社区价值生态

**完全去中心化 · 抗审查 · 全免费（付费 API 全部由免费方案替代）**

访问：**https://sparky12315000.github.io/**

---

## ✨ 功能矩阵

| 模块 | 说明 | 去中心化 / 免费方案 |
|------|------|-------------------|
| 🎁 **链上空投** | 新人领 **1 亿 SPARK**，邀请一人奖励 **1 千万 SPARK**；用户自付 ETH 链上手续费 | ethers.js（免费 RPC 节点池） |
| 👛 **钱包登录** | MetaMask 等 EIP-1193 钱包连接，用户身份 = 钱包地址 | 无需后端，签名即身份 |
| 💬 **P2P 聊天** | 全球社区聊天，跨设备实时同步 | **GunDB P2P**（无服务器）+ BroadcastChannel |
| 🤖 **Web3 AI 助手** | 本地规则引擎 + SPARK 知识库，自动学习升级 | 纯前端，**无需 OpenAI API Key** |
| 🛒 **商城** | NFT、VIP、周边、空投加成卡、AI Pro、治理权，SPARK 兑换 | 链上/分布式结算 |
| 📈 **行情** | 币安 + 非小号同源（Coingecko）前 50，**SPARK 置顶**，60s 刷新 | 免费公共 API，无需 Key |
| 📱 **安卓 APP** | Capacitor 原生工程，自动构建签名 APK | GitHub Actions 免费出包 |
| 🔐 **管理员** | 密码登录（**哈希校验，明文不出镜**），数据导出/生成营销钱包/升级日志 | 会话 24h |
| 🔄 **AI 自动升级** | AI 学习问答 → 生成候选 → **弹窗提示 → 管理员手动确认才应用** | 运行时热更新 + CI/CD |

---

## 🏗️ 架构

```
用户浏览器
 ├─ index.html（星空 UI，继承官方品牌）
 ├─ js/
 │   ├─ config.js      # 合约/空投/管理员哈希/数据源配置
 │   ├─ i18n.js        # 中英文切换
 │   ├─ wallet.js      # MetaMask 连接 + 密码哈希校验
 │   ├─ storage.js     # 🔑 去中心化存储（GunDB + IPFS + 本地加密兜底）
 │   ├─ airdrop.js     # 空投：营销钱包余额监测、链上领取、防作弊、暂停阈值
 │   ├─ chat.js        # P2P 聊天
 │   ├─ market.js      # 行情（币安/Coingecko，SPARK 置顶）
 │   ├─ shop.js        # 商城
 │   ├─ ai.js          # AI 助手 + 自学习（Learn）
 │   ├─ upgrade.js     # AI 升级弹窗 + 管理员确认
 │   ├─ admin.js       # 管理员面板
 │   └─ app.js         # 启动器
 ├─ android/           # Capacitor 原生安卓工程（自动构建 APK）
 └─ .github/workflows/ # 自动化：部署 Pages + 构建 APK
```

### 去中心化存储（核心，非本地）

空投名单 / 聊天 / 邀请等数据通过 **三层** 存储，**任何用户可提交、可查看，非仅 localStorage**：

1. **GunDB P2P 网络** — 多 peer 同步，抗审查，无中心服务器
2. **IPFS / nft.storage** — 内容寻址永久存储，公开可验证
3. **localStorage AES-GCM 加密** — 离线兜底

### 空投机制

```
管理员向「营销钱包」存入 SPARK
        ↓
营销钱包余额 ≥ 100,000 → 空投激活
        ↓
用户提交地址 + 邀请人 → 自付 ETH Gas → 链上领取
        ↓
余额 < 100,000 → 自动暂停 + 用户提示
```

**防作弊**：① 单地址仅领一次 ② 邀请链深度 ≤ 3 层 ③ Merkle 白名单 ④ 阈值暂停

**营销钱包私钥策略**（二选一，在 `js/config.js` 设置 `MARKETING_WALLET`）：
- ✅ **推荐：Gnosis Safe 多签**（多人共管，避免单点）
- 🔥 若要彻底放弃控制权：私钥发送至**黑洞地址** `0x0000...dEaD`（永久锁定，只进不出）

---

## 🚀 部署（已自动化）

推送到 `main` 分支后 GitHub Actions 自动：

1. **部署网站** → `https://sparky12315000.github.io/`
2. **构建签名 APK** → Actions Artifacts + Releases

### 手动部署

```bash
# 1. 生成管理员密码哈希（管理员密码 → SHA-256，明文不入库）
node scripts/gen-admin-hash.js

# 2. 校验
node scripts/validate.js

# 3. 自动推送 + 验证
GH_TOKEN=ghp_xxx node scripts/deploy.js
```

---

## 🚀 快速部署（3 种方案，任选其一）

> 目标：把本目录内容推到 `SPARKy12315000/SPARKy12315000.github.io` 仓库的 `main` 分支，
> 之后 **GitHub Actions 自动** ① 部署网站到 GitHub Pages ② 构建签名 APK 发布到 Releases。
> 管理员密码哈希**已注入** `index.html`（SHA-256），代码库内无明文。

### 方案 A：本地一行命令自动推送（推荐，需 Node.js + Git）

```bash
# 1. 进入本目录
cd spark-release

# 2. （可选）若改了密码，重新注入哈希；不改则跳过
SPARK_ADMIN_PWD="<你的管理员密码>" node scripts/inject-hash.cjs

# 3. 一条命令：克隆仓库 → 拷贝文件 → 提交 → 推送
GH_TOKEN="<你的GitHub_PAT>" node scripts/push-to-github.cjs
```

推送后约 1–3 分钟，网站上线 `https://sparky12315000.github.io/`；APK 在 Actions Artifacts + Releases。

### 方案 B：纯 Git 命令（不用 Node 脚本）

```bash
cd spark-release
git init && git add -A && git commit -m "Deploy SPARK DApp"

# 关联仓库（用令牌认证）
git remote add origin https://<你的GitHub_PAT>@github.com/SPARKy12315000/SPARKy12315000.github.io.git
git branch -M main
git push -u origin main
```

### 方案 C：GitHub Desktop（完全不用命令行）

1. 装 [GitHub Desktop](https://desktop.github.com/)，登录账户 `SPARKy12315000`
2. **File → Clone repository** → 选 `SPARKy12315000.github.io` → Clone
3. 把本目录（`spark-release/`）**全部内容**拷进克隆出来的文件夹（覆盖）
4. **Commit to main**（摘要填 `Deploy SPARK DApp`）→ **Push origin**
5. 首次需在仓库 **Settings → Pages → Source 选 `GitHub Actions`**

> ⚠️ 无论哪种方案，**首次都要手动开一次权限**：
> **Settings → Actions → General → Workflow permissions → 改为 `Read and write permissions` → Save**
> 否则 APK 工作流会因权限 403 失败。

### 本地验证（推送前自查，可选）

```bash
node scripts/gate.cjs       # 闸门：推送文件零密码明文
node scripts/validate.cjs   # 完整校验（72+ 项）
node scripts/e2e-test.cjs   # 空投端到端测试（1亿/1000万/防作弊/余额暂停）
```

---

### 首次启用 Pages
仓库 → **Settings → Pages → Source: GitHub Actions**

### 安卓 APK
- **网页下载**：APP 页面一键下载（指向 Releases 最新 APK）
- **本地构建**：`./scripts/build-android.sh`（需 Android SDK + JDK 17）
- 安装：允许「未知来源」→ 安装

---

## 🔐 安全设计

- **管理员密码**：仅以 **SHA-256 哈希**存放，部署时由 `inject-hash.cjs` 注入 `index.html` 的 `window.__SPARK_ADMIN_HASH__`，**代码库内永不出现明文**（部署时由环境变量注入哈希）
  - 校验：`Wallet.checkAdminPassword()` 对输入做同样哈希后与注入值比对（`config.js` 仅读取该全局变量）
  - 改密：`SPARK_ADMIN_PWD="新密码" node scripts/inject-hash.cjs` 重新注入即可
- **AI 升级**：自动学习生成的改动**必须经管理员弹窗手动确认**，未确认绝不改动代码
- **私钥**：营销钱包建议多签；绝不暴露到前端

---

## 🌍 抗审查 & 免费保证

| 付费项（传统） | 本方案（免费） |
|---------------|--------------|
| Socket.io 服务器 | GunDB P2P |
| OpenAI API | 本地规则引擎 + 知识库 |
| 中心化数据库 | GunDB + IPFS |
| Infura/Alchemy | 免费公共 RPC 节点池（4 个自动切换） |
| 行情 API Key | 币安 / Coingecko 公共端点 |
| 服务器托管 | GitHub Pages + IPFS |
| 安卓签名服务 | 本地 / Actions 免费构建 |

---

## 📜 合约地址

`0xD580C7C9Cde5ce776fEed844310330A2a40078d9`（以太坊主网）

---

© 2026 星火通证 (SPARK). 完全去中心化 · 抗审查 · 数据链上/分布式存储
