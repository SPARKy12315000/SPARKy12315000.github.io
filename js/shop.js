/**
 * 去中心化商城模块
 * 支持 SPARK 代币支付 + 加密货币支付
 * 订单存储在 IPFS（去中心化）
 */

import { storage } from './decentralized-storage.js';
import { Web3Wallet } from './web3-wallet.js';

export class DecentralizedShop {
    constructor(contractAddress) {
        this.contractAddress = contractAddress;
        this.wallet = new Web3Wallet();
        this.storageRootCid = null;
        
        // 商品目录（可扩展）
        this.products = [
            {
                id: 'spark_merch_001',
                name: 'SPARK 限量T恤',
                nameEn: 'SPARK Limited T-Shirt',
                price: 10000000000, // 100亿 SPARK
                priceUSD: 29.99,
                category: 'merchandise',
                image: 'https://via.placeholder.com/300x300/FFD700/0A0E17?text=SPARK+TS',
                description: '100%纯棉，SPARK Logo印花，限量100件',
                stock: 100,
                seller: 'SPARK Official',
            },
            {
                id: 'spark_nft_001',
                name: 'SPARK Genesis NFT',
                nameEn: 'SPARK Genesis NFT',
                price: 50000000000, // 500亿 SPARK
                priceUSD: 149.99,
                category: 'nft',
                image: 'https://via.placeholder.com/300x300/4FC3F7/0A0E17?text=SPARK+NFT',
                description: '创世NFT，持有者可享受空投加成',
                stock: 1000,
                seller: 'SPARK Official',
            },
            {
                id: 'spark_vip_001',
                name: 'VIP会员（月）',
                nameEn: 'VIP Membership (Monthly)',
                price: 5000000000, // 50亿 SPARK
                priceUSD: 9.99,
                category: 'service',
                image: 'https://via.placeholder.com/300x300/FF8C00/0A0E17?text=VIP',
                description: 'VIP会员特权：空投加成、专属客服、提前购买',
                stock: -1, // 无限
                seller: 'SPARK Official',
            },
            {
                id: 'spark_book_001',
                name: 'Web3投资指南（电子书）',
                nameEn: 'Web3 Investment Guide (eBook)',
                price: 1000000000, // 10亿 SPARK
                priceUSD: 4.99,
                category: 'digital',
                image: 'https://via.placeholder.com/300x300/9C27B0/FFFFFF?text=BOOK',
                description: '从零开始学Web3投资，200页精华内容',
                stock: -1,
                seller: 'SPARK Education',
            },
        ];

        this.orders = [];
        this.cart = [];
    }

    /**
     * 获取商品列表
     */
    getProducts(category = null, lang = 'zh') {
        let products = this.products;
        if (category) {
            products = products.filter(p => p.category === category);
        }
        
        return products.map(p => ({
            ...p,
            displayName: lang === 'zh' ? p.name : p.nameEn,
        }));
    }

    /**
     * 添加商品
     */
    addProduct(product) {
        this.products.push({
            id: `spark_${Date.now()}`,
            stock: 100,
            seller: 'Community',
            ...product,
        });
    }

    /**
     * 添加到购物车
     */
    addToCart(productId, quantity = 1) {
        const product = this.products.find(p => p.id === productId);
        if (!product) throw new Error('Product not found');

        const existing = this.cart.find(item => item.productId === productId);
        if (existing) {
            existing.quantity += quantity;
        } else {
            this.cart.push({ productId, quantity, addedAt: Date.now() });
        }

        this.saveCart();
        return this.cart;
    }

    /**
     * 结算（SPARK 代币支付）
     */
    async checkout(shippingAddress, paymentMethod = 'spark') {
        if (this.cart.length === 0) {
            throw new Error('Cart is empty');
        }

        if (!this.wallet.isConnected) {
            await this.wallet.connect();
        }

        const orderItems = this.cart.map(item => {
            const product = this.products.find(p => p.id === item.productId);
            return {
                productId: item.productId,
                name: product.name,
                price: product.price,
                quantity: item.quantity,
                subtotal: product.price * item.quantity,
            };
        });

        const total = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

        // 检查余额
        const balance = await this.wallet.getTokenBalance(this.contractAddress);
        if (parseFloat(balance) < total) {
            throw new Error(`Insufficient SPARK balance. Need: ${total}, Have: ${balance}`);
        }

        // 创建订单
        const order = {
            id: `order_${Date.now()}`,
            buyer: this.wallet.address,
            items: orderItems,
            total: total,
            paymentMethod: paymentMethod,
            shippingAddress: shippingAddress,
            status: 'pending_payment',
            createdAt: Date.now(),
        };

        // 执行支付
        if (paymentMethod === 'spark') {
            await this.payWithSPARK(order);
        }

        // 存储订单到 IPFS（去中心化）
        await this.saveOrder(order);

        // 清空购物车
        this.cart = [];
        this.saveCart();

        return order;
    }

    /**
     * 用 SPARK 支付
     */
    async payWithSPARK(order) {
        try {
            // 调用代币合约的 transfer 方法
            const abi = ['function transfer(address to, uint256 amount) returns (bool)'];
            const tx = await this.wallet.writeContract(
                this.contractAddress,
                abi,
                'transfer',
                ['0xMerchantAddress', ethers.parseUnits(order.total.toString(), 18)]
            );

            order.status = 'paid';
            order.txHash = tx.hash;
            return tx;
        } catch (error) {
            order.status = 'payment_failed';
            throw error;
        }
    }

    /**
     * 保存订单到 IPFS
     */
    async saveOrder(order) {
        try {
            const cid = await storage.appendToList(this.storageRootCid, {
                type: 'order',
                ...order
            });
            this.storageRootCid = cid;
            this.orders.push(order);
            return cid;
        } catch (error) {
            console.error('[Shop] Failed to save order:', error);
            // 降级到 localStorage
            const orders = JSON.parse(localStorage.getItem('shop_orders') || '[]');
            orders.push(order);
            localStorage.setItem('shop_orders', JSON.stringify(orders));
        }
    }

    /**
     * 获取订单列表
     */
    async getOrders(address = null) {
        const allOrders = [...this.orders];
        
        // 从 localStorage 恢复
        const saved = JSON.parse(localStorage.getItem('shop_orders') || '[]');
        allOrders.push(...saved);

        if (address) {
            return allOrders.filter(o => o.buyer?.toLowerCase() === address.toLowerCase());
        }
        return allOrders;
    }

    /**
     * 更新订单状态
     */
    async updateOrderStatus(orderId, status) {
        const order = this.orders.find(o => o.id === orderId);
        if (order) {
            order.status = status;
            order.updatedAt = Date.now();
            await this.saveOrder(order);
        }
    }

    /**
     * 购物车持久化
     */
    saveCart() {
        localStorage.setItem('shop_cart', JSON.stringify(this.cart));
    }

    loadCart() {
        try {
            this.cart = JSON.parse(localStorage.getItem('shop_cart') || '[]');
        } catch {
            this.cart = [];
        }
    }

    /**
     * 获取分类
     */
    getCategories() {
        return [
            { id: 'merchandise', name: '周边商品', nameEn: 'Merchandise' },
            { id: 'nft', name: 'NFT数字藏品', nameEn: 'NFT Collection' },
            { id: 'service', name: '会员服务', nameEn: 'Services' },
            { id: 'digital', name: '数字商品', nameEn: 'Digital Goods' },
        ];
    }

    /**
     * 搜索商品
     */
    searchProducts(query, lang = 'zh') {
        const lower = query.toLowerCase();
        return this.products.filter(p => 
            p.name.toLowerCase().includes(lower) ||
            p.nameEn.toLowerCase().includes(lower) ||
            p.description.toLowerCase().includes(lower)
        );
    }

    /**
     * 价格换算
     */
    async convertPrice(sparkAmount) {
        try {
            // 获取 SPARK/USD 价格
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
            const data = await response.json();
            const ethPrice = data.ethereum?.usd || 2000;
            
            // 简化：假设 SPARK 价格为 ETH 的某个比例
            // 实际应从 DEX 获取 SPARK/ETH 价格
            const sparkPriceUSD = 0.000000001; // 示例价格
            
            return {
                spark: sparkAmount,
                usd: sparkAmount * sparkPriceUSD,
                eth: sparkAmount * sparkPriceUSD / ethPrice,
            };
        } catch {
            return { spark: sparkAmount, usd: 0, eth: 0 };
        }
    }
}
