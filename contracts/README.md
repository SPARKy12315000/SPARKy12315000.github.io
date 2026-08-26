# SPARK Token Contract

- `SPARKToken.sol`: 主合约（ERC-20 + 税费 + 空投 + 营销钱包）

## 编译 & 部署

```bash
# 使用 Hardhat 或 Foundry
forge build
forge create SPARKToken --constructor-args <MARKETING_WALLET> --rpc-url <ETH_RPC> --private-key <PK>
```

## 功能
- ERC-20: 名称 "SPARK Token", 符号 "SPARK", 18 位小数
- 总供应量: 9,999,999,999,999,999,999,999,999
- 买入税 5% / 卖出税 5% → 自动回流到营销钱包
- 转账税 0%
- 空投: 用户链上领取（自付 Gas），新人 1 亿，邀请一人 1 千万
- 营销钱包余额 < 100,000 自动暂停空投
- 防作弊: 单地址限领、邀请关系链上记录
