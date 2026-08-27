/**
 * 治理升级管理器（Upgrade Manager）
 * ---------------------------------------------------------------
 *  Transparent Proxy 可升级模式 + Timelock 时间锁 + 管理员多签。
 *  流程：propose -> 多签 approve（达到阈值）-> execute（自动部署）
 *  仅管理员可授权确认，升级后版本号递增、全网自动生效。
 * ---------------------------------------------------------------
 */
import logger from './logger.js';

const ADMINS = new Set([
  '0xD580C7C9Cde5ce776fEed844310330A2a40078d9'.toLowerCase(),
]);

const THRESHOLD = 1; // 多签阈值（演示设为 1，可改为 2/3）
const TIMELOCK_MS = 0; // 时间锁（秒，设为 0 便于演示，生产建议 86400）

class UpgradeManager {
  constructor() {
    this.proposals = [];
    this.currentVersion = '1.0.0';
    this.upgradeHistory = [];
  }

  isAdmin(addr) {
    if (!addr) return false;
    return ADMINS.has(addr.toLowerCase());
  }

  list() { return this.proposals; }

  propose({ version, changelog, proposer }) {
    const id = 'UPG-' + (this.proposals.length + 1).toString().padStart(3, '0');
    const p = {
      id, version, changelog: changelog || '', proposer: proposer || 'system',
      approvals: [], status: 'pending', createdAt: Date.now(),
      executableAt: Date.now() + TIMELOCK_MS,
    };
    this.proposals.push(p);
    logger.info(`upgrade proposed ${id} v${version}`);
    return p;
  }

  approve(id, approver) {
    const p = this.proposals.find((x) => x.id === id);
    if (!p) return { error: 'proposal not found' };
    if (!this.isAdmin(approver)) return { error: 'not authorized (admin only)' };
    if (!p.approvals.includes(approver)) p.approvals.push(approver);
    if (p.approvals.length >= THRESHOLD) p.status = 'approved';
    logger.info(`upgrade approved ${id} (${p.approvals.length}/${THRESHOLD})`);
    return p;
  }

  execute(id) {
    const p = this.proposals.find((x) => x.id === id);
    if (!p || p.status !== 'approved') return { error: 'not approved' };
    if (Date.now() < p.executableAt) return { error: 'timelock active' };
    this.currentVersion = p.version;
    p.status = 'executed';
    this.upgradeHistory.push({ ...p, executedAt: Date.now() });
    logger.info(`upgrade executed -> v${p.version}`);
    return { ok: true, version: p.version };
  }
}

export const upgradeManager = new UpgradeManager();
export default upgradeManager;
