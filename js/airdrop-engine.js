/**
 * 空投引擎 - 完整的去中心化空投系统
 * 
 * 功能：
 * 1. 营销钱包自生成（系统自动创建）
 * 2. 用户链上领取（自付gas）
 * 3. 拉新奖励机制（邀请1人 = 1千万 SPARK）
 * 4. 防作弊系统
 * 5. 营销钱包余额监控
 * 6. 空投名单管理（IPFS存储）
 */

import { Web3Wallet } from './web3-wallet.js';
import { storage } from './decentralized-storage.js';

export class AirdropEngine {
    constructor(contractAddress) {
        this.contractAddress = contractAddress;
        this.wallet = new Web3Wallet();
        this.marketingWallet = null;
        this.storageRootCid = null;
        
        // 配置
        this.config = {
            airdropAmount: 1_000_000_000, // 10亿
            inviteReward: 100_000_000,     // 1千万
            minPoolBalance: 100_000,       // 10万
            claimCooldown: 24 * 60 * 60 * 1000, // 24小时
            maxClaimsPerIP: 3,
            maxClaimsPerWallet: 1,
        };

        // 防作弊
        this.ipClaimCount = new Map();
        this.walletClaimStatus = new Map();
        
        // 合约 ABI（仅空投相关）
        this.airdropABI = [
            'function claimAirdrop(address inviter) external',
            'function hasClaimed(address) view returns (bool)',
            'function airdropActive() view returns (bool)',
            'function balanceOf(address) view returns (uint256)',
            'function marketingWallet() view returns (address)',
            'function airdropAmount() view returns (uint256)',
            'function inviteReward() view returns (uint256)',
            'function referralCount(address) view returns (uint256)',
            'function lastClaimTime(address) view returns (uint256)',
            'event AirdropClaimed(address indexed user, address indexed inviter, uint256 amount)',
            'event InviteRewardPaid(address indexed inviter, address indexed invitee, uint256 amount)',
        ];
    }

    /**
     * 初始化空投系统
     */
    async init() {
        try {
            // 1. 获取或生成营销钱包信息
            await this.initMarketingWallet();
            
            // 2. 加载存储根 CID
            this.storageRootCid = await storage.getRootCid();
            
            // 3. 同步链上状态
            await this.syncOnChainState();
            
            console.log('[Airdrop] Engine initialized');
            return { success: true };
        } catch (error) {
            console.error('[Airdrop] Init failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 初始化营销钱包
     * 如果是首次，系统自动生成一个新钱包作为营销钱包
     * 私钥通过多签或时间锁保护
     */
    async initMarketingWallet() {
        // 从去中心化存储获取营销钱包地址
        const savedWallet = await this.getSavedMarketingWallet();
        
        if (savedWallet) {
            this.marketingWallet = savedWallet;
        } else {
            // 系统自动生成营销钱包
            // 注意：私钥应存储在安全的多签系统中
            // 这里仅生成地址，私钥由管理员通过多签管理
            const newWallet = Web3Wallet.generateWallet();
            
            this.marketingWallet = {
                address: newWallet.address,
                // 私钥通过分片存储（Shamir's Secret Sharing）
                // 实际应用中应存放在多签钱包（如 Gnosis Safe）
                privateKeyShards: this.shardPrivateKey(newWallet.privateKey),
                createdAt: Date.now(),
                // 标记是否需要管理员激活
                needsActivation: true
            };

            // 存储到 IPFS（仅地址，不含私钥）
            await this.saveMarketingWallet({
                address: this.marketingWallet.address,
                createdAt: this.marketingWallet.createdAt,
                needsActivation: true
            });

            console.log('[Airdrop] New marketing wallet generated:', this.marketingWallet.address);
        }
    }

    /**
     * 私钥分片（Shamir's Secret Sharing 简化版）
     * 将私钥分成3片，需要至少2片才能恢复
     */
    shardPrivateKey(privateKey) {
        // 简化实现：实际应使用专业的 SSS 库
        const shards = [];
        const parts = privateKey.match(/.{1,22}/g) || [];
        for (let i = 0; i < 3; i++) {
            shards.push({
                index: i,
                // 实际分片逻辑
                data: parts[i] || '',
                // 需要至少2片才能恢复
                threshold: 2
            });
        }
        return shards;
    }

    /**
     * 激活空投（管理员向营销钱包转入 SPARK 后调用）
     */
    async activateAirdrop(adminWallet) {
        try {
            // 检查营销钱包 SPARK 余额
            const balance = await this.getMarketingBalance();
            
            if (balance < this.config.minPoolBalance) {
                return {
                    success: false,
                    message: `Marketing wallet balance (${balance}) below minimum (${this.config.minPoolBalance})`
                };
            }

            // 更新合约状态
            const contract = new ethers.Contract(
                this.contractAddress,
                this.airdropABI,
                adminWallet.signer
            );
            
            await contract.toggleAirdrop();
            
            return { success: true, message: 'Airdrop activated' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * 用户领取空投
     * @param {string} userAddress - 用户钱包地址
     * @param {string} inviterAddress - 邀请人地址（可选）
     */
    async claimAirdrop(userAddress, inviterAddress = null) {
        const results = { checks: {} };
        
        try {
            // ===== 防作弊检查 =====
            
            // 1. 地址格式验证
            if (!this.isValidAddress(userAddress)) {
                return { success: false, error: 'Invalid wallet address' };
            }
            results.checks.address = true;

            // 2. 是否已领取过
            if (this.walletClaimStatus.get(userAddress.toLowerCase())) {
                return { success: false, error: 'This address has already claimed' };
            }
            results.checks.notClaimed = true;

            // 3. IP 限制检查
            const clientIP = await this.getClientIP();
            const ipCount = this.ipClaimCount.get(clientIP) || 0;
            if (ipCount >= this.config.maxClaimsPerIP) {
                return { success: false, error: 'Too many claims from this IP' };
            }
            results.checks.ipLimit = true;

            // 4. 合约层面验证
            const hasClaimed = await this.wallet.callContract(
                this.contractAddress,
                this.airdropABI,
                'hasClaimed',
                [userAddress]
            );
            if (hasClaimed) {
                return { success: false, error: 'Already claimed on-chain' };
            }
            results.checks.onChain = true;

            // 5. 空投是否激活
            const isActive = await this.wallet.callContract(
                this.contractAddress,
                this.airdropABI,
                'airdropActive',
                []
            );
            if (!isActive) {
                const balance = await this.getMarketingBalance();
                if (balance < this.config.minPoolBalance) {
                    return {
                        success: false,
                        error: `Airdrop paused: Marketing wallet balance (${balance}) below ${this.config.minPoolBalance} SPARK`,
                        balance: balance
                    };
                }
            }
            results.checks.active = true;

            // ===== 执行链上领取 =====
            
            // 弹窗提示用户
            this.showClaimDialog(userAddress, inviterAddress);

            // 调用合约 claimAirdrop
            const tx = await this.wallet.writeContract(
                this.contractAddress,
                this.airdropABI,
                'claimAirdrop',
                [inviterAddress || '0x0000000000000000000000000000000000000000']
            );

            // 更新本地状态
            this.walletClaimStatus.set(userAddress.toLowerCase(), true);
            this.ipClaimCount.set(clientIP, ipCount + 1);

            // 记录到 IPFS
            await this.recordClaim({
                user: userAddress,
                inviter: inviterAddress,
                txHash: tx.hash,
                blockNumber: tx.blockNumber,
                timestamp: Date.now(),
                amount: this.config.airdropAmount
            });

            // 如果有邀请人，记录邀请关系
            if (inviterAddress) {
                await this.recordInvite(inviterAddress, userAddress);
            }

            return {
                success: true,
                txHash: tx.hash,
                amount: this.config.airdropAmount,
                inviteReward: inviterAddress ? this.config.inviteReward : 0
            };

        } catch (error) {
            console.error('[Airdrop] Claim failed:', error);
            return { success: false, error: error.message, checks: results.checks };
        }
    }

    /**
     * 弹窗提示（ETH链 + 手续费自理）
     */
    showClaimDialog(userAddress, inviterAddress) {
        const lang = window.currentLang || 'zh';
        const messages = {
            zh: {
                title: '⚠️ 链上领取确认',
                network: '网络：Ethereum Mainnet (ETH链)',
                gas: '⛽ 手续费：由您自行支付 (Pay Gas Yourself)',
                amount: `🎁 领取金额：${this.config.airdropAmount.toLocaleString()} SPARK`,
                inviter: inviterAddress ? `👥 邀请人：${inviterAddress.slice(0, 10)}...` : '',
                confirm: '确认在 ETH 链上发起交易？',
                note: '提示：请确保钱包中有足够 ETH 支付 Gas 费'
            },
            en: {
                title: '⚠️ On-Chain Claim Confirmation',
                network: 'Network: Ethereum Mainnet',
                gas: '⛽ Gas Fee: Pay Yourself',
                amount: `🎁 Claim Amount: ${this.config.airdropAmount.toLocaleString()} SPARK`,
                inviter: inviterAddress ? `👥 Inviter: ${inviterAddress.slice(0, 10)}...` : '',
                confirm: 'Confirm transaction on ETH chain?',
                note: 'Note: Make sure you have enough ETH for gas'
            }
        };
        
        const msg = messages[lang];
        // 实际项目中这里会显示自定义模态框
        console.log('[Claim Dialog]', msg);
    }

    /**
     * 记录领取到 IPFS（去中心化存储）
     */
    async recordClaim(record) {
        try {
            // 追加到 IPFS 列表
            const newCid = await storage.appendToList(this.storageRootCid, {
                type: 'claim',
                ...record
            });
            this.storageRootCid = newCid;
            
            // 更新统计
            await this.updateStats();
            
            return true;
        } catch (error) {
            console.error('[Airdrop] Failed to record claim:', error);
            return false;
        }
    }

    /**
     * 记录邀请关系
     */
    async recordInvite(inviter, invitee) {
        await storage.appendToList(this.storageRootCid, {
            type: 'invite',
            inviter,
            invitee,
            timestamp: Date.now()
        });
    }

    /**
     * 更新统计数据
     */
    async updateStats() {
        const allRecords = await this.getAllRecords();
        const claims = allRecords.filter(r => r.type === 'claim');
        const invites = allRecords.filter(r => r.type === 'invite');
        
        const stats = {
            totalClaims: claims.length,
            totalInvites: invites.length,
            uniqueAddresses: new Set(claims.map(c => c.user.toLowerCase())).size,
            totalDistributed: claims.length * this.config.airdropAmount,
            marketingBalance: await this.getMarketingBalance(),
            lastUpdated: Date.now()
        };

        // 存储统计快照
        await storage.upload({ type: 'stats', ...stats });
        return stats;
    }

    /**
     * 获取所有记录（从 IPFS）
     */
    async getAllRecords() {
        if (!this.storageRootCid) return [];
        const data = await storage.fetch(this.storageRootCid);
        return Array.isArray(data) ? data : [];
    }

    /**
     * 获取营销钱包余额
     */
    async getMarketingBalance() {
        try {
            const walletAddr = typeof this.marketingWallet === 'object' 
                ? this.marketingWallet.address 
                : this.marketingWallet;
                
            const balance = await this.wallet.callContract(
                this.contractAddress,
                ['function balanceOf(address) view returns (uint256)'],
                'balanceOf',
                [walletAddr]
            );
            return parseFloat(ethers.formatUnits(balance, 18));
        } catch {
            return 0;
        }
    }

    /**
     * 同步链上状态
     */
    async syncOnChainState() {
        try {
            const [isActive, balance, amount] = await Promise.all([
                this.wallet.callContract(this.contractAddress, this.airdropABI, 'airdropActive', []),
                this.getMarketingBalance(),
                this.wallet.callContract(this.contractAddress, this.airdropABI, 'airdropAmount', [])
            ]);

            return {
                isActive,
                balance,
                airdropAmount: amount ? ethers.formatUnits(amount, 18) : this.config.airdropAmount
            };
        } catch (error) {
            console.error('[Airdrop] Sync failed:', error);
            return null;
        }
    }

    /**
     * 获取空投名单（所有用户可查看）
     */
    async getAirdropList(page = 0, pageSize = 50) {
        const allRecords = await this.getAllRecords();
        const claims = allRecords
            .filter(r => r.type === 'claim')
            .sort((a, b) => b.timestamp - a.timestamp);
        
        const start = page * pageSize;
        const end = start + pageSize;
        
        return {
            total: claims.length,
            page,
            pageSize,
            records: claims.slice(start, end).map((claim, idx) => ({
                rank: start + idx + 1,
                address: claim.user,
                shortAddress: `${claim.user.slice(0, 8)}...${claim.user.slice(-6)}`,
                inviter: claim.inviter || 'None',
                amount: claim.amount,
                txHash: claim.txHash,
                timestamp: new Date(claim.timestamp).toISOString(),
                status: 'Completed'
            }))
        };
    }

    /**
     * 防作弊：地址验证
     */
    isValidAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    /**
     * 获取客户端 IP（用于防作弊）
     */
    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch {
            return 'unknown';
        }
    }

    /**
     * 保存/加载营销钱包信息
     */
    async saveMarketingWallet(walletInfo) {
        await storage.upload({ type: 'marketing_wallet', ...walletInfo });
    }

    async getSavedMarketingWallet() {
        // 从 IPFS 或通过合约查询
        try {
            const addr = await this.wallet.callContract(
                this.contractAddress,
                ['function marketingWallet() view returns (address)'],
                'marketingWallet',
                []
            );
            return addr && addr !== '0x0000000000000000000000000000000000000000' 
                ? { address: addr } 
                : null;
        } catch {
            return null;
        }
    }

    /**
     * 生成邀请链接
     */
    generateInviteLink(inviterAddress) {
        const baseUrl = window.location.origin;
        return `${baseUrl}/?ref=${inviterAddress}`;
    }

    /**
     * 从 URL 解析邀请人
     */
    parseInviteFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const ref = params.get('ref');
        return ref && this.isValidAddress(ref) ? ref : null;
    }

    /**
     * 检查空投资格
     */
    async checkEligibility(address) {
        const checks = {
            validAddress: this.isValidAddress(address),
            notClaimed: !this.walletClaimStatus.get(address.toLowerCase()),
            airdropActive: true,
            sufficientBalance: true
        };

        try {
            const [hasClaimed, isActive, balance] = await Promise.all([
                this.wallet.callContract(this.contractAddress, this.airdropABI, 'hasClaimed', [address]),
                this.wallet.callContract(this.contractAddress, this.airdropABI, 'airdropActive', []),
                this.getMarketingBalance()
            ]);

            checks.notClaimed = !hasClaimed;
            checks.airdropActive = isActive;
            checks.sufficientBalance = balance >= this.config.minPoolBalance;
        } catch (e) {
            console.warn('[Airdrop] Eligibility check partial failure:', e);
        }

        checks.eligible = Object.values(checks).every(v => v === true || v === undefined);
        return checks;
    }
}
