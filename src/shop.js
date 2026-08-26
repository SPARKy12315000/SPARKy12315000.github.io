/**
 * 去中心化商城（问题2）
 * 需求：
 *  - 连接钱包后可上架任意商品（溢货交易平台 = 二手/闲置 C2C）
 *  - 交易规则同欧易/币安 C2C：买家下单 → 资产锁定(托管) → 确认收款 → 释放，支持申诉
 * 实现：SPARK ERC20 托管合约（见 contracts/Marketplace.sol）+ 前端订单簿（IPFS 持久化）
 */
import { CONFIG } from './config.js';
import { DecentraStore } from './storage.js';
import { wallet } from './wallet.js';

export class Marketplace {
  constructor() {
    this.goods = new DecentraStore('shop_goods');
    this.orders = new DecentraStore('shop_orders');
  }

  // ===== 商品（用户自行上架）=====
  async listGoods({ title, desc, priceSPARK, category, imageCID }) {
    if (!wallet.isConnected()) throw new Error('NEED_WALLET');
    return this.goods.add({
      seller: wallet.address, title, desc,
      priceSPARK: String(priceSPARK), category: category || 'other',
      imageCID: imageCID || '', status: 'onsale',
    });
  }

  async allGoods() { return this.goods.all(); }

  // ===== C2C 订单（欧易/币安 C2C 规则）=====
  // 状态机：pending(已下单未付款) → paid(买家已付款,等待卖家确认) → released(已放币) / disputed(申诉)
  async createOrder(goodId) {
    if (!wallet.isConnected()) throw new Error('NEED_WALLET');
    const goods = await this.goods.all();
    const g = goods.find(x => x.id === goodId);
    if (!g) throw new Error('GOOD_NOT_FOUND');
    if (g.seller.toLowerCase() === wallet.address.toLowerCase()) throw new Error('CANNOT_BUY_OWN');
    return this.orders.add({
      goodId, buyer: wallet.address, seller: g.seller,
      priceSPARK: g.priceSPARK, amount: g.priceSPARK,
      status: 'pending', // 买家下一步标记为已付款
    });
  }

  /** 买家确认已付款（标记 paid，等待卖家放币） */
  async markPaid(orderId) {
    return this._updateOrder(orderId, 'paid', (o) => o.buyer === wallet.address);
  }

  /** 卖家确认收款 → 释放 SPARK（问题8 的托管划转在此触发链上 transfer） */
  async release(orderId) {
    const o = await this._findOrder(orderId);
    if (o.seller !== wallet.address) throw new Error('NOT_SELLER');
    // 链上划转：从托管释放给买家（实际由合约执行，此处发起交易）
    try {
      await this._escrowRelease(o);
    } catch (e) { throw new Error('CHAIN_FAILED:' + e.message); }
    return this._updateOrder(orderId, 'released');
  }

  /** 申诉：任意一方发起，锁定订单等待管理员仲裁 */
  async dispute(orderId, reason) {
    return this._updateOrder(orderId, 'disputed', null, { reason, disputedBy: wallet.address });
  }

  async _updateOrder(id, status, check, extra) {
    const list = await this.orders.all();
    const o = list.find(x => x.id === id);
    if (!o) throw new Error('ORDER_NOT_FOUND');
    if (check && !check(o)) throw new Error('FORBIDDEN');
    o.status = status;
    Object.assign(o, extra || {});
    localStorage.setItem('spark_store_shop_orders', JSON.stringify(list));
    return o;
  }

  async _findOrder(id) {
    const list = await this.orders.all();
    return list.find(x => x.id === id);
  }

  /** 链上释放（对接 Marketplace 托管合约） */
  async _escrowRelease(order) {
    // 实际部署：调用 Marketplace.sol 的 release(orderId)
    // 这里用标准 ERC20 transfer 模拟，部署后替换为合约调用
    const erc20 = CONFIG.contractAddress;
    const data = encodeTransfer(order.buyer, order.amount);
    return wallet.sendTransaction({ to: erc20, data, value: '0x0' });
  }

  myOrders() {
    if (!wallet.address) return Promise.resolve([]);
    return this.orders.all().then(list => list.filter(o =>
      o.buyer === wallet.address || o.seller === wallet.address));
  }
}

function encodeTransfer(to, amount) {
  // 简化的 ERC20 transfer(address,uint256) 编码（生产请使用 ethers.js Interface）
  const abi = '0xa9059cbb';
  const toPadded = to.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const amt = BigInt(amount).toString(16).padStart(64, '0');
  return abi + toPadded + amt;
}

export const marketplace = new Marketplace();
