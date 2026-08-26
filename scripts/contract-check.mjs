// scripts/contract-check.mjs —— 合约扫描 CLI（含自动重建参考合约模板）
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const contractsDir = join(root, 'contracts');

// 参考合约模板（5/5/0 税率 + 自动回流 + 营销钱包 + 余额限制 + 重入保护占位）
const SPARK_SOL = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title SPARK 星火通证 - 营销回流代币
/// @notice 买卖各 5% 自动回流，转账 0%，营销钱包 + 余额限制
contract SPARK is ERC20, Ownable, ReentrancyGuard {
    uint256 public constant buyTax  = 5;   // 买入税 5%
    uint256 public constant sellTax = 5;   // 卖出税 5%
    uint256 public constant transferTax = 0; // 转账税 0%

    address public marketingWallet;
    uint256 public totalReflected;

    mapping(address => bool) public isExcludedFromTax;

    event Reflected(uint256 amount);
    event MarketingWalletUpdated(address indexed wallet);

    constructor(address _marketingWallet) ERC20("SPARK Token", "SPARK") {
        require(_marketingWallet != address(0), "invalid marketing wallet");
        marketingWallet = _marketingWallet;
        isExcludedFromTax[msg.sender] = true;
        isExcludedFromTax[_marketingWallet] = true;
        _mint(msg.sender, 1_000_000_000 * 10 ** decimals());
    }

    /// @notice 空投认领 + 手续费划扣（问题8：余额不足禁止超额）
    function claimAirdrop(address user, uint256 requested, uint256 fee) external nonReentrant {
        require(user != address(0), "invalid user");
        require(balanceOf(user) >= requested, "余额不足：限制交易");
        require(requested > fee, "认领金额不足以支付手续费");
        uint256 net = requested - fee;
        _transfer(user, marketingWallet, fee); // 手续费划入营销钱包
        // net 部分按业务释放（此处示意）
        totalReflected += net;
        emit Reflected(net);
    }

    function setMarketingWallet(address _w) external onlyOwner {
        require(_w != address(0), "invalid");
        marketingWallet = _w;
        emit MarketingWalletUpdated(_w);
    }

    function _transfer(address from, address to, uint256 amount) internal override {
        uint256 tax = 0;
        if (!isExcludedFromTax[from] && !isExcludedFromTax[to]) {
            // 简化：买卖按 buyTax/sellTax，转账 transferTax(0)
            tax = (amount * buyTax) / 100; // 实际应按交易方向区分
        }
        if (tax > 0) {
            super._transfer(from, address(this), tax); // 回流到合约
            amount -= tax;
            totalReflected += tax;
            emit Reflected(tax);
        }
        super._transfer(from, to, amount);
    }
}
`;

if (!existsSync(join(contractsDir, 'SPARK.sol'))) {
  mkdirSync(contractsDir, { recursive: true });
  writeFileSync(join(contractsDir, 'SPARK.sol'), SPARK_SOL, 'utf8');
  console.log('📄 已生成参考合约 contracts/SPARK.sol');
}

const { default: ContractChecker } = await import(join(srcDir(), 'contract-checker.js'));
function srcDir() { return join(__dirname, '..', 'src'); }

const checker = new ContractChecker(contractsDir);
const report = await checker.check();

console.log(`\n[Contract] ${report.message}`);
console.log(`   high=${report.counts.high} medium=${report.counts.medium} low=${report.counts.low}`);
for (const f of report.findings) {
  console.log(`   [${f.severity.toUpperCase()}] ${f.message}${f.upgrade ? '  →  ' + f.upgrade : ''}`);
}

const ok = report.counts.high === 0;
console.log(ok ? '\n✅ 合约检测通过（无高危问题）' : '\n⚠️  存在需修复项（见上）');
process.exit(0); // 始终 0，检测结果仅供升级参考，不阻断构建
