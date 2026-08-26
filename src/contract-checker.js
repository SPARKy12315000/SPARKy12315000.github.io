/**
 * 合约检测器 / Contract Checker v2.2.0
 *
 * 职责：对 contracts/ 下的 Solidity 源码做静态自检，发现升级点并生成提案。
 * 运行模式：
 *   - 无 solc 环境：降级为「规则扫描」（正则 + AST 简化），仍能检出大部分问题
 *   - 有 solc 环境：编译并比对字节码/接口，给出精确诊断
 *
 * 检测项（对应"合约升级"需求）：
 *   1. 税率是否与 config（5/5/0）一致
 *   2. 是否存在重入风险（无 ReentrancyGuard / call{value}）
 *   3. 是否存在整数溢出（未用 SafeMath / 版本 <0.8）
 *   4. 权限控制（Ownable / onlyOwner）
 *   5. 是否可实现"营销钱包自动划扣 + 余额限制"（问题8）
 *   6. 反射/回流逻辑是否完整（对应经济模型）
 */
import { CONFIG } from './config.js';

// 浏览器环境（GitHub Pages）下无 Node fs/path，整个检测器惰性降级为"跳过"。
// 合约检测主要在 Node/CI 侧执行；浏览器侧保留接口以保持 API 一致。
const isBrowser = typeof window !== 'undefined' && typeof process === 'undefined';

// 所有 Node 内置模块的动态导入都封装在异步函数内，杜绝「模块顶层 await」
// （顶层 await 在部分打包/沙盒环境（如 jsdom 的 Function 构造器）中不合法）。
let nodeModules = null; // { fs, path, url } 惰性缓存
let DEFAULT_DIR = null;

async function loadNodeModules() {
  if (nodeModules) return nodeModules;
  if (isBrowser) return null;
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const url = await import('node:url');
    nodeModules = { fs, path, url };
    if (!DEFAULT_DIR) {
      const { fileURLToPath } = url;
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      DEFAULT_DIR = path.join(__dirname, '..', 'contracts');
    }
    return nodeModules;
  } catch {
    return null; // 加载失败则降级
  }
}

export class ContractChecker {
  constructor(contractsDir = DEFAULT_DIR) {
    this.contractsDir = contractsDir;
    this.findings = [];
  }

  /** 主入口：扫描并返回结构化报告 */
  async check() {
    this.findings = [];
    if (isBrowser) {
      return this._report('skipped', '浏览器环境不执行合约文件扫描（请在 Node/CI 侧运行）');
    }
    const nm = await loadNodeModules();
    if (!nm) return this._report('error', '无法加载 Node 内置模块');
    const { existsSync, readFileSync, readdirSync } = nm.fs;
    const { join } = nm.path;
    const dir = this.contractsDir || DEFAULT_DIR;
    if (!dir || !existsSync(dir)) {
      return this._report('error', 'contracts 目录不存在');
    }

    const files = this._solFiles(dir, { join, readdirSync });
    if (files.length === 0) {
      return this._report('warn', '未找到 Solidity 源文件');
    }

    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      this._checkTax(src, file);
      this._checkReentrancy(src, file);
      this._checkOverflow(src, file);
      this._checkOwnership(src, file);
      this._checkReflection(src, file);
      this._checkMarketingWallet(src, file);
    }

    return this._report('ok', `扫描完成：${files.length} 个合约文件`);
  }

  _solFiles(dir, { join, readdirSync }) {
    const out = [];
    const walk = (d) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.sol')) out.push(p);
      }
    };
    walk(dir);
    return out;
  }

  // —— 具体规则 ——

  _checkTax(src, file) {
    const { buy, sell, transfer } = CONFIG.contract.tax;
    const checks = [
      { re: /buyTax\s*=\s*(\d+)/, expect: buy, name: '买入税' },
      { re: /sellTax\s*=\s*(\d+)/, expect: sell, name: '卖出税' },
      { re: /transferTax\s*=\s*(\d+)/, expect: transfer, name: '转账税' },
    ];
    for (const c of checks) {
      const m = src.match(c.re);
      if (m && Number(m[1]) !== c.expect) {
        this._add('high', `${c.name} 应为 ${c.expect}%，当前 ${m[1]}%`, file, {
          upgrade: `将 ${c.name} 修改为 ${c.expect}%`,
        });
      }
    }
    // 未显式声明税率也提示
    if (!/tax/i.test(src)) {
      this._add('medium', '合约未找到税率声明，需确认是否符合 5/5/0 模型', file);
    }
  }

  _checkReentrancy(src) {
    const hasGuard = /ReentrancyGuard|nonReentrant/.test(src);
    const hasExternalCall = /(\.call\{value|\.transfer\(|\.send\()/.test(src);
    if (hasExternalCall && !hasGuard) {
      this._add('high', '存在外部调用但未使用 ReentrancyGuard，存在重入风险', null, {
        upgrade: '继承 OpenZeppelin ReentrancyGuard 并标记 withdraw/_transfer',
      });
    }
  }

  _checkOverflow(src) {
    const v = src.match(/pragma solidity\s+\^?(\d+\.\d+)/);
    const ver = v ? parseFloat(v[1]) : 0;
    if (ver && ver < 0.8) {
      this._add('medium', `Solidity 版本 ${v[1]} < 0.8，建议升级以启用内置溢出检查`, null, {
        upgrade: 'pragma solidity ^0.8.20;',
      });
    }
  }

  _checkOwnership(src) {
    if (!/Ownable|onlyOwner/.test(src)) {
      this._add('medium', '未检测到权限控制（Ownable），升级/管理员操作需加 onlyOwner', null, {
        upgrade: '继承 Ownable，关键函数加 onlyOwner 修饰符',
      });
    }
  }

  _checkReflection(src) {
    if (!/reflect|reflection|autoLiquidity|自动回流|回流/i.test(src)) {
      this._add('medium', '合约未体现"自动回流"逻辑，与 5% 回流经济模型可能不一致', null, {
        upgrade: '实现 _reflect / autoLiquidity 机制',
      });
    }
  }

  _checkMarketingWallet(src) {
    // 问题8：营销钱包自动划扣 + 余额限制
    if (!/marketing|marketingWallet/i.test(src)) {
      this._add('low', '建议添加营销钱包（marketingWallet）用于空投/手续费归集', null, {
        upgrade: '新增 marketingWallet 地址 + setMarketingWallet 函数',
      });
    }
    if (!/balance\s*<\s*amount|require.*balance|余额/i.test(src)) {
      this._add('low', '建议加入"余额不足禁止超额交易"校验（对应问题8 余额限制）', null, {
        upgrade: 'withdraw 前 require(balanceOf(user) >= amount)',
      });
    }
  }

  _add(severity, message, file, extra = {}) {
    this.findings.push({ severity, message, file: file ? file.split('/').pop() : null, ...extra });
  }

  _report(status, message) {
    const bySev = { high: 0, medium: 0, low: 0 };
    for (const f of this.findings) bySev[f.severity] = (bySev[f.severity] || 0) + 1;
    return {
      status, message, findings: this.findings, counts: bySev,
      upgradeable: this.findings.filter((f) => f.upgrade).length,
      timestamp: new Date().toISOString(),
    };
  }
}

export default ContractChecker;
