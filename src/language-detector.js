/**
 * 语言检测器 v2.2.0
 *
 * 检测优先级（可在 config.i18n.detectOrder 配置）：
 *   1. URL 查询参数  ?lang=en
 *   2. localStorage  spark:locale
 *   3. navigator.language
 *   4. 默认 zh-CN
 *
 * 关键设计：
 *   - 将 window / localStorage / location 抽象为可注入的 `env`，
 *     使 Node 测试无需 jsdom 即可完整覆盖（这是之前 DOM 测试不稳的根因）。
 *   - 所有文本节点的语言属性在翻译时统一走这里，避免任何硬编码中文泄漏到 UI。
 */
import { locales, detectLocale, getStrings } from './i18n.js';
import { CONFIG } from './config.js';

const STORAGE_KEY = 'spark:locale';

export class LanguageDetector {
  constructor(env = {}) {
    this.env = env; // { getQuery, getStorage, getNavigator, document }
    this.supported = CONFIG.i18n.supported;
    this.defaultLocale = CONFIG.i18n.defaultLocale;
  }

  /** 读取当前语言：依次按 detectOrder 尝试 */
  detect() {
    const order = CONFIG.i18n.detectOrder;
    for (const step of order) {
      const lang = this._read(step);
      if (lang && this.supported.includes(lang)) return lang;
    }
    // autoFallback：浏览器语言不在支持列表时，回退到默认
    if (CONFIG.i18n.autoFallback) return this.defaultLocale;
    return this.defaultLocale;
  }

  _read(step) {
    switch (step) {
      case 'query': {
        const q = this.env.getQuery?.();
        return q?.lang || null;
      }
      case 'storage': {
        try { return this.env.getStorage?.(STORAGE_KEY) || null; } catch { return null; }
      }
      case 'navigator': {
        const nav = this.env.getNavigator?.();
        return detectLocale(this.supported, this.defaultLocale, nav);
      }
      case 'default':
        return this.defaultLocale;
      default:
        return null;
    }
  }

  /** 持久化用户选择 */
  save(locale) {
    if (!this.supported.includes(locale)) return false;
    try { this.env.setStorage?.(STORAGE_KEY, locale); } catch { /* ignore */ }
    return true;
  }

  /** 获取翻译函数 t() */
  translator(locale) {
    const strings = getStrings(locale);
    return (key, ...args) => {
      let text = strings[key];
      if (text === undefined) {
        // 缺失 key 回退到中文，避免界面出现空白
        text = getStrings(this.defaultLocale)[key] ?? key;
      }
      // 占位符 {0} {1}
      return args.reduce((acc, v, i) => acc.split(`{${i}}`).join(String(v)), text);
    };
  }

  /** 返回所有可选语言（用于语言切换器渲染） */
  available() {
    return this.supported.map((code) => ({
      code,
      name: locales[code]?.name || code,
      flag: locales[code]?.flag || '',
    }));
  }
}

export default LanguageDetector;
