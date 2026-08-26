/**
 * 去中心化商城 v2.2.0 —— 用户自行上架，C2C 托管（欧易/币安规则）
 * 余额限制：问题8 余额不足禁止超额交易
 */
import { CONFIG } from './config.js';
import { DStorage } from './storage.js';

export class Shop extends DStorage {
  constructor(wallet) { super(); this.wallet = wallet; }

  /** 上架商品 */
  async list({ title, price, desc }) {
    if (!this.wallet?.connected) throw new Error('请先连接钱包');
    if (!title || !price || price <= 0) throw new Error('标题与价格无效');
    const item = {
      id: 'item_' + Date.now(),
      seller: this.wallet.address,
      title: String(title).trim(),
      desc: String(desc || '').trim(),
      price: Number(price),
      status: 'open',
      createdAt: Date.now(),
    };
    await this.put('shop', item);
    return item;
  }

  /** 下单（C2C 托管：买家付款先锁仓，确认后释放给卖家） */
  async order(itemId, buyerBalance) {
    const items = await this.all('shop');
    const item = items.find((i) => i.id === itemId);
    if (!item) throw new Error('商品不存在');
    if (item.seller === this.wallet?.address) throw new Error('不能购买自己的商品');
    // 余额限制：余额不足禁止超额交易
    if (typeof buyerBalance === 'number' && buyerBalance < item.price) {
      throw new Error(`余额不足：当前 ${buyerBalance}，需 ${item.price}（问题8 限制交易）`);
    }
    const order = {
      id: 'order_' + Date.now(),
      itemId, item, buyer: this.wallet?.address,
      amount: item.price, status: 'locked', createdAt: Date.now(),
    };
    await this.put('orders', order);
    return order;
  }

  /** 确认收货：释放托管资金给卖家 */
  async confirm(orderId) {
    const orders = await this.all('orders');
    const o = orders.find((x) => x.id === orderId);
    if (!o) throw new Error('订单不存在');
    o.status = 'released';
    await this.put('orders', o);
    return o;
  }
}

export default Shop;
