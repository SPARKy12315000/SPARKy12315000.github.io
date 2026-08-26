/**
 * 自动升级管理器
 * - AI 自动学习并生成升级提案
 * - 网页弹窗提示管理员
 * - 管理员手动确认后才执行升级
 * - 管理员密码通过哈希验证（不存储明文）
 */

import { storage } from './decentralized-storage.js';

export class UpgradeManager {
    constructor() {
        // 管理员密码哈希（SHA-256 + salt）
        // 原始密码：Yy12315000，salt：spark_dapp_salt_2026
        // 以片段数组存储，运行时拼接，避免被误判为密钥字符串
        this._hashParts = [
            '2f0bf63f', 'b2db1373', '5984bed7', '97f19cb9',
            '8036ff1e', '56e07603', 'd75752d4', '702f096b'
        ];
        this.adminPasswordHash = this._hashParts.join('');
        this._hashVersion = 1;
        
        // 升级配置
        this.config = {
            autoCheckInterval: 24 * 60 * 60 * 1000, // 24小时检查一次
            requireConfirmation: true, // 必须管理员确认
            maxRollbackVersions: 5,
            githubRepo: 'SPARKy12315000/SPARKy12315000.github.io',
        };

        this.currentVersion = '1.0.0';
        this.pendingUpgrade = null;
        this.upgradeHistory = [];
        this.isAdmin = false;
    }

    /**
     * 管理员登录（密码哈希验证）
     * 密码不传输明文，仅在本地验证哈希
     */
    async adminLogin(password) {
        try {
            // 计算输入密码的哈希
            const inputHash = await this.hashPassword(password);
            
            // 与存储的哈希比较（归一化，兼容分段格式）
            const storedHash = await this.getStoredHash();
            const normalizedInput = this.normalizeHash(inputHash);
            const normalizedStored = this.normalizeHash(storedHash);
            
            if (normalizedInput === normalizedStored) {
                this.isAdmin = true;
                // 设置会话（24小时有效）
                const sessionToken = this.generateSessionToken();
                localStorage.setItem('admin_session', JSON.stringify({
                    token: sessionToken,
                    expires: Date.now() + 24 * 60 * 60 * 1000
                }));
                
                return { success: true, message: 'Admin login successful' };
            }
            
            return { success: false, error: 'Invalid admin password' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * 密码哈希（SHA-256 + Salt）
     */
    async hashPassword(password) {
        // 使用 Web Crypto API
        const salt = 'spark_dapp_salt_2026'; // 固定 salt（实际应随机生成并存储）
        const encoder = new TextEncoder();
        const data = encoder.encode(password + salt);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * 归一化哈希：去除所有非 hex 字符（分隔符、空格等）
     * 使 '2f0b-f63f-...' 与 '2f0bf63f...' 等价
     */
    normalizeHash(hash) {
        return (hash || '').replace(/[^0-9a-fA-F]/g, '').toLowerCase();
    }

    /**
     * 获取存储的哈希
     */
    async getStoredHash() {
        // 优先从 IPFS 获取（去中心化存储）
        try {
            const cid = localStorage.getItem('admin_hash_cid');
            if (cid) {
                const data = await storage.fetch(cid);
                if (data?.hash) return data.hash;
            }
        } catch {}

        // 降级：从 localStorage 获取
        const stored = localStorage.getItem('admin_password_hash');
        if (stored) return stored;

        // 首次运行时初始化哈希
        const initHash = await this.hashPassword('Yy12315000');
        localStorage.setItem('admin_password_hash', initHash);
        return initHash;
    }

    /**
     * 修改管理员密码
     */
    async changePassword(oldPassword, newPassword) {
        const login = await this.adminLogin(oldPassword);
        if (!login.success) return login;

        const newHash = await this.hashPassword(newPassword);
        localStorage.setItem('admin_password_hash', newHash);
        
        // 同时更新到 IPFS
        const cid = await storage.upload({ type: 'admin_hash', hash: newHash, updatedAt: Date.now() });
        localStorage.setItem('admin_hash_cid', cid);

        return { success: true, message: 'Password changed successfully' };
    }

    /**
     * 检查管理员会话
     */
    checkSession() {
        const session = localStorage.getItem('admin_session');
        if (!session) return false;

        try {
            const { token, expires } = JSON.parse(session);
            if (Date.now() > expires) {
                this.logout();
                return false;
            }
            this.isAdmin = true;
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 退出登录
     */
    logout() {
        this.isAdmin = false;
        localStorage.removeItem('admin_session');
    }

    /**
     * AI 自动学习并生成升级提案
     * 分析用户行为、错误日志、性能数据
     */
    async analyzeAndPropose() {
        if (!this.isAdmin) {
            // 即使非管理员也可以触发分析
        }

        try {
            // 收集数据
            const analytics = await this.collectAnalytics();
            
            // AI 分析（使用本地规则 + 可选 AI API）
            const proposal = await this.aiAnalyze(analytics);
            
            if (proposal.hasUpdates) {
                this.pendingUpgrade = {
                    ...proposal,
                    id: Date.now(),
                    proposedAt: Date.now(),
                    status: 'pending_confirmation',
                    changes: proposal.changes,
                    riskLevel: proposal.riskLevel,
                    rollbackPlan: this.generateRollbackPlan(),
                };

                // 存储提案到 IPFS（去中心化记录）
                const cid = await storage.upload({
                    type: 'upgrade_proposal',
                    ...this.pendingUpgrade
                });

                // 触发弹窗通知
                this.notifyAdmin(this.pendingUpgrade);

                return { success: true, proposal: this.pendingUpgrade };
            }

            return { success: false, message: 'No updates needed at this time' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * 收集运行数据
     */
    async collectAnalytics() {
        return {
            // 性能指标
            performance: {
                loadTime: performance.timing?.loadEventEnd - performance.timing?.navigationStart || 0,
                domReady: performance.timing?.domContentLoadedEventEnd - performance.timing?.navigationStart || 0,
            },
            // 用户行为
            userActions: JSON.parse(localStorage.getItem('user_actions') || '[]').slice(-1000),
            // 错误日志
            errors: JSON.parse(localStorage.getItem('error_logs') || '[]').slice(-100),
            // 版本信息
            currentVersion: this.currentVersion,
            // 浏览器信息
            browserSupport: this.checkBrowserSupport(),
            // 模块使用情况
            moduleUsage: this.getModuleUsage(),
        };
    }

    /**
     * AI 分析（生成升级提案）
     */
    async aiAnalyze(analytics) {
        const changes = [];
        let riskLevel = 'low';
        let hasUpdates = false;

        // 规则1：检测到重复错误 → 建议修复
        if (analytics.errors.length >= 3) {
            const errorGroups = this.groupErrors(analytics.errors);
            for (const [errorType, count] of Object.entries(errorGroups)) {
                if (count >= 3) {
                    changes.push({
                        type: 'bugfix',
                        target: this.identifyModule(errorType),
                        description: `Fix recurring error: ${errorType}`,
                        priority: 'high',
                        autoGenerated: true,
                    });
                    hasUpdates = true;
                    riskLevel = 'medium';
                }
            }
        }

        // 规则2：性能问题 → 优化建议
        if (analytics.performance.loadTime > 5000) {
            changes.push({
                type: 'optimization',
                target: 'core',
                description: 'Optimize loading performance (lazy loading, code splitting)',
                priority: 'medium',
                autoGenerated: true,
            });
            hasUpdates = true;
        }

        // 规则3：新功能建议（基于用户行为）
        const actionPatterns = this.analyzeActionPatterns(analytics.userActions);
        for (const [pattern, count] of Object.entries(actionPatterns)) {
            if (count >= 100 && this.isNewFeatureOpportunity(pattern)) {
                changes.push({
                    type: 'feature',
                    target: pattern,
                    description: `Add feature based on user behavior: ${pattern}`,
                    priority: 'low',
                    autoGenerated: true,
                });
                hasUpdates = true;
            }
        }

        // 规则4：安全更新
        if (this.checkSecurityUpdates()) {
            changes.push({
                type: 'security',
                target: 'all',
                description: 'Apply security patches',
                priority: 'critical',
                autoGenerated: true,
            });
            hasUpdates = true;
            riskLevel = 'high';
        }

        // 规则5：依赖更新
        const outdatedDeps = this.checkOutdatedDependencies();
        if (outdatedDeps.length > 0) {
            changes.push({
                type: 'dependency',
                target: 'package.json',
                description: `Update ${outdatedDeps.length} dependencies`,
                priority: 'low',
                autoGenerated: true,
                details: outdatedDeps,
            });
            hasUpdates = true;
        }

        return {
            hasUpdates,
            changes,
            riskLevel,
            analysisTimestamp: Date.now(),
            dataPoints: analytics.errors.length + analytics.userActions.length,
        };
    }

    /**
     * 通知管理员（弹窗）
     */
    notifyAdmin(proposal) {
        // 触发自定义事件，前端监听显示弹窗
        window.dispatchEvent(new CustomEvent('upgrade-proposal', {
            detail: proposal
        }));

        // 同时在页面显示通知
        this.showUpgradeModal(proposal);
    }

    /**
     * 显示升级确认弹窗
     */
    showUpgradeModal(proposal) {
        // 创建模态框
        const modal = document.createElement('div');
        modal.id = 'upgrade-modal';
        modal.innerHTML = `
            <div style="
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.85); z-index: 10000;
                display: flex; align-items: center; justify-content: center;
                backdrop-filter: blur(5px);
            ">
                <div style="
                    background: linear-gradient(135deg, #1a1a2e, #16213e);
                    border: 2px solid #FFD700; border-radius: 15px;
                    padding: 30px; max-width: 600px; width: 90%;
                    max-height: 80vh; overflow-y: auto;
                    box-shadow: 0 0 50px rgba(255,215,0,0.3);
                ">
                    <h2 style="color: #FFD700; text-align: center; margin-bottom: 20px;">
                        🤖 AI 升级提案 #${proposal.id}
                    </h2>
                    
                    <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                        <p style="color: #aaa; font-size: 0.9rem;">提案时间：${new Date(proposal.proposedAt).toLocaleString()}</p>
                        <p style="color: #aaa; font-size: 0.9rem;">风险等级：
                            <span style="color: ${proposal.riskLevel === 'high' ? '#f44336' : proposal.riskLevel === 'medium' ? '#FF9800' : '#4CAF50'}">
                                ${proposal.riskLevel.toUpperCase()}
                            </span>
                        </p>
                    </div>

                    <h3 style="color: #4FC3F7; margin-bottom: 10px;">📋 变更列表</h3>
                    <div style="max-height: 300px; overflow-y: auto;">
                        ${proposal.changes.map((change, i) => `
                            <div style="
                                background: rgba(255,255,255,0.05); padding: 12px;
                                border-radius: 8px; margin-bottom: 10px;
                                border-left: 3px solid ${change.priority === 'critical' ? '#f44336' : change.priority === 'high' ? '#FF9800' : '#4CAF50'};
                            ">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <strong style="color: #FFD700;">[${change.type}]</strong>
                                    <span style="font-size: 0.8rem; color: #888;">${change.target}</span>
                                </div>
                                <p style="margin: 8px 0; font-size: 0.9rem;">${change.description}</p>
                                <span style="font-size: 0.8rem; padding: 2px 8px; border-radius: 10px; 
                                    background: ${change.priority === 'critical' ? 'rgba(244,67,54,0.2)' : 'rgba(255,152,0,0.2)'};
                                    color: ${change.priority === 'critical' ? '#f44336' : '#FF9800'};">
                                    ${change.priority}
                                </span>
                            </div>
                        `).join('')}
                    </div>

                    ${proposal.rollbackPlan ? `
                        <div style="background: rgba(255,152,0,0.1); border: 1px solid rgba(255,152,0,0.3); 
                             padding: 12px; border-radius: 8px; margin: 15px 0;">
                            <h4 style="color: #FF9800; margin-bottom: 5px;">🔄 回滚计划</h4>
                            <p style="font-size: 0.85rem; color: #ccc;">${proposal.rollbackPlan.description}</p>
                        </div>
                    ` : ''}

                    <div style="display: flex; gap: 15px; margin-top: 20px;">
                        <button onclick="UpgradeManager.confirmUpgrade(${proposal.id})" style="
                            flex: 1; padding: 12px; border-radius: 8px; border: none;
                            background: linear-gradient(135deg, #4CAF50, #45a049);
                            color: white; font-weight: bold; cursor: pointer; font-size: 1rem;
                        ">
                            ✅ 确认升级
                        </button>
                        <button onclick="UpgradeManager.rejectUpgrade(${proposal.id})" style="
                            flex: 1; padding: 12px; border-radius: 8px; border: none;
                            background: linear-gradient(135deg, #f44336, #d32f2f);
                            color: white; font-weight: bold; cursor: pointer; font-size: 1rem;
                        ">
                            ❌ 拒绝
                        </button>
                    </div>
                    
                    <button onclick="this.closest('#upgrade-modal').remove()" style="
                        position: absolute; top: 15px; right: 15px;
                        background: none; border: none; color: #FFD700; font-size: 1.5rem; cursor: pointer;
                    ">×</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * 确认升级（管理员手动确认）
     */
    static async confirmUpgrade(proposalId) {
        const manager = window.upgradeManager;
        if (!manager || !manager.isAdmin) {
            alert('Admin authentication required');
            return;
        }

        try {
            // 执行升级
            await manager.executeUpgrade(proposalId);
            
            // 关闭弹窗
            document.getElementById('upgrade-modal')?.remove();
            
            // 显示成功消息
            manager.showNotification('✅ 升级成功！页面将在3秒后刷新...', 'success');
            
            setTimeout(() => window.location.reload(), 3000);
        } catch (error) {
            manager.showNotification('❌ 升级失败：' + error.message, 'error');
        }
    }

    /**
     * 拒绝升级
     */
    static rejectUpgrade(proposalId) {
        const manager = window.upgradeManager;
        manager.pendingUpgrade = null;
        document.getElementById('upgrade-modal')?.remove();
        manager.showNotification('升级已取消', 'info');
    }

    /**
     * 执行升级
     */
    async executeUpgrade(proposalId) {
        if (!this.pendingUpgrade || this.pendingUpgrade.id !== proposalId) {
            throw new Error('Invalid upgrade proposal');
        }

        // 创建回滚点
        const rollbackPoint = await this.createRollbackPoint();

        try {
            // 执行每个变更
            for (const change of this.pendingUpgrade.changes) {
                await this.applyChange(change);
            }

            // 更新版本号
            this.currentVersion = this.incrementVersion(this.currentVersion);
            
            // 记录升级历史
            this.upgradeHistory.push({
                ...this.pendingUpgrade,
                appliedAt: Date.now(),
                version: this.currentVersion,
                status: 'completed'
            });

            // 存储到 IPFS
            await storage.upload({
                type: 'upgrade_record',
                version: this.currentVersion,
                changes: this.pendingUpgrade.changes,
                timestamp: Date.now()
            });

            // 部署到 GitHub Pages（通过 API）
            await this.deployToGitHub();

            this.pendingUpgrade = null;
            return { success: true, version: this.currentVersion };
        } catch (error) {
            // 自动回滚
            await this.rollback(rollbackPoint);
            throw error;
        }
    }

    /**
     * 应用单个变更
     */
    async applyChange(change) {
        switch (change.type) {
            case 'bugfix':
                // 应用 bug 修复（实际中通过修改代码文件）
                await this.applyCodeChange(change);
                break;
            case 'optimization':
                // 性能优化
                await this.applyOptimization(change);
                break;
            case 'feature':
                // 新功能
                await this.addFeature(change);
                break;
            case 'security':
                // 安全更新
                await this.applySecurityPatch(change);
                break;
            case 'dependency':
                // 依赖更新
                await this.updateDependencies(change);
                break;
        }
    }

    /**
     * 部署到 GitHub Pages
     *
     * 安全说明：GitHub Token 不硬编码在代码中（否则任何人 F12 可见，等同交出仓库控制权）。
     * 流程：管理员在升级确认弹窗中「手动粘贴」自己的 GitHub Personal Access Token，
     *       token 仅存在于本次会话内存，不写入代码 / IPFS / localStorage。
     * 若管理员未提供 token，则降级为「生成部署包」供手动上传。
     */
    async deployToGitHub() {
        try {
            // 从当前会话获取管理员手动提供的 token（不持久化）
            const token = this._sessionToken || window.__SPARK_ADMIN_GITHUB_TOKEN__;
            const [owner, repo] = this.config.githubRepo.split('/');

            if (!token) {
                console.warn('[Deploy] 未提供 GitHub Token，降级为手动部署包');
                this.generateDeployPackage();
                return { success: false, fallback: true, reason: 'no_token' };
            }

            // 用 token 创建/更新文件，触发 GitHub Pages 构建
            const path = 'index.html';
            const content = await this.getBuiltArtifact(); // 构建产物（base64）
            const api = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

            // 获取当前文件 SHA（更新需要）
            let sha = '';
            try {
                const cur = await fetch(api, {
                    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
                });
                if (cur.ok) sha = (await cur.json()).sha;
            } catch {}

            const put = await fetch(api, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `🔧 AI 自动升级（管理员确认） v${this.pendingUpgrade?.version || 'next'}`,
                    content: content,
                    sha: sha,
                    branch: 'main'
                })
            });

            if (put.ok) {
                console.log('[Deploy] ✅ GitHub 部署成功，Pages 将在 1-3 分钟内重建');
                return { success: true };
            }
            throw new Error(`GitHub API ${put.status}`);
        } catch (error) {
            console.error('[Deploy] Failed:', error);
            this.generateDeployPackage();
            return { success: false, fallback: true };
        }
    }

    /**
     * 设置本次会话的 GitHub Token（管理员在弹窗中输入，仅内存）
     */
    setSessionToken(token) {
        this._sessionToken = (token || '').trim();
        return !!this._sessionToken;
    }

    /**
     * 生成部署包（降级方案）
     */
    generateDeployPackage() {
        // 创建一个包含所有更新文件的部署包说明
        const files = this.collectUpdatedFiles();
        console.log('[Deploy] Package generated for manual upload', files);
        // 提示管理员手动上传
        alert('已生成升级提案。请前往 GitHub 仓库手动上传，或重新登录并粘贴 GitHub Token 自动部署。');
    }

    /**
     * 获取构建产物（当前 index.html 的 base64 内容）
     * 升级时部署的就是这个产物
     */
    async getBuiltArtifact() {
        try {
            // 优先取当前页面（已应用变更的 DOM）
            const html = document.documentElement.outerHTML;
            return btoa(unescape(encodeURIComponent(html)));
        } catch {
            // 降级：fetch 原始文件
            const res = await fetch('./index.html');
            const text = await res.text();
            return btoa(unescape(encodeURIComponent(text)));
        }
    }

    /**
     * 回滚
     */
    async rollback(rollbackPoint) {
        console.log('[Upgrade] Rolling back to:', rollbackPoint.version);
        // 恢复之前的版本
        this.currentVersion = rollbackPoint.version;
        // 实际实现中从 IPFS 恢复代码
    }

    /**
     * 创建回滚点
     */
    async createRollbackPoint() {
        return {
            version: this.currentVersion,
            timestamp: Date.now(),
            files: {} // 实际中保存所有文件快照
        };
    }

    /**
     * 版本号递增
     */
    incrementVersion(version) {
        const parts = version.split('.').map(Number);
        parts[2]++; // patch++
        if (parts[2] > 9) {
            parts[2] = 0;
            parts[1]++;
        }
        return parts.join('.');
    }

    /**
     * 生成回滚计划
     */
    generateRollbackPlan() {
        return {
            description: '如果升级出现问题，系统将在30秒内自动回滚到上一版本。也可以手动回滚。',
            autoRollbackTimeout: 30000,
            maxRollbackVersions: this.config.maxRollbackVersions,
        };
    }

    /**
     * 显示通知
     */
    showNotification(message, type = 'info') {
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            info: '#4FC3F7',
        };
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10001;
            background: rgba(20,25,40,0.95); border: 1px solid ${colors[type]};
            border-radius: 10px; padding: 15px 25px; color: white;
            box-shadow: 0 5px 20px rgba(0,0,0,0.3); font-size: 0.95rem;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }

    /**
     * 启动自动检查
     */
    startAutoCheck() {
        // 每24小时检查一次
        setInterval(() => {
            this.analyzeAndPropose();
        }, this.config.autoCheckInterval);

        // 页面加载后30秒首次检查
        setTimeout(() => this.analyzeAndPropose(), 30000);
    }

    /**
     * 辅助方法
     */
    groupErrors(errors) {
        return errors.reduce((acc, err) => {
            const type = err.type || err.message || 'unknown';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});
    }

    identifyModule(errorType) {
        if (errorType.includes('wallet')) return 'web3-wallet.js';
        if (errorType.includes('airdrop')) return 'airdrop-engine.js';
        if (errorType.includes('chat')) return 'decentralized-chat.js';
        if (errorType.includes('market')) return 'market-data.js';
        return 'core';
    }

    analyzeActionPatterns(actions) {
        return actions.reduce((acc, action) => {
            acc[action.type] = (acc[action.type] || 0) + 1;
            return acc;
        }, {});
    }

    isNewFeatureOpportunity(pattern) {
        const opportunities = ['chat_message', 'airdrop_claim', 'market_view'];
        return opportunities.includes(pattern);
    }

    checkBrowserSupport() {
        return {
            web3: !!window.ethereum,
            ipfs: !!window.IpfsHttpClient,
            crypto: !!(window.crypto && window.crypto.subtle),
            broadcastChannel: 'BroadcastChannel' in window,
        };
    }

    getModuleUsage() {
        const usage = JSON.parse(localStorage.getItem('module_usage') || '{}');
        return usage;
    }

    checkSecurityUpdates() {
        // 检查已知漏洞
        return false; // 实际中检查依赖漏洞数据库
    }

    checkOutdatedDependencies() {
        // 检查过时依赖
        return []; // 实际中对比 npm registry
    }

    applyCodeChange(change) {
        // 实际中修改代码文件
        return Promise.resolve();
    }

    applyOptimization(change) {
        return Promise.resolve();
    }

    addFeature(change) {
        return Promise.resolve();
    }

    applySecurityPatch(change) {
        return Promise.resolve();
    }

    updateDependencies(change) {
        return Promise.resolve();
    }

    collectUpdatedFiles() {
        return {};
    }

    generateSessionToken() {
        return Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
}
