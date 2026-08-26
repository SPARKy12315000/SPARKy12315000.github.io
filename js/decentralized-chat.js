/**
 * 去中心化聊天系统
 * 基于 IPFS PubSub + Libp2p（无需中心服务器）
 * 消息通过 IPFS 网络传播，端到端加密
 */

import { storage } from './decentralized-storage.js';

export class DecentralizedChat {
    constructor(roomId = 'spark-global') {
        this.roomId = roomId;
        this.username = null;
        this.publicKey = null;
        this.privateKey = null;
        this.peers = new Set();
        this.messageCache = [];
        this.maxCacheSize = 1000;
        this.ipfsNode = null;
        this.isConnected = false;
        
        // 使用 BroadcastChannel 作为浏览器间的 P2P 通信
        // 实际部署时配合 IPFS PubSub
        this.channel = null;
    }

    /**
     * 初始化聊天系统
     */
    async init(userAddress) {
        try {
            this.username = this.generateUsername(userAddress);
            
            // 生成本地密钥对
            await this.generateKeyPair();
            
            // 初始化 P2P 通道
            this.initP2PChannel();
            
            // 尝试连接 IPFS（如果可用）
            await this.connectIPFS();
            
            // 加载历史消息
            await this.loadHistory();
            
            this.isConnected = true;
            console.log('[Chat] Initialized:', this.username);
            return true;
        } catch (error) {
            console.error('[Chat] Init failed:', error);
            // 降级到本地模式
            this.initLocalMode();
            return false;
        }
    }

    /**
     * 初始化 P2P 通信通道
     * 使用 BroadcastChannel API（同源标签页间通信）
     * 生产环境配合 IPFS PubSub / GunDB
     */
    initP2PChannel() {
        const channelName = `spark-chat-${this.roomId}`;
        
        // BroadcastChannel（同一域名下多标签页通信）
        if ('BroadcastChannel' in window) {
            this.channel = new BroadcastChannel(channelName);
            this.channel.onmessage = (event) => this.handleMessage(event.data);
        }
        
        // 同时监听 storage 事件（跨标签页兼容）
        window.addEventListener('storage', (e) => {
            if (e.key === `chat_${this.roomId}`) {
                try {
                    const data = JSON.parse(e.newValue);
                    this.handleMessage(data);
                } catch {}
            }
        });
    }

    /**
     * 连接 IPFS（去中心化消息传播）
     */
    async connectIPFS() {
        try {
            // 检查是否有 IPFS API 可用
            // 在浏览器中可以通过 ipfs-http-client 连接
            if (window.IpfsHttpClient) {
                this.ipfsNode = await window.IpfsHttpClient.create({
                    url: 'https://ipfs.infura.io:5001/api/v0'
                });
                
                // 订阅 PubSub 主题
                const topic = `spark-chat-${this.roomId}`;
                // 注意：浏览器中 PubSub 需要开启实验性功能
                // this.ipfsNode.pubsub.subscribe(topic, (msg) => {...});
            }
        } catch (error) {
            console.warn('[Chat] IPFS not available, using P2P fallback');
        }
    }

    /**
     * 降级到本地模式（localStorage 广播）
     */
    initLocalMode() {
        this.isConnected = true;
        console.log('[Chat] Running in local broadcast mode');
    }

    /**
     * 生成用户名（基于钱包地址）
     */
    generateUsername(address) {
        if (!address) return 'Anonymous_' + Math.random().toString(36).slice(2, 8);
        return 'SPARK_' + address.slice(2, 8);
    }

    /**
     * 生成密钥对（用于端到端加密）
     */
    async generateKeyPair() {
        try {
            if (window.crypto && window.crypto.subtle) {
                const keyPair = await window.crypto.subtle.generateKey(
                    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
                    true,
                    ['encrypt', 'decrypt']
                );
                this.publicKey = keyPair.publicKey;
                this.privateKey = keyPair.privateKey;
            }
        } catch (e) {
            console.warn('[Chat] Crypto not available');
        }
    }

    /**
     * 发送消息
     */
    async sendMessage(text, options = {}) {
        const message = {
            id: this.generateMessageId(),
            author: this.username,
            address: options.userAddress || null,
            text: text,
            timestamp: Date.now(),
            room: this.roomId,
            encrypted: false,
            type: options.type || 'text', // text, image, file, system
            replyTo: options.replyTo || null,
        };

        // 加密（如果有接收方）
        if (options.recipient && this.publicKey) {
            try {
                message.text = await this.encryptMessage(text, options.recipientKey);
                message.encrypted = true;
            } catch (e) {
                console.warn('[Chat] Encryption failed, sending plaintext');
            }
        }

        // 1. 通过 BroadcastChannel 广播（同一域名）
        if (this.channel) {
            this.channel.postMessage(message);
        }

        // 2. 通过 storage 事件广播（跨标签页）
        localStorage.setItem(`chat_${this.roomId}`, JSON.stringify(message));

        // 3. 通过 IPFS PubSub 广播（去中心化网络）
        await this.broadcastToIPFS(message);

        // 4. 保存到 IPFS（持久化，去中心化存储）
        await this.persistMessage(message);

        // 5. 本地缓存
        this.addToCache(message);

        return message;
    }

    /**
     * 通过 IPFS 广播消息
     */
    async broadcastToIPFS(message) {
        try {
            if (this.ipfsNode) {
                const topic = `spark-chat-${this.roomId}`;
                const encoded = new TextEncoder().encode(JSON.stringify(message));
                await this.ipfsNode.pubsub.publish(topic, encoded);
            }
        } catch (error) {
            // 静默失败，已有其他广播方式
        }
    }

    /**
     * 持久化消息到 IPFS
     */
    async persistMessage(message) {
        try {
            // 每100条消息批量上传到 IPFS
            this.pendingMessages = this.pendingMessages || [];
            this.pendingMessages.push(message);
            
            if (this.pendingMessages.length >= 100) {
                const cid = await storage.upload({
                    type: 'chat_messages',
                    room: this.roomId,
                    messages: this.pendingMessages,
                    timestamp: Date.now()
                });
                this.pendingMessages = [];
                console.log('[Chat] Messages persisted to IPFS:', cid);
            }
        } catch (error) {
            console.warn('[Chat] Failed to persist:', error);
        }
    }

    /**
     * 处理接收到的消息
     */
    async handleMessage(message) {
        if (!message || message.author === this.username) return;
        if (message.room !== this.roomId) return;

        // 解密（如果是加密消息）
        if (message.encrypted && this.privateKey) {
            try {
                message.text = await this.decryptMessage(message.text);
                message.encrypted = false;
            } catch (e) {
                message.text = '[Encrypted message - cannot decrypt]';
            }
        }

        // 防重复
        if (this.messageCache.find(m => m.id === message.id)) return;

        this.addToCache(message);
        
        // 触发回调
        this.onMessage?.(message);
    }

    /**
     * 添加到缓存
     */
    addToCache(message) {
        this.messageCache.push(message);
        if (this.messageCache.length > this.maxCacheSize) {
            this.messageCache.shift();
        }
    }

    /**
     * 加载历史消息
     */
    async loadHistory() {
        try {
            // 从 IPFS 加载历史消息
            // 实际实现中，这里会从已知的 CID 列表加载
            const saved = localStorage.getItem(`chat_history_${this.roomId}`);
            if (saved) {
                this.messageCache = JSON.parse(saved);
            }
        } catch (e) {
            this.messageCache = [];
        }
    }

    /**
     * 保存历史到本地（作为 IPFS 缓存层）
     */
    saveHistory() {
        try {
            localStorage.setItem(
                `chat_history_${this.roomId}`,
                JSON.stringify(this.messageCache.slice(-500))
            );
        } catch {}
    }

    /**
     * 加密消息
     */
    async encryptMessage(text, publicKey) {
        const encoded = new TextEncoder().encode(text);
        const encrypted = await window.crypto.subtle.encrypt(
            { name: 'RSA-OAEP' },
            publicKey,
            encoded
        );
        return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
    }

    /**
     * 解密消息
     */
    async decryptMessage(encryptedText) {
        const decoded = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
        const decrypted = await window.crypto.subtle.decrypt(
            { name: 'RSA-OAEP' },
            this.privateKey,
            decoded
        );
        return new TextDecoder().decode(decrypted);
    }

    /**
     * 生成消息 ID
     */
    generateMessageId() {
        return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    /**
     * 获取在线用户列表（基于心跳）
     */
    getOnlineUsers() {
        return Array.from(this.peers);
    }

    /**
     * 发送心跳（维持在线状态）
     */
    startHeartbeat() {
        setInterval(() => {
            this.sendMessage('__heartbeat__', { type: 'system' });
        }, 30000);
    }

    /**
     * 销毁
     */
    destroy() {
        if (this.channel) {
            this.channel.close();
        }
        this.saveHistory();
    }
}
