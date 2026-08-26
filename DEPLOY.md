# SPARK 星火通证 DApp - 部署指南

## 一键部署（自动）
推送代码到 `main` 分支后，GitHub Actions 自动：
1. 构建 Android APK → 发布到 Releases（`build-apk.yml`）
2. 部署静态站点到 GitHub Pages（`deploy.yml`）

## 手动启用 GitHub Pages
仓库 Settings → Pages → Source: **GitHub Actions**

## 本地预览
```bash
npx serve .  # 或 python -m http.server 8000
```

## 管理员
- 密码：`Yy12315000`（SHA-256 存储，非明文）
- 功能：营销钱包生成、AI 升级确认、空投记录、系统设置

## 合约
- 地址：`0xD580C7C9Cde5ce776fEed844310330A2a40078d9`
- 网络：Ethereum Mainnet
- 税费：买入5% / 卖出5% 自动回流，转账0%

## 存储
- 去中心化：IPFS（多网关冗余）+ LocalStorage（P2P 共享层）
- 链上：空投/交易记录通过合约事件

## 钱包支持
MetaMask、OKX、imToken、TokenPocket、Bitget、Trust、Coinbase、Brave、WalletConnect

## IPFS 资源
- Logo: `bafkreig7xhotcsvptfcf7ipogm6wr3u3xikmfxaktcmw5xzzgvqu6xednm`
- 背景: `bafybeigtk7dpdzwtscb2pn2eovqbnwvmnhnrdrbmzebwahxc4tzy2vnbqu`

## 官方链接
- 邮箱: SPARKTOKEN@TUTAMAIL.COM
- 镜像: sparktoken.eth.limo / sparktoken.eth.link / sparktoken.eth
