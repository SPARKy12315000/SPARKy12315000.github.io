/**
 * GitHub 部署模块（问题7：升级需管理员手动开启后自动提交到仓库）
 * 目标仓库：SPARKy12315000/SPARKy12315000.github.io
 * 鉴权：管理员在面板填入 PAT（ghp_***），仅管理员确认后才调用。
 * 流程：读文件 SHA → 更新/创建 → 提交到 main → GitHub Pages 自动发布到 sparky12315000.github.io
 *
 * ⚠️ 安全：PAT 仅存于内存 + 管理员会话，不写 localStorage，不入库。
 */
import { CONFIG } from './config.js';

export class GitHubDeploy {
  constructor(pat) { this.pat = pat; }

  setPAT(pat) { this.pat = pat; }

  _headers(extra = {}) {
    if (!this.pat) throw new Error('PAT_REQUIRED');
    return { Authorization: `Bearer ${this.pat}`, Accept: 'application/vnd.github+json', ...extra };
  }

  /** 获取仓库文件内容 + SHA（更新必需） */
  async getFile(path) {
    const url = `${CONFIG.repo.apiBase}/repos/${CONFIG.repo.owner}/${CONFIG.repo.name}/contents/${path}?ref=${CONFIG.repo.branch}`;
    const res = await fetch(url, { headers: this._headers() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('GET_FAIL:' + res.status);
    const j = await res.json();
    return { sha: j.sha, content: j.content ? atob(j.content) : '', path: j.path };
  }

  /** 提交单个文件（升级提案/新版本） */
  async commitFile(path, content, message) {
    const existing = await this.getFile(path);
    const body = {
      message, path, branch: CONFIG.repo.branch,
      content: btoa(unescape(encodeURIComponent(content))),
      ...(existing ? { sha: existing.sha } : {}),
    };
    const res = await fetch(`${CONFIG.repo.apiBase}/repos/${CONFIG.repo.owner}/${CONFIG.repo.name}/contents/${path}`, {
      method: 'PUT', headers: this._headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('COMMIT_FAIL:' + res.status + ' ' + await res.text());
    return res.json();
  }

  /** 部署整个构建目录（管理员确认后调用） */
  async deployAll(files, message = 'chore: auto-upgrade by admin') {
    const results = [];
    for (const [path, content] of Object.entries(files)) {
      results.push(await this.commitFile(path, content, `${message}: ${path}`));
    }
    return results;
  }

  /** 检查仓库是否存在 / PAT 是否有效 */
  async check() {
    const res = await fetch(`${CONFIG.repo.apiBase}/repos/${CONFIG.repo.owner}/${CONFIG.repo.name}`, { headers: this._headers() });
    return res.ok;
  }
}

export const github = new GitHubDeploy();
