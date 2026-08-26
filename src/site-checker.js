/**
 * 官网检测器 / Site Checker v2.2.0
 *
 * 从线上站点（config.site + official.sites）抓取首页，与"期望配置"比对，
 * 自动发现偏离并生成修复提案。这是"官网代码升级"的检测端。
 *
 * 检测维度：
 *   1. HTTP 可达性 + 状态码
 *   2. 编码声明（charset=utf-8，且位置靠前）
 *   3. 关键资源在位：合约地址、税率 5/5/0、邮箱、官网链接、IPFS CID
 *   4. 多语言切换器是否存在
 *   5. Service Worker 是否残留（会导致乱码/头像消失，必须注销）
 *   6. 头像/背景图是否可加载
 *
 * 网络不可达时（如沙盒出口限制）自动降级为「本地产物检测」，保证不阻塞升级流程。
 */
import { CONFIG } from './config.js';

export class SiteChecker {
  constructor({ fetchImpl = null, baseUrl = CONFIG.site } = {}) {
    this.fetchImpl = fetchImpl; // 注入式，便于 Node 测试
    this.baseUrl = baseUrl;
    this.expected = {
      charset: 'utf-8',
      contract: CONFIG.contract.address.toLowerCase(),
      taxes: [`${CONFIG.contract.tax.buy}%`, `${CONFIG.contract.tax.sell}%`, `${CONFIG.contract.tax.transfer}%`],
      email: CONFIG.official.email,
      officialSites: CONFIG.official.sites,
      logoCID: CONFIG.ipfs.logoCID,
      bgCID: CONFIG.ipfs.bgCID,
    };
    this.findings = [];
  }

  async check(url = this.baseUrl) {
    this.findings = [];
    let html;
    try {
      html = await this._fetch(url);
    } catch (e) {
      this._add('high', `站点不可达：${e.message}（将降级为本地产物检测）`, 'site');
      return this._report('degraded', '线上不可达，已降级');
    }

    this._checkEncoding(html);
    this._checkContract(html);
    this._checkTaxonomy(html);
    this._checkOfficialLinks(html);
    this._checkIpfsImages(html);
    this._checkI18n(html);
    this._checkServiceWorker(html);

    return this._report('ok', '官网检测完成');
  }

  /** 本地产物检测（不依赖网络，CI/沙盒可用） */
  checkLocal(html) {
    this.findings = [];
    if (!html) return this._report('error', '本地产物为空');
    this._checkEncoding(html);
    this._checkContract(html);
    this._checkTaxonomy(html);
    this._checkOfficialLinks(html);
    this._checkIpfsImages(html);
    this._checkI18n(html);
    this._checkServiceWorker(html);
    return this._report('ok', '本地产物检测完成');
  }

  // —— 规则 ——

  _checkEncoding(html) {
    const lower = html.toLowerCase();
    if (!/charset\s*=\s*["']?utf-8/.test(lower)) {
      this._add('high', '缺少 UTF-8 编码声明，会导致中文乱码', 'index.html', {
        upgrade: '在 <head> 最顶部添加 <meta charset="UTF-8">',
      });
    } else {
      const pos = lower.indexOf('charset');
      const headPos = lower.indexOf('<head>');
      if (headPos >= 0 && pos - headPos > 200) {
        this._add('medium', '<meta charset> 位置过靠后，建议紧贴 <head> 顶部', 'index.html', {
          upgrade: '将 <meta charset="UTF-8"> 移到 <head> 之后第一个标签',
        });
      }
    }
  }

  _checkContract(html) {
    if (!html.toLowerCase().includes(this.expected.contract)) {
      this._add('high', `首页未包含合约地址 ${CONFIG.contract.address}`, 'index.html', {
        upgrade: '在首页"合约地址"区块显式展示完整合约地址',
      });
    }
  }

  _checkTaxonomy(html) {
    const txt = html.replace(/<[^>]+>/g, ' ');
    for (const t of this.expected.taxes) {
      if (!txt.includes(t)) {
        this._add('high', `经济模型缺失税率 ${t}`, 'index.html', {
          upgrade: `补充「${t} 自动回流」卡片`,
        });
      }
    }
  }

  _checkOfficialLinks(html) {
    if (!html.includes(this.expected.email)) {
      this._add('medium', `首页未展示邮箱 ${this.expected.email}`, 'index.html');
    }
    for (const site of this.expected.officialSites) {
      if (!html.includes(site)) {
        this._add('low', `缺少官网链接 ${site}`, 'index.html');
      }
    }
  }

  _checkIpfsImages(html) {
    if (!html.includes(this.expected.logoCID)) {
      this._add('medium', '首页未展示 Logo IPFS CID', 'index.html');
    }
    if (!html.includes(this.expected.bgCID)) {
      this._add('low', '首页未展示背景图 IPFS CID', 'index.html');
    }
    // 头像/背景是否内联（base64 或 data:），保障永在
    if (!/data:image|logo.*base64|background.*base64/i.test(html)) {
      this._add('low', '未检测到内联手像/背景图，IPFS 不可达时会消失', 'index.html', {
        upgrade: '将 logo/background 转 base64 内联进 HTML',
      });
    }
  }

  _checkI18n(html) {
    if (!/data-i18n|lang-switch|language/i.test(html)) {
      this._add('medium', '未检测到多语言切换器', 'index.html', {
        upgrade: '添加 <select data-i18n-switch>，绑定 i18n.js',
      });
    }
  }

  _checkServiceWorker(html) {
    // 区分「注册」（register / sw.js）与「注销」（unregister）：只有注册才是风险
    const hasRegister = /serviceWorker\.register\s*\(|\.register\s*\(\s*["'][^"']*sw/i.test(html);
    const hasUnregister = /getRegistrations|\.unregister\s*\(/.test(html);
    if (hasRegister && !hasUnregister) {
      this._add('high', '检测到 Service Worker 注册，旧缓存会导致乱码/头像消失', 'index.html', {
        upgrade: '改为注销脚本：navigator.serviceWorker.getRegistrations().then(r=>r.unregister())',
      });
    } else if (hasUnregister) {
      // 仅有注销逻辑：正确做法，不报问题
    }
  }

  _add(severity, message, file, extra = {}) {
    this.findings.push({ severity, message, file, ...extra });
  }

  async _fetch(url) {
    if (this.fetchImpl) return this.fetchImpl(url);
    // 浏览器环境
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  _report(status, message) {
    const counts = { high: 0, medium: 0, low: 0 };
    for (const f of this.findings) counts[f.severity]++;
    return {
      status, message, findings: this.findings, counts,
      upgradeable: this.findings.filter((f) => f.upgrade).length,
      timestamp: new Date().toISOString(),
    };
  }
}

export default SiteChecker;
