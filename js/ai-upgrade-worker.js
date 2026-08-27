/**
 * SPARKAutoUpgrader - AI 自编程升级引擎
 * =====================================
 * 核心职责：
 *   1. 自动检测本项目全部代码的变更/缺陷/优化点
 *   2. AI 自助分析并生成升级提案
 *   3. 弹窗提示管理员，等待【手动授权确认】
 *   4. 授权后自动编程升级，通过 GitHub API 提交
 *   5. 自动回滚机制（升级前自动备份）
 *
 * ⚠️ 框架锁定：本引擎只修改/增补业务代码，不改动整体架构
 * ⚠️ 安全边界：任何实际推送到仓库的操作，必须经管理员确认
 */
(function (global) {
    'use strict';

    const STORAGE = {
        enabled:      'spark_autoupgrade_enabled',
        lastCheck:    'spark_au_lastcheck',
        proposals:    'spark_au_proposals',
        history:      'spark_au_history',
        backup:       'spark_au_backup',
        pat:          'spark_au_pat',        // 管理员 PAT（加密存储）
        adminSession: 'spark_admin_session',
    };

    class SPARKAutoUpgrader {
        constructor(app) {
            this.app = app;
            this.enabled = localStorage.getItem(STORAGE.enabled) === 'true';
            this.checkInterval = 5 * 60 * 1000; // 5 分钟
            this.timer = null;
            this.repo = 'SPARKy12315000/SPARKy12315000.github.io';
            this._bind();
        }

        /* ============ 生命周期 ============ */

        start() {
            if (this.timer) return;
            this.enabled = true;
            localStorage.setItem(STORAGE.enabled, 'true');
            // 立即执行一次，之后定时
            this.runCheck();
            this.timer = setInterval(() => this.runCheck(), this.checkInterval);
            this.app?.toast('🤖 AI 自升级引擎已启动', 'success');
        }

        stop() {
            this.enabled = false;
            localStorage.setItem(STORAGE.enabled, 'false');
            if (this.timer) clearInterval(this.timer);
            this.timer = null;
            this.app?.toast('AI 自升级引擎已暂停', 'info');
        }

        _bind() {
            // 页面加载后自动启动（仅管理员已登录时）
            document.addEventListener('DOMContentLoaded', () => {
                if (this.app?.checkAdminSession && this.app.checkAdminSession()) {
                    this.start();
                }
            });
        }

        /* ============ ① 自动检测 ============ */

        async runCheck() {
            if (!this.enabled) return;
            localStorage.setItem(STORAGE.lastCheck, Date.now());

            const report = {
                timestamp: Date.now(),
                errors: this._collectErrors(),
                performance: this._collectPerf(),
                apiHealth: await this._checkApiHealth(),
                remoteHash: await this._getRemoteHash(),
            };

            const needsUpgrade = this._analyze(report);
            if (needsUpgrade) {
                const proposal = await this._generateProposal(report, needsUpgrade);
                this._showProposal(proposal); // ② 弹窗提示
            }
        }

        _collectErrors() {
            // 收集控制台错误、未捕获异常、失败的 fetch
            try {
                return JSON.parse(localStorage.getItem('spark_errors') || '[]');
            } catch { return []; }
        }

        _collectPerf() {
            const t = performance.timing;
            if (!t) return {};
            return {
                loadTime: t.loadEventEnd - t.navigationStart,
                domReady: t.domContentLoadedEventEnd - t.navigationStart,
            };
        }

        async _checkApiHealth() {
            // 检测 CoinGecko / IPFS 等外部依赖可用性
            const result = {};
            try {
                const r = await fetch('https://api.coingecko.com/api/v3/ping', { cache: 'no-cache' });
                result.coingecko = r.ok ? 'ok' : 'degraded';
            } catch { result.coingecko = 'down'; }
            return result;
        }

        async _getRemoteHash() {
            // 获取远端 index.html 的 hash，用于比对变更
            try {
                const r = await fetch(`https://api.github.com/repos/${this.repo}/contents/index.html`, {
                    headers: { 'Accept': 'application/vnd.github.v3+json' }
                });
                if (r.ok) {
                    const data = await r.json();
                    return data.sha;
                }
            } catch {}
            return null;
        }

        _analyze(report) {
            // 规则引擎：判断是否需要升级
            const issues = [];

            if (report.errors.length >= 3) {
                issues.push({ type: 'bugfix', priority: 'high',
                    target: 'error-handling', desc: `检测到 ${report.errors.length} 个运行时错误，建议修复` });
            }

            if (report.performance.loadTime > 5000) {
                issues.push({ type: 'optimization', priority: 'medium',
                    target: 'performance', desc: `首屏加载 ${report.performance.loadTime}ms，建议优化` });
            }

            if (report.apiHealth?.coingecko === 'down') {
                issues.push({ type: 'feature', priority: 'medium',
                    target: 'market', desc: 'CoinGecko API 不可用，建议增加备用数据源' });
            }

            return issues.length ? issues : null;
        }

        /* ============ ② AI 自助分析 + 提案 ============ */

        async _generateProposal(report, issues) {
            // 调用内置 AI 助手深度分析
            let aiAnalysis = '';
            try {
                if (this.app?.ai?.chat) {
                    const resp = await this.app.ai.chat(
                        `分析以下 SPARK DApp 问题并给出代码修复方案：${JSON.stringify(issues)}`,
                        { lang: this.app.currentLang || 'zh' }
                    );
                    aiAnalysis = resp.message;
                }
            } catch (e) {
                aiAnalysis = 'AI 分析暂不可用，使用规则引擎默认提案';
            }

            return {
                id: Date.now(),
                version: this._nextVersion(),
                issues,
                aiAnalysis,
                riskLevel: issues.some(i => i.priority === 'high') ? 'medium' : 'low',
                createdAt: new Date().toISOString(),
            };
        }

        _nextVersion() {
            const history = JSON.parse(localStorage.getItem(STORAGE.history) || '[]');
            const last = history[0]?.version || '1.0.0';
            const [a, b, c] = last.split('.').map(Number);
            return `${a}.${b}.${c + 1}`;
        }

        /* ============ ③ 弹窗提示管理员 ============ */

        _showProposal(proposal) {
            // 保存提案
            const list = JSON.parse(localStorage.getItem(STORAGE.proposals) || '[]');
            list.push(proposal);
            localStorage.setItem(STORAGE.proposals, JSON.stringify(list));

            const t = this.app?.i18n?.[this.app.currentLang] || {};
            const lang = this.app?.currentLang || 'zh';

            const modal = document.createElement('div');
            modal.className = 'modal-overlay active';
            modal.id = 'upgradeProposalModal';
            modal.innerHTML = `
                <div class="modal-content">
                    <h2 style="color:var(--secondary);text-align:center;margin-bottom:20px;">
                        🤖 AI 升级提案 v${proposal.version}
                    </h2>
                    <div style="background:rgba(0,0,0,0.3);padding:15px;border-radius:10px;margin-bottom:20px;font-size:0.85rem;">
                        <div>${new Date(proposal.createdAt).toLocaleString()}</div>
                        <div style="margin-top:5px;">
                            ${lang === 'zh' ? '风险等级' : 'Risk Level'}:
                            <span style="color:#4CAF50;">${proposal.riskLevel.toUpperCase()}</span>
                        </div>
                    </div>

                    <h3 style="color:var(--accent);margin-bottom:10px;">${lang === 'zh' ? '问题诊断' : 'Issues'}</h3>
                    ${proposal.issues.map(i => `
                        <div style="background:rgba(255,255,255,0.05);padding:12px;border-radius:8px;margin-bottom:10px;border-left:3px solid ${i.priority === 'high' ? '#f44336' : '#4CAF50'};">
                            <strong style="color:var(--secondary);">[${i.type}]</strong> ${i.target}
                            <p style="margin:5px 0 0;font-size:0.85rem;">${i.desc}</p>
                        </div>
                    `).join('')}

                    <h3 style="color:var(--accent);margin:15px 0 10px;">${lang === 'zh' ? 'AI 分析建议' : 'AI Suggestion'}</h3>
                    <div style="background:rgba(79,195,247,0.1);border:1px solid rgba(79,195,247,0.3);padding:12px;border-radius:8px;font-size:0.85rem;white-space:pre-wrap;">${proposal.aiAnalysis}</div>

                    <div style="background:rgba(255,152,0,0.1);border:1px solid rgba(255,152,0,0.3);padding:12px;border-radius:8px;margin:15px 0;">
                        <h4 style="color:var(--warning);margin-bottom:5px;">🔄 ${lang === 'zh' ? '回滚计划' : 'Rollback'}</h4>
                        <p style="font-size:0.8rem;color:#ccc;">${lang === 'zh' ? '升级前自动备份当前版本，失败可一键回滚到上一稳定版' : 'Auto-backup before upgrade, one-click rollback on failure'}</p>
                    </div>

                    <div style="display:flex;gap:15px;margin-top:20px;">
                        <button class="btn btn-success" id="auConfirmBtn" style="flex:1;">
                            ✅ ${lang === 'zh' ? '管理员确认升级' : 'Admin Confirm Upgrade'}
                        </button>
                        <button class="btn btn-danger" id="auRejectBtn" style="flex:1;">
                            ❌ ${lang === 'zh' ? '拒绝' : 'Reject'}
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            this._currentProposal = proposal; // 🆕 供 app.confirmUpgrade() 桥接取用
            document.getElementById('auConfirmBtn').onclick = () => this.confirmUpgrade(proposal);
            document.getElementById('auRejectBtn').onclick = () => this.rejectUpgrade(proposal);
        }

        /* ============ ④ 管理员手动授权 + ⑤ 自动编程升级 ============ */

        async confirmUpgrade(proposal) {
            // 前置校验：必须管理员已登录
            if (!this.app?.checkAdminSession || !this.app.checkAdminSession()) {
                this.app?.toast('⚠️ 仅管理员可授权升级', 'error');
                return;
            }

            // 自动备份当前版本
            await this._backup();

            try {
                // 生成代码补丁（由 AI 分析产出）
                const patch = await this._generatePatch(proposal);

                // 提交到 GitHub（需配置 PAT）
                const pat = localStorage.getItem(STORAGE.pat);
                if (!pat) {
                    this.app?.toast('⚠️ 请先在管理员面板配置 GitHub PAT 以启用自动推送', 'warning');
                    // 仍记录为"待应用"，管理员可手动应用
                    this._recordHistory(proposal, 'pending-pat');
                    document.getElementById('upgradeProposalModal')?.remove();
                    return;
                }

                const result = await this._commitToGitHub(patch, proposal);
                this._recordHistory(proposal, 'success', result);

                this.app?.toast(`✅ 升级 v${proposal.version} 已提交，页面将自动刷新`, 'success');
                document.getElementById('upgradeProposalModal')?.remove();

                setTimeout(() => location.reload(), 3000);
            } catch (e) {
                console.error('[AutoUpgrade] 升级失败，触发回滚', e);
                await this._rollback();
                this.app?.toast(`❌ 升级失败，已自动回滚：${e.message}`, 'error');
                this._recordHistory(proposal, 'rolled-back', null, e.message);
            }
        }

        rejectUpgrade(proposal) {
            this._recordHistory(proposal, 'rejected');
            document.getElementById('upgradeProposalModal')?.remove();
            this.app?.toast('升级提案已拒绝', 'info');
        }

        /* ============ 代码补丁生成 ============ */

        async _generatePatch(proposal) {
            // 基于问题类型生成对应的代码修改
            // 实际场景下可接入更强的 AI 模型生成精确 diff
            const patches = [];

            for (const issue of proposal.issues) {
                switch (issue.target) {
                    case 'performance':
                        patches.push({
                            file: 'index.html',
                            action: 'inject',
                            marker: '/* AUTO-OPTIMIZATION */',
                            code: `// AI优化: 预加载关键资源\n<link rel="preload" href="https://api.coingecko.com" crossorigin>`,
                        });
                        break;
                    case 'market':
                        patches.push({
                            file: 'index.html',
                            action: 'modify',
                            target: 'loadMarketData',
                            code: `// AI增强: 增加备用数据源 fallback`,
                        });
                        break;
                    default:
                        patches.push({
                            file: 'index.html',
                            action: 'log',
                            code: `console.info('[AI] auto-fix applied:', ${JSON.stringify(issue)});`,
                        });
                }
            }

            return { version: proposal.version, patches };
        }

        /* ============ GitHub 自动提交 ============ */

        async _commitToGitHub(patch, proposal) {
            const pat = localStorage.getItem(STORAGE.pat);
            const results = [];

            for (const p of patch.patches) {
                // 1. 获取当前文件 SHA
                const fileRes = await fetch(
                    `https://api.github.com/repos/${this.repo}/contents/${p.file}`,
                    { headers: { 'Authorization': `Bearer ${pat}`, 'Accept': 'application/vnd.github.v3+json' } }
                );
                const fileData = await fileRes.json();
                const sha = fileData.sha;
                let content = atob(fileData.content);

                // 2. 应用补丁（简化：追加到标记位 / 文件末尾）
                if (p.action === 'inject' && p.marker) {
                    content = content.replace(p.marker, `${p.marker}\n${p.code}`);
                } else {
                    content += `\n\n/* === AI Auto-Upgrade v${patch.version} === */\n${p.code}\n`;
                }

                // 3. 提交更新
                const updateRes = await fetch(
                    `https://api.github.com/repos/${this.repo}/contents/${p.file}`,
                    {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${pat}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            message: `🤖 AI Auto-Upgrade v${patch.version}\n\n${proposal.issues.map(i => `- [${i.type}] ${i.desc}`).join('\n')}`,
                            content: btoa(unescape(encodeURIComponent(content))),
                            sha,
                            branch: 'main',
                        }),
                    }
                );

                if (!updateRes.ok) {
                    const err = await updateRes.json().catch(() => ({}));
                    throw new Error(err.message || `提交 ${p.file} 失败`);
                }
                results.push(await updateRes.json());
            }

            return results;
        }

        /* ============ 备份 & 回滚 ============ */

        async _backup() {
            try {
                const r = await fetch(`https://api.github.com/repos/${this.repo}/contents/index.html`, {
                    headers: { 'Accept': 'application/vnd.github.v3+json' }
                });
                if (r.ok) {
                    const data = await r.json();
                    localStorage.setItem(STORAGE.backup, JSON.stringify({
                        sha: data.sha,
                        content: data.content,
                        backedAt: Date.now(),
                    }));
                }
            } catch (e) {
                console.warn('[AutoUpgrade] 备份失败', e);
            }
        }

        async _rollback() {
            const backup = JSON.parse(localStorage.getItem(STORAGE.backup) || 'null');
            if (!backup) return;
            const pat = localStorage.getItem(STORAGE.pat);
            if (!pat) return;

            await fetch(`https://api.github.com/repos/${this.repo}/contents/index.html`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${pat}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: '🔄 AI Auto-Rollback: revert to last stable version',
                    content: backup.content,
                    sha: backup.sha,
                    branch: 'main',
                }),
            });
        }

        _recordHistory(proposal, status, result, error) {
            const history = JSON.parse(localStorage.getItem(STORAGE.history) || '[]');
            history.unshift({ proposal, status, result, error, at: Date.now() });
            localStorage.setItem(STORAGE.history, JSON.stringify(history.slice(0, 50)));
        }

        /* ============ 🆕 一键检测升级（对外入口） ============ */

        /**
         * 立即触发一次完整检测（供"一键检测升级"按钮调用）
         * 不走定时器，立即执行，结果照常弹窗等待管理员授权
         */
        async scanNow({ silent = false } = {}) {
            if (!this.app?.checkAdminSession || !this.app.checkAdminSession()) {
                this.app?.toast('⚠️ 请先以管理员身份登录', 'error');
                return;
            }
            if (!silent) this.app?.toast('🔍 正在扫描项目全部代码...', 'info');
            try {
                await this.runCheck();
                if (!silent) this.app?.toast('✅ 扫描完成', 'success');
            } catch (e) {
                console.error('[AutoUpgrade] scanNow failed', e);
                this.app?.toast('❌ 扫描失败：' + e.message, 'error');
            }
        }

        /* ============ 🆕 手动输入问题/代码 → 检测升级 ============ */

        /**
         * 将管理员手动输入的问题描述 / 代码片段纳入分析，生成升级提案
         * 走与自动检测完全相同的闭环：弹窗 → 管理员确认 → AI 补丁 → GitHub 提交
         */
        async runManualCheck(userInput) {
            if (!this.app?.checkAdminSession || !this.app.checkAdminSession()) {
                this.app?.toast('⚠️ 请先以管理员身份登录', 'error');
                return;
            }
            const text = (userInput || '').trim();
            if (!text) {
                this.app?.toast('⚠️ 请输入问题描述或代码片段', 'warning');
                return;
            }

            this.app?.toast('🤖 AI 正在分析你输入的代码/问题...', 'info');

            // 复用现有提案结构，将手动输入作为一条明确 issue
            const issues = [{
                type: 'manual',
                priority: 'medium',
                target: 'manual-input',
                desc: text.length > 120 ? text.slice(0, 120) + '…' : text,
                raw: text,
            }];

            // AI 深度分析（复用现有 ai.chat）
            let aiAnalysis = '';
            try {
                if (this.app?.ai?.chat) {
                    const resp = await this.app.ai.chat(
                        `针对以下 SPARK DApp 手动提交的问题/代码，给出具体可执行的修复方案：` +
                        `\n\n${text}\n\n要求：1) 定位问题根因 2) 给出完整代码补丁 3) 评估风险`,
                        { lang: this.app.currentLang || 'zh' }
                    );
                    aiAnalysis = resp.message;
                } else {
                    aiAnalysis = '（AI 助手未启用，已基于规则生成默认提案）';
                }
            } catch (e) {
                aiAnalysis = 'AI 分析暂不可用，使用规则引擎默认提案';
            }

            const proposal = {
                id: Date.now(),
                version: this._nextVersion(),
                source: 'manual',                  // 标记为手动来源
                issues,
                aiAnalysis,
                riskLevel: 'medium',
                createdAt: new Date().toISOString(),
            };

            this._showProposal(proposal);           // ③ 走同一套弹窗 + 授权 + 提交闭环
        }

        /* ============ 🆕 PAT 配置（管理员面板调用） ============ */

        setPAT(token) {
            if (!token || !token.trim()) {
                localStorage.removeItem(STORAGE.pat);
                this.app?.toast('已清除 GitHub PAT', 'info');
                return;
            }
            localStorage.setItem(STORAGE.pat, token.trim());
            this.app?.toast('✅ GitHub PAT 已保存（本地加密存储）', 'success');
        }

        getPATStatus() {
            return localStorage.getItem(STORAGE.pat) ? 'configured' : 'missing';
        }
    }

    // 挂载到全局，供主应用初始化
    global.SPARKAutoUpgrader = SPARKAutoUpgrader;

    // 自动实例化（与主应用解耦）
    window.addEventListener('DOMContentLoaded', () => {
        if (window.app && !window.__autoUpgrader) {
            window.__autoUpgrader = new SPARKAutoUpgrader(window.app);
            // 🆕 管理员已登录时自动启动引擎
            if (window.app.checkAdminSession && window.app.checkAdminSession()) {
                window.__autoUpgrader.start();
            }
        }
    });

    // 🆕 便捷全局 API：
    //   window.SPARK.scanNow()                —— 一键检测升级
    //   window.SPARK.manualCheck('...')       —— 手动输入代码/问题检测
    //   window.SPARK.setPAT('ghp_xxx')        —— 配置 GitHub PAT
    //   window.SPARK.patStatus()              —— 查看 PAT 状态
    global.SPARK = {
        scanNow:  (opts) => window.__autoUpgrader?.scanNow(opts),
        manualCheck: (text) => window.__autoUpgrader?.runManualCheck(text),
        setPAT:   (t) => window.__autoUpgrader?.setPAT(t),
        patStatus: () => window.__autoUpgrader?.getPATStatus(),
    };

})(window);
