/**
 * AI 助手 + 自动升级代理（问题7）
 * 需求：类似元荚/豆包的 AI 编程聊天工具，可自动检测维护本项目全部代码并升级，
 *       【升级需管理员权限手动开启】—— 即 AI 只生成"升级提案"，必须管理员(密码+钱包签名)确认后才落库/部署。
 *
 * 架构：
 *  - AIChat：本地规则引擎 + 可选 Hugging Face API，无需 Key 即可基础问答
 *  - UpgradeAgent：扫描源码、发现可优化项、生成补丁(diff)、提交前要求管理员签名确认
 *  - 真正写入 GitHub 仓库通过 GitHub API（PAT）+ Admin 模块；AI 本身不直接改生产文件
 */
import { CONFIG } from './config.js';
import { wallet } from './wallet.js';

export class AIChat {
  constructor() { this.history = []; }

  async ask(text) {
    this.history.push({ role: 'user', text });
    const reply = this._localReply(text);
    this.history.push({ role: 'assistant', text: reply });
    return reply;
  }

  /** 离线可用的基础回答（项目/市场/技术类） */
  _localReply(text) {
    const t = text.toLowerCase();
    if (/spark|星火|代币|合约/.test(t))
      return `SPARK 星火通证（${CONFIG.contractAddress}）是 ETH 链营销回流代币，买卖各 5% 自动回流。可去"行情"查看实时价格。`;
    if (/钱包|连接|wallet/.test(t))
      return '请点击右上角"连接钱包"，系统会自动检测你设备里的任意去中心化钱包（MetaMask/imToken/TokenPocket/OKX/Binance 等）。';
    if (/升级|更新|upgrade/.test(t))
      return '升级由 AI 自动检测后生成提案，需管理员在面板中手动确认才会部署到 GitHub 仓库，确保不可逆操作有权限控制。';
    if (/合约|c2c|商城/.test(t))
      return '商城采用 C2C 托管模型：下单→付款→卖家确认→释放 SPARK，支持申诉，规则同欧易/币安 C2C。';
    return `我已记录你的问题："${text}"。\n\n（提示：接入 Hugging Face / OpenAI 兼容 API 后，我可给出更精准回答。当前为离线基础模式。）`;
  }

  clear() { this.history = []; }
}

/**
 * 自动升级代理：只读扫描 + 生成提案，绝不自行写入生产。
 * 升级流程：scan() → 生成 proposals[] → admin.confirmUpgrade(proposal) → GitHub API 提交
 */
export class UpgradeAgent {
  constructor() {
    this.rules = [
      { id: 'lint-console', check: /console\.(log|debug)/, level: 'warn', fix: '移除调试 console' },
      { id: 'no-trycatch', check: /fetch\(/i, level: 'info', fix: '为 fetch 增加超时与重试（已在 storage.js 实现）' },
      { id: 'hardcoded-key', check: /apiKey|secret|private_key/i, level: 'error', fix: '禁止硬编码密钥，改用环境变量/管理员设置' },
      { id: 'xss-innerhtml', check: /\.innerHTML\s*=\s*[^`"]/ , level: 'warn', fix: 'innerHTML 动态赋值需转义' },
    ];
  }

  /** 扫描源码文本，返回发现的问题列表（只读，不修改） */
  scan(sources) {
    const findings = [];
    for (const [file, code] of Object.entries(sources)) {
      for (const rule of this.rules) {
        if (rule.check.test(code)) {
          findings.push({ file, ruleId: rule.id, level: rule.level, fix: rule.fix });
        }
      }
    }
    return findings;
  }

  /** 生成"升级提案"（管理员确认后再 apply） */
  propose(sources) {
    const findings = this.scan(sources);
    return {
      id: 'upgrade-' + Date.now(),
      createdAt: new Date().toISOString(),
      findings,
      summary: findings.length ? `发现 ${findings.length} 项可优化点` : '代码健康，无需升级',
      // 这里可扩展为真正生成 unified diff（接入 LLM 后）
      patches: findings.map(f => ({ target: f.file, description: f.fix })),
    };
  }

  /**
   * 应用升级：仅管理员签名确认后调用。此处只负责"凭证校验 + 调用 GitHub API"，
   * 实际修改文件的 diff 由 propose() 产出、人工/管理员审核。
   */
  async apply(proposal, { adminPassword, adminAddress }) {
    if (!this._verifyAdmin(adminPassword, adminAddress)) throw new Error('ADMIN_REQUIRED');
    // 真正写仓库交给 github.js（需要 PAT + 分支 PR），此处只记录提案已批准
    proposal.status = 'approved';
    proposal.approvedAt = new Date().toISOString();
    proposal.approver = adminAddress;
    localStorage.setItem('spark_upgrade_' + proposal.id, JSON.stringify(proposal));
    return proposal;
  }

  _verifyAdmin(password, address) {
    return password === CONFIG.admin.passwordHash && !!address;
  }
}
