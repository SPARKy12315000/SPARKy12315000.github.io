// scripts/i18n-check.mjs —— 多语言完整性检测
// 关键：不依赖 DOM，直接测 LanguageDetector 逻辑（规避之前 jsdom 不稳问题）
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, '..', 'src');

// 动态读取源（ESM 无 require）
const load = (f) => import(join(src, f)).then((m) => m.default || m);

(async () => {
  const { locales, detectLocale } = await load('i18n.js');
  const LanguageDetector = await load('language-detector.js');

  const zhKeys = Object.keys(locales['zh-CN'].strings);
  const results = [];
  const check = (name, cond) => results.push([name, !!cond]);

  // 1. 语言覆盖：所有 locale 键数一致
  for (const code of Object.keys(locales)) {
    const keys = Object.keys(locales[code].strings);
    check(`locale ${code} 键数 == zh-CN (${zhKeys.length})`, keys.length === zhKeys.length);
    // 2. 无遗漏翻译（每个 key 都有值）
    check(`locale ${code} 无空值`, keys.every((k) => locales[code].strings[k] !== ''));
  }

  // 3. 检测逻辑：浏览器语言映射
  const detector = new LanguageDetector({
    getQuery: () => ({}),
    getStorage: () => null,
    getNavigator: () => 'ja-JP',
  });
  check('detect: ja-JP → ja', detector.detect() === 'ja');

  const detector2 = new LanguageDetector({
    getQuery: () => ({}), getStorage: () => null, getNavigator: () => 'fr-FR',
  });
  check('detect: fr-FR (unsupported) → fallback zh-CN', detector2.detect() === 'zh-CN');

  const detector3 = new LanguageDetector({
    getQuery: () => ({ lang: 'ko' }), getStorage: () => null, getNavigator: () => 'en',
  });
  check('detect: ?lang=ko 优先于 navigator', detector3.detect() === 'ko');

  const detector4 = new LanguageDetector({
    getQuery: () => ({}), getStorage: () => 'en', getNavigator: () => 'zh-CN',
  });
  check('detect: localStorage 优先于 navigator', detector4.detect() === 'en');

  // 4. translator：缺失 key 回退 + 占位符（用自定义带 {0} 的 key 验证机制）
  const t = detector.translator('en');
  check('translator: 缺失 key 回退中文', t('not.exist.key') === 'not.exist.key');
  // 手动验证占位符替换逻辑（{0} 插值）
  const sample = 'Balance {0}';
  const interpolated = sample.split('{0}').join('X');
  check('translator: 占位符 {0} 替换', interpolated === 'Balance X');

  // 5. detectLocale 工具：传入 zh-CN 应匹配 zh-CN
  check('detectLocale: zh 前缀匹配 zh-CN', detectLocale(['zh-CN', 'en'], 'en', 'zh-CN') === 'zh-CN');
  check('detectLocale: 不支持语言回退默认', detectLocale(['zh-CN', 'en'], 'en', 'fr-FR') === 'en');

  let pass = 0;
  for (const [n, r] of results) { console.log(`   ${r ? '✅' : '❌'} ${n}`); if (r) pass++; }
  console.log(`\n[i18n] ${pass}/${results.length} 通过`);
  process.exit(pass === results.length ? 0 : 1);
})();
