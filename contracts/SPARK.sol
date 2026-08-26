// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SPARK 星火通证 (问题8 + 问题2 链上支撑)
 * @notice 营销回流代币：买卖各 5% 自动回流；内置 Airdrop 托管（营销钱包代付/余额校验）与 Marketplace 托管（C2C）
 */
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

contract SPARK is IERC20 {
    string public name = "SPARK";
    string public symbol = "SPARK";
    uint8  public decimals = 18;
    uint256 public totalSupply = 9_999_999_999_999_999_999_999_999;
    uint256 public constant TAX = 5; // 买卖各 5%（问题：税率模型）

    address public marketingWallet;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // 税收回流事件
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event TaxRebate(address indexed to, uint256 amount);

    constructor(address _marketingWallet) {
        marketingWallet = _marketingWallet;
        balanceOf[_marketingWallet] = totalSupply;
        emit Transfer(address(0), _marketingWallet, totalSupply);
    }

    // ===== 营销回流（买卖税 5% 自动回流到营销钱包）=====
    function _transfer(address from, address to, uint256 amount) internal {
        uint256 tax = (amount * TAX) / 100;
        uint256 net = amount - tax;
        balanceOf[from] -= amount;
        balanceOf[marketingWallet] += tax; // 自动回流
        balanceOf[to] += net;
        emit TaxRebate(marketingWallet, tax);
        emit Transfer(from, to, net);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount); return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount; _transfer(from, to, amount); return true;
    }
    // ... 其余 approve/allowance 省略（完整实现见仓库）
}

/**
 * @title Airdrop 托管（问题8）
 * @notice 营销钱包批量空投 + 余额校验：用户余额 < 请求量 → 交易被限制
 */
contract Airdrop {
    IERC20 public token;
    address public admin;
    mapping(address => bool) public claimed;

    constructor(address _token) { token = IERC20(_token); admin = msg.sender; }

    /// 管理员批量空投（营销钱包代付）
    function batchAirdrop(address[] calldata users, uint256[] calldata amounts) external {
        require(msg.sender == admin, "NOT_ADMIN");
        for (uint i = 0; i < users.length; i++) {
            token.transfer(users[i], amounts[i]); // 从营销钱包余额划出
        }
    }

    /// 用户自行领取（余额不足自动 revert → 限制交易）
    function claim(uint256 amount) external {
        require(!claimed[msg.sender], "ALREADY_CLAIMED");
        require(token.balanceOf(address(this)) >= amount, "INSUFFICIENT_BALANCE"); // 问题8：余额2提5限制
        claimed[msg.sender] = true;
        token.transfer(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        require(msg.sender == admin, "NOT_ADMIN");
        token.transfer(admin, amount);
    }
}

/**
 * @title Marketplace C2C 托管（问题2，欧易/币安 C2C 规则）
 * @notice pending → paid → released，支持 dispute 申诉，管理员仲裁
 */
contract Marketplace {
    enum Status { Pending, Paid, Released, Disputed }
    struct Order { address buyer; address seller; uint256 amount; Status status; }
    IERC20 public token;
    address public admin;
    mapping(uint256 => Order) public orders;
    uint256 public nextId;

    constructor(address _token) { token = IERC20(_token); admin = msg.sender; }

    function createOrder(address seller, uint256 amount) external returns (uint256) {
        // 买家先授权托管（代币锁定在合约）
        token.transferFrom(msg.sender, address(this), amount);
        orders[nextId] = Order(msg.sender, seller, amount, Status.Pending);
        return nextId++;
    }
    function markPaid(uint256 id) external { require(msg.sender == orders[id].buyer); orders[id].status = Status.Paid; }
    function release(uint256 id) external {
        Order storage o = orders[id];
        require(msg.sender == o.seller, "NOT_SELLER");
        o.status = Status.Released;
        token.transfer(o.buyer, o.amount); // 放币给买家
    }
    function dispute(uint256 id) external { require(msg.sender == orders[id].buyer || msg.sender == orders[id].seller); orders[id].status = Status.Disputed; }
    function resolve(uint256 id, address winner) external { require(msg.sender == admin); token.transfer(winner, orders[id].amount); orders[id].status = Status.Released; }
}
