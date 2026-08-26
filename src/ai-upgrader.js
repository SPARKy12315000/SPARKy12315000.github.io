/**
 * AI 升级中枢 v2.2.0
 *
 * 流程：扫描 → 生成提案 → （管理员授权）→ 应用
 * 安全原则：
 *   - autoApply 恒为 false，任何代码改动都必须管理员手动确认
 *   - 每次扫描产出结构化 proposal，包含影响面评估与回滚方案
 *   - 升级动作本身只做「文件替换 + 版本号递增」，不执行任意代码
 */
import { ContractChecker } from './contract-checker.js';
import { SiteChecker } from './site-checker.js';
import { CONFIG } from './config.js';

export class AIUpgrader {
  constructor({ contractsDir, siteHtml } = {}) {
    this.contractChecker = new ContractChecker(contractsDir);
    this.siteChecker = new SiteChecker({});
    this.siteHtml = siteHtml; // 本地产物 HTML，用于离线检测
    this.proposal = null;
  }

  /** 全量扫描：合约 + 官网 */
  async scan() {
    const [contractReport, siteReport] = await Promise.all([
      this.contractChecker.check(),
      this.siteHtml
        ? Promise.resolve(this.siteChecker.checkLocal(this.siteHtml))
        : this.siteChecker.check(),
    ]);

    const allFindings = [
      ...contractReport.findings.map((f) => ({ ...f, domain: 'contract' })),
      ...siteReport.findings.map((f) => ({ ...f, domain: 'site' })),
    ];

    this.proposal = {
      version: CONFIG.version,
      targetVersion: this._nextVersion(),
      scannedAt: new Date().toISOString(),
      summary: {
        total: allFindings.length,
        high: allFindings.filter((f) => f.severity === 'high').length,
        medium: allFindings.filter((f) => f.severity === 'medium').length,
        low: allFindings.filter((f) => f.severity === 'low').length,
      },
      findings: allFindings,
      // 自动生成的修复动作（仅描述，不执行）
      actions: allFindings
        .filter((f) => f.upgrade)
        .map((f, i) => ({
          id: `ACT-${i + 1}`,
          domain: f.domain,
          file: f.file,
          description: f.upgrade,
          rollback: `git revert 或回退至 v${CONFIG.version}`,
        })),
      requiresAdmin: true,
      autoApply: false,
    };

    return this.proposal;
  }

  /** 管理员授权后应用：当前实现仅"确认提案有效"，实际改动由人工合并后重新构建 */
  apply(adminToken) {
    if (!this.proposal) throw new Error('请先执行 scan()');
    if (!this._verifyAdmin(adminToken)) {
      return { ok: false, reason: '管理员权限校验失败，拒绝应用升级' };
    }
    if (this.proposal.summary.high > 0) {
      return {
        ok: false,
        reason: `存在 ${this.proposal.summary.high} 个高危问题，请管理员审阅后手动合并`,
        proposal: this.proposal,
      };
    }
    return {
      ok: true,
      proposal: this.proposal,
      message: '升级已授权。建议按 actions 逐项修改后运行 npm run build && npm run deploy:cachefix',
    };
  }

  _verifyAdmin(token) {
    // 简化：实际应比对管理员会话/多签；此处仅校验非空
    return typeof token === 'string' && token.length > 0;
  }

  _nextVersion() {
    const [a, b, c] = CONFIG.version.split('-')[0].split('.').map(Number);
    return `${a}.${b}.${c + 1}`;
  }
}

export default AIUpgrader;
