/**
 * Web3 钱包集成模块
 * 支持 MetaMask、WalletConnect、Coinbase Wallet
 * 钱包地址作为登录凭证（签名验证）
 */

import { ethers } from 'https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js';

export class Web3Wallet {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.address = null;
        this.chainId = null;
        this.isConnected = false;
    }

    /**
     * 连接钱包（支持多种钱包）
     */
    async connect(walletType = 'metamask') {
        try {
            if (walletType === 'metamask') {
                if (!window.ethereum) {
                    throw new Error('Please install MetaMask or use a Web3 browser');
                }
                this.provider = new ethers.BrowserProvider(window.ethereum);
            } else if (walletType === 'walletconnect') {
                // WalletConnect 集成
                const WalletConnectProvider = window.WalletConnectProvider;
                if (WalletConnectProvider) {
                    const wcProvider = new WalletConnectProvider({
                        rpc: { 1: 'https://eth.llamarpc.com' }
                    });
                    await wcProvider.enable();
                    this.provider = new ethers.BrowserProvider(wcProvider);
                }
            }

            const accounts = await this.provider.send('eth_requestAccounts', []);
            this.signer = await this.provider.getSigner();
            this.address = await this.signer.getAddress();
            this.chainId = await this.provider.getNetwork().then(n => n.chainId);
            this.isConnected = true;

            // 监听账户变化
            window.ethereum?.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    this.disconnect();
                } else {
                    this.address = accounts[0];
                    this.onAccountChange?.(accounts[0]);
                }
            });

            window.ethereum?.on('chainChanged', (chainId) => {
                this.chainId = parseInt(chainId, 16);
                this.onChainChange?.(this.chainId);
            });

            return { success: true, address: this.address };
        } catch (error) {
            console.error('[Wallet] Connection failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 断开连接
     */
    disconnect() {
        this.provider = null;
        this.signer = null;
        this.address = null;
        this.isConnected = false;
    }

    /**
     * 签名验证（用于登录）
     * @param {string} message - 要签名的消息
     * @returns {Promise<Object>} 签名结果
     */
    async signLogin() {
        if (!this.signer) throw new Error('Wallet not connected');

        const message = `SPARK DApp Login\nAddress: ${this.address}\nTimestamp: ${Date.now()}\nNonce: ${Math.random().toString(36).substring(2)}`;
        const signature = await this.signer.signMessage(message);
        
        return {
            address: this.address,
            message,
            signature,
            timestamp: Date.now()
        };
    }

    /**
     * 验证签名（管理员端或后端验证）
     */
    static verifySignature(message, signature, address) {
        try {
            const recovered = ethers.verifyMessage(message, signature);
            return recovered.toLowerCase() === address.toLowerCase();
        } catch {
            return false;
        }
    }

    /**
     * 发送交易
     */
    async sendTransaction(to, value, data = '0x') {
        if (!this.signer) throw new Error('Wallet not connected');

        const tx = await this.signer.sendTransaction({
            to,
            value: ethers.parseEther(value.toString()),
            data
        });

        return tx;
    }

    /**
     * 调用合约方法（只读）
     */
    async callContract(contractAddress, abi, method, params = []) {
        if (!this.provider) throw new Error('Provider not available');
        
        const contract = new ethers.Contract(contractAddress, abi, this.provider);
        return await contract[method](...params);
    }

    /**
     * 调用合约方法（写入，需签名）
     */
    async writeContract(contractAddress, abi, method, params = [], options = {}) {
        if (!this.signer) throw new Error('Wallet not connected');

        const contract = new ethers.Contract(contractAddress, abi, this.signer);
        const tx = await contract[method](...params, options);
        return await tx.wait();
    }

    /**
     * 获取代币余额
     */
    async getTokenBalance(contractAddress, address = this.address) {
        const abi = ['function balanceOf(address) view returns (uint256)'];
        const balance = await this.callContract(contractAddress, abi, 'balanceOf', [address]);
        return ethers.formatUnits(balance, 18);
    }

    /**
     * 获取 ETH 余额
     */
    async getEthBalance(address = this.address) {
        if (!this.provider) throw new Error('Provider not available');
        const balance = await this.provider.getBalance(address);
        return ethers.formatEther(balance);
    }

    /**
     * 切换到以太坊主网
     */
    async switchToEthereum() {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x1' }]
            });
        } catch (error) {
            // 如果网络不存在，添加它
            if (error.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0x1',
                        chainName: 'Ethereum Mainnet',
                        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                        rpcUrls: ['https://eth.llamarpc.com'],
                        blockExplorerUrls: ['https://etherscan.io']
                    }]
                });
            }
        }
    }

    /**
     * 生成新钱包（用于空投营销钱包自生成）
     */
    static generateWallet() {
        const wallet = ethers.Wallet.createRandom();
        return {
            address: wallet.address,
            privateKey: wallet.privateKey,
            mnemonic: wallet.mnemonic?.phrase
        };
    }
}
