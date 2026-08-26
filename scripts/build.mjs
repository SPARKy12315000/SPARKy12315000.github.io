// scripts/build.mjs —— 构建单文件产物 dist/index.html
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const srcDir = join(root, 'src');
const publicDir = join(root, 'public');
const distDir = join(root, 'dist');
const assetsDir = join(root, 'assets');

mkdirSync(distDir, { recursive: true });

let html = readFileSync(join(publicDir, 'index.html'), 'utf8');

// 1. 生成/读取本地头像与背景（base64 内联，保障 IPFS 不可达时也永在）
function b64Default(path, fallback) {
  if (existsSync(path)) return readFileSync(path).toString('base64');
  return fallback;
}
// 简易默认图：若 assets/ 无图则用 1x1 透明（生产应由 genimg 产出真实图）
const logoB64 = b64Default(join(assetsDir, 'logo.png'), 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL4WQAAAABJRU5ErkJggg==');
const bgB64 = b64Default(join(assetsDir, 'background.png'), 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL4WQAAAABJRU5ErkJggg==');

// 2. 注入背景 CSS 变量 + 版本号
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
html = html.split('</head>').join(
  `<style>:root{--bg-image:url("data:image/png;base64,${bgB64}")!important;}</style>\n<meta name="spark-version" content="${version}">\n</head>`
);

// 3. logo/background 用 split/join 注入（无 $ 特殊语义风险）
html = html.split('<img class="logo" data-logo').join(`<img class="logo" data-logo src="data:image/png;base64,${logoB64}"`);
html = html.split('<img class="orb" data-logo').join(`<img class="orb" data-logo src="data:image/png;base64,${logoB64}"`);
html = html.split('<img data-logo alt="Logo"').join(`<img data-logo src="data:image/png;base64,${logoB64}" alt="Logo"`);
html = html.split('<img data-bg alt="Background"').join(`<img data-bg src="data:image/png;base64,${bgB64}" alt="Background"`);

// 4. 内联所有 src/*.js 为单个 <script type="module"> 块（避免外部路径，适配 GitHub Pages 子路径）
const modules = [
  'config.js', 'i18n.js', 'language-detector.js', 'wallet.js', 'storage.js',
  'chat.js', 'shop.js', 'market.js', 'video.js', 'admin.js',
  'contract-checker.js', 'site-checker.js', 'ai-upgrader.js', 'app.js',
];
let bundle = '';
for (const m of modules) {
  const p = join(srcDir, m);
  if (!existsSync(p)) continue;
  bundle += `\n/* ===== ${m} ===== */\n` + readFileSync(p, 'utf8');
}

// 剥离 ESM 语法，改为全局类（逐行处理，避免正则跨行/括号误判）
// 兼容浏览器：import.meta.url → document.baseURI（jsdom 也支持）
bundle = bundle.replace(/import\.meta\.url/g, 'document.baseURI');
bundle = bundle
  .split('\n')
  .filter((line) => {
    const t = line.trim();
    // 去掉：import xxx from './xxx'   /   import { a, b } from 'fs'   /   export { xxx }
    if (/^import\s+.*from\s+['"]/.test(t)) return false;
    if (/^export\s*\{/.test(t)) return false;
    return true;
  })
  .join('\n')
  // export default X  →  window.__SPARK_MOD__ = X
  .replace(/^export\s+default\s+/gm, 'window.__SPARK_MOD__ = ')
  // export class Foo {  →  class Foo {
  .replace(/^export\s+class\s+/gm, 'class ')
  // export function foo(  →  function foo(
  .replace(/^export\s+function\s+/gm, 'function ')
  // export const FOO =  →  const FOO =
  .replace(/^export\s+const\s+/gm, 'const ')
  // 动态 import('crypto') 保留（运行时按需加载，浏览器有兜底）
  ;

html = html.split('<script type="module" src="../src/app.js"></script>')
  .join(`<script type="module">\n${bundle}\nnew window.__SPARK_MOD__();\n</script>`);

writeFileSync(join(distDir, 'index.html'), html, 'utf8');

console.log(`✅ Build done: dist/index.html (${(html.length / 1024).toFixed(1)} KB)`);
console.log(`   version: ${version}`);

// 自检：不得含未替换占位 / 不得含 import
const checks = [
  ['no leftover data-logo without src', !/data-logo(?![^>]*src=)/.test(html)],
  ['no ESM import remains', !/^import\s+[^()]*from\s+['"]/m.test(html)],
  ['has charset UTF-8', /charset="?UTF-8"?/i.test(html)],
  ['has SPARK contract addr', html.includes('0xD580C7C9Cde5ce776fEed844310330A2a40078d9'.toLowerCase()) || html.includes('0xD580C7C9Cde5ce776fEed844310330A2a40078d9')],
  ['tax 5% 5% 0%', (/5%/g.test(html)) && html.includes('0%')],
  ['i18n switcher', /data-i18n-switch/.test(html)],
  ['SW disabled', /getRegistrations/.test(html) && /unregister/.test(html)],
];
let ok = true;
for (const [name, pass] of checks) { console.log(`   ${pass ? '✅' : '❌'} ${name}`); if (!pass) ok = false; }
process.exit(ok ? 0 : 1);
