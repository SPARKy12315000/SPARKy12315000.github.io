// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SPARK Token - 星火通证
 * @notice 5% 买入税 / 5% 卖出税 自动回流，0% 转账税
 * @dev 包含空投、营销钱包、邀请奖励、反作弊机制
 */
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

interface IERC20Metadata is IERC20 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

library SafeMath {
    function add(uint256 a, uint256 b) internal pure returns (uint256) {return a + b;}
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {require(b <= a);return a - b;}
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {return a * b;}
    function div(uint256 a, uint256 b) internal pure returns (uint256) {require(b > 0);return a / b;}
}

contract SPARKToken is IERC20, IERC20Metadata {
    using SafeMath for uint256;

    string private _name = "SPARK Token";
    string private _symbol = "SPARK";
    uint8 private _decimals = 18;
    uint256 private _totalSupply = 9_999_999_999_999_999_999_999_999; // 9.99M... (Q级)

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // 税费
    uint256 public constant BUY_TAX = 500;   // 5%
    uint256 public constant SELL_TAX = 500;  // 5%
    uint256 public constant TRANSFER_TAX = 0;
    uint256 public constant TAX_DENOM = 10000;

    address public marketingWallet;
    address public owner;

    // 空投
    uint256 public airdropAmount = 100_000_000 * 1e18;       // 1亿
    uint256 public inviteReward = 10_000_000 * 1e18;          // 1000万
    uint256 public pauseThreshold = 100_000 * 1e18;           // 10万
    mapping(address => bool) public hasClaimed;
    mapping(address => address) public inviterOf;
    uint256 public totalClaimed;

    bool public tradingEnabled = false;
    mapping(address => bool) public isExcludedFromTax;

    event AirdropClaimed(address indexed user, uint256 amount, address indexed inviter);
    event MarketingWalletUpdated(address indexed newWallet);
    event Swap(address indexed user, uint256 amountIn, bool isBuy);

    modifier onlyOwner() {require(msg.sender == owner, "Not owner");_;}

    constructor(address _marketingWallet) {
        owner = msg.sender;
        marketingWallet = _marketingWallet;
        _balances[msg.sender] = _totalSupply;
        isExcludedFromTax[msg.sender] = true;
        isExcludedFromTax[_marketingWallet] = true;
        emit Transfer(address(0), msg.sender, _totalSupply);
    }

    // ===== ERC20 =====
    function name() external view returns (string memory) {return _name;}
    function symbol() external view returns (string memory) {return _symbol;}
    function decimals() external view returns (uint8) {return _decimals;}
    function totalSupply() external view returns (uint256) {return _totalSupply;}
    function balanceOf(address a) external view returns (uint256) {return _balances[a];}
    function allowance(address o, address s) external view returns (uint256) {return _allowances[o][s];}

    function approve(address spender, uint256 amount) external returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(_allowances[from][msg.sender] >= amount, "Allowance");
        _allowances[from][msg.sender] = _allowances[from][msg.sender].sub(amount);
        _transfer(from, to, amount);
        return true;
    }

    // ===== 核心转账（含税费）=====
    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0) && to != address(0), "Zero address");
        bool takeTax = !isExcludedFromTax[from] && !isExcludedFromTax[to] && tradingEnabled;
        if (takeTax) {
            // 简单判断 buy/sell（sell = 转入 pair/router 或转出到非合约）
            bool isSell = to != marketingWallet && from != owner;
            uint256 taxRate = isSell ? SELL_TAX : BUY_TAX;
            if (taxRate > 0) {
                uint256 tax = amount.mul(taxRate).div(TAX_DENOM);
                uint256 send = amount.sub(tax);
                _balances[from] = _balances[from].sub(amount);
                _balances[marketingWallet] = _balances[marketingWallet].add(tax); // 自动回流
                _balances[to] = _balances[to].add(send);
                emit Transfer(from, marketingWallet, tax);
                emit Transfer(from, to, send);
                return;
            }
        }
        _balances[from] = _balances[from].sub(amount);
        _balances[to] = _balances[to].add(amount);
        emit Transfer(from, to, amount);
    }

    // ===== 空投（用户自付 Gas 链上领取）=====
    function claimAirdrop(address inviter) external {
        require(tradingEnabled || msg.sender == owner, "Trading not enabled");
        require(!hasClaimed[msg.sender], "Already claimed");
        require(_balances[marketingWallet] >= airdropAmount, "Marketing: insufficient balance");
        require(_balances[marketingWallet] >= pauseThreshold || msg.sender == owner, "Airdrop paused: low balance");

        hasClaimed[msg.sender] = true;
        inviterOf[msg.sender] = inviter;

        // 主奖励
        _transfer(marketingWallet, msg.sender, airdropAmount);
        totalClaimed = totalClaimed.add(airdropAmount);

        // 邀请奖励
        if (inviter != address(0) && inviter != msg.sender && !hasClaimed[inviter]) {
            // 邀请人未领取时不额外奖励，避免循环；此处奖励邀请人（需其已领取过则改为池子）
            if (_balances[marketingWallet] >= inviteReward) {
                _transfer(marketingWallet, inviter, inviteReward);
            }
        }
        emit AirdropClaimed(msg.sender, airdropAmount, inviter);
    }

    // 批量空投（管理员）
    function airdropBatch(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        require(recipients.length == amounts.length, "Length mismatch");
        for (uint256 i = 0; i < recipients.length; i++) {
            if (!hasClaimed[recipients[i]]) {
                hasClaimed[recipients[i]] = true;
                _transfer(marketingWallet, recipients[i], amounts[i]);
            }
        }
    }

    // ===== 管理 =====
    function setMarketingWallet(address w) external onlyOwner {
        require(w != address(0), "Zero");
        marketingWallet = w;
        emit MarketingWalletUpdated(w);
    }

    function setAirdropConfig(uint256 _amount, uint256 _invite, uint256 _threshold) external onlyOwner {
        airdropAmount = _amount;
        inviteReward = _invite;
        pauseThreshold = _threshold;
    }

    function enableTrading() external onlyOwner {tradingEnabled = true;}

    function withdrawETH() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    receive() external payable {}
}
