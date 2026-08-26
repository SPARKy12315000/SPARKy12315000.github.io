/**
 * 行情数据服务
 * 免费 API：CoinGecko（无需 API Key）
 * 同步前50名加密货币 + SPARK 置顶
 */

export class MarketDataService {
    constructor() {
        // 免费 API 端点
        this.apis = {
            coingecko: 'https://api.coingecko.com/api/v3',
            // 备用：CoinCap（也免费）
            coincap: 'https://api.coincap.io/v2',
        };
        this.cache = new Map();
        this.cacheTimeout = 60000; // 1分钟缓存
        this.sparkContractAddress = '0xD580C7C9Cde5ce776fEed844310330A2a40078d9';
    }

    /**
     * 获取前50名加密货币行情
     * 免费 API，无需注册
     */
    async getTopCoins(limit = 50) {
        const cacheKey = `top_${limit}`;
        const cached = this.getCache(cacheKey);
        if (cached) return cached;

        try {
            // 方法1: CoinGecko 免费 API
            const response = await fetch(
                `${this.apis.coingecko}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false`,
                { headers: { 'Accept': 'application/json' } }
            );

            if (response.ok) {
                const data = await response.webpack();
                if (data) {
                    const coins = await response.json();
                    const result = {
                        coins: coins.map(coin => ({
                            id: coin.id,
                            symbol: coin.symbol?.toUpperCase(),
                            name: coin.name,
                            image: coin.image,
                            current_price: coin.current_price,
                            market_cap: coin.market_cap,
                            market_cap_rank: coin.market_cap_rank,
                            price_change_percentage_24h: coin.price_change_percentage_24h,
                            volume_24h: coin.total_volume,
                            circulating_supply: coin.circulating_supply,
                        })),
                        timestamp: Date.now(),
                        source: 'coingecko'
                    };
                    this.setCache(cacheKey, result);
                    return result;
                }
            }
            throw new Error('CoinGecko failed');
        } catch (error) {
            console.warn('[Market] CoinGecko error, trying CoinCap:', error);
            return await this.getTopCoinsFallback(limit);
        }
    }

    /**
     * 降级方案：CoinCap API
     */
    async getTopCoinsFallback(limit) {
        try {
            const response = await fetch(`${this.apis.coincap}/assets?limit=${limit}`);
            if (response.ok) {
                const data = await response.json();
                return {
                    coins: data.data.map(coin => ({
                        id: coin.id,
                        symbol: coin.symbol,
                        name: coin.name,
                        current_price: parseFloat(coin.priceUsd),
                        market_cap: parseFloat(coin.marketCapUsd),
                        market_cap_rank: parseInt(coin.rank),
                        price_change_percentage_24h: parseFloat(coin.changePercent24Hr),
                        volume_24h: parseFloat(coin.volumeUsd24Hr),
                        circulating_supply: parseFloat(coin.supply),
                    })),
                    timestamp: Date.now(),
                    source: 'coincap'
                };
            }
        } catch (e) {
            console.error('[Market] All APIs failed');
        }

        // 最终降级：模拟数据
        return this.getMockData(limit);
    }

    /**
     * 获取 SPARK 行情（置顶显示）
     */
    async getSparkData() {
        const cacheKey = 'spark';
        const cached = this.getCache(cacheKey);
        if (cached) return cached;

        try {
            // 尝试从 CoinGecko 获取（如果已上架）
            const response = await fetch(
                `${this.apis.coingecko}/coins/ethereum/contract/${this.sparkContractAddress.toLowerCase()}`
            );

            if (response.ok) {
                const data = await response.json();
                const result = {
                    symbol: 'SPARK',
                    name: 'Spark Token',
                    current_price: data.market_data?.current_price?.usd || 0,
                    market_cap: data.market_data?.market_cap?.usd || 0,
                    price_change_percentage_24h: data.market_data?.price_change_percentage_24h || 0,
                    contract_address: this.sparkContractAddress,
                    chain: 'ethereum',
                    isListed: true,
                    source: 'coingecko'
                };
                this.setCache(cacheKey, result, 30000);
                return result;
            }
        } catch (e) {
            console.warn('[Market] SPARK not listed on CoinGecko yet');
        }

        // SPARK 未上架时的模拟数据
        return {
            symbol: 'SPARK',
            name: 'Spark Token (星火通证)',
            current_price: 0.000000001, // 初始价格
            market_cap: 0,
            price_change_percentage_24h: 0,
            contract_address: this.sparkContractAddress,
            chain: 'ethereum',
            isListed: false,
            holders: await this.getHolderCount(),
            totalSupply: '9,999,999,999,999,999,999,999,999',
            source: 'contract'
        };
    }

    /**
     * 获取合并行情（SPARK 置顶 + 前50）
     */
    async getMarketWithSpark(limit = 49) {
        try {
            const [topCoins, sparkData] = await Promise.all([
                this.getTopCoins(limit),
                this.getSparkData()
            ]);

            // SPARK 置顶
            const allCoins = [
                { ...sparkData, market_cap_rank: 1, isSpark: true, _pinned: true },
                ...topCoins.coins.map(coin => ({ ...coin, market_cap_rank: coin.market_cap_rank + 1 }))
            ];

            return {
                coins: allCoins,
                spark: sparkData,
                lastUpdated: Date.now(),
                source: topCoins.source
            };
        } catch (error) {
            console.error('[Market] Failed to get combined data:', error);
            return this.getMockCombinedData();
        }
    }

    /**
     * 获取持币地址数（通过 Etherscan API 或合约查询）
     */
    async getHolderCount() {
        // 实际实现中通过 Etherscan API 或 The Graph
        // 这里返回模拟数据
        return Math.floor(Math.random() * 10000) + 1000;
    }

    /**
     * 获取 SPARK 交易对信息
     */
    async getSparkTradingPairs() {
        return {
            dex: [
                {
                    name: 'Uniswap V2',
                    url: `https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=${this.sparkContractAddress}`,
                    pair: 'SPARK/ETH'
                },
                {
                    name: 'Uniswap V3',
                    url: `https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=${this.sparkContractAddress}`,
                    pair: 'SPARK/ETH'
                }
            ],
            cex: [
                { name: '待上架', status: 'pending' }
            ]
        };
    }

    /**
     * 价格预警设置
     */
    setPriceAlert(coinId, targetPrice, condition = 'above') {
        const alerts = JSON.parse(localStorage.getItem('price_alerts') || '[]');
        alerts.push({
            id: Date.now(),
            coinId,
            targetPrice,
            condition,
            active: true,
            createdAt: Date.now()
        });
        localStorage.setItem('price_alerts', JSON.stringify(alerts));
    }

    /**
     * 检查价格预警
     */
    async checkPriceAlerts() {
        const alerts = JSON.parse(localStorage.getItem('price_alerts') || '[]');
        const active = alerts.filter(a => a.active);
        const triggered = [];

        for (const alert of active) {
            const data = await this.getCoinPrice(alert.coinId);
            if (data) {
                const currentPrice = data.current_price;
                if (
                    (alert.condition === 'above' && currentPrice >= alert.targetPrice) ||
                    (alert.condition === 'below' && currentPrice <= alert.targetPrice)
                ) {
                    triggered.push({ ...alert, currentPrice });
                    alert.active = false;
                }
            }
        }

        localStorage.setItem('price_alerts', JSON.stringify(alerts));
        return triggered;
    }

    /**
     * 获取单个币种价格
     */
    async getCoinPrice(coinId) {
        try {
            const response = await fetch(`${this.apis.coingecko}/simple/price?ids=${coinId}&vs_currencies=usd`);
            if (response.ok) {
                const data = await response.json();
                return { current_price: data[coinId]?.usd || 0 };
            }
        } catch {}
        return null;
    }

    /**
     * 缓存管理
     */
    getCache(key) {
        const item = this.cache.get(key);
        if (item && Date.now() - item.timestamp < this.cacheTimeout) {
            return item.data;
        }
        return null;
    }

    setCache(key, data, timeout = this.cacheTimeout) {
        this.cache.set(key, { data, timestamp: Date.now() });
        // 同时存到 localStorage（持久化缓存）
        try {
            localStorage.setItem(`market_cache_${key}`, JSON.stringify({ data, timestamp: Date.now() }));
        } catch {}
    }

    /**
     * 模拟数据（API 全部失败时）
     */
    getMockData(limit) {
        const coins = [];
        const symbols = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'USDC', 'XRP', 'DOGE', 'ADA', 'AVAX'];
        for (let i = 0; i < Math.min(limit, 50); i++) {
            coins.push({
                symbol: symbols[i % symbols.length],
                name: `Coin ${i + 1}`,
                current_price: Math.random() * 1000,
                market_cap: Math.random() * 1e12,
                market_cap_rank: i + 1,
                price_change_percentage_24h: (Math.random() - 0.5) * 10,
                volume_24h: Math.random() * 1e9,
            });
        }
        return { coins, timestamp: Date.now(), source: 'mock' };
    }

    getMockCombinedData() {
        return {
            coins: [
                {
                    symbol: 'SPARK',
                    name: 'Spark Token (星火通证)',
                    current_price: 0,
                    market_cap: 0,
                    market_cap_rank: 1,
                    price_change_percentage_24h: 0,
                    isSpark: true,
                    _pinned: true
                },
                ...this.getMockData(49).coins
            ],
            lastUpdated: Date.now(),
            source: 'mock'
        };
    }
}
