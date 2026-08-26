#!/usr/bin/env node
/**
 * 构建：把 src/ 的 ES 模块 + styles.css 打包成单个 index.html
 * 输出：dist/index.html（可直接双击打开，也可部署到 GitHub Pages / IPFS）
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');
const ASSETS = join(ROOT, 'assets');

function read(p) { return readFileSync(join(SRC, p), 'utf8'); }
function b64(p) {
  const buf = readFileSync(join(ASSETS, p));
  // 根据扩展名推断 mime
  const ext = p.endsWith('.png') ? 'image/png' : p.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg';
  return `data:${ext};base64,${buf.toString('base64')}`;
}

// 按依赖顺序拼接 JS（避免 CDN/打包工具依赖）
const modules = [
  'config.js', 'wallet.js', 'storage.js', 'chat.js', 'market.js',
  'shop.js', 'video.js', 'ai.js', 'admin.js', 'github.js', 'app.js',
];
let js = '';
for (const m of modules) {
  let code = read(m);
  // 让每个文件内容在全局作用域可用：把 `export` 去掉，依赖通过全局 window 共享
  // 去掉 ESM 导入（构建后为单文件，无外部依赖）；把导出声明保留并挂到 window
  code = code
    .replace(/^import\s*\{[^}]*\}\s*from\s*['"][^'"]+['"]\s*;?$/gm, '')
    .replace(/^export\s*\{[^}]*\}\s*;?$/gm, '')
    .replace(/^export\s+(default\s+)?/gm, '$1'); // 去掉行首 export，保留声明
  // 对顶层声明追加 window 挂载（类/函数/const）
  code = code.replace(/^(class|function|const|async\s+function)\s+(\w+)/gm, '$1 $2');
  // 挂载语句（在文件末尾统一处理，通过收集声明名）
  const declNames = [];
  code.replace(/^(?:class|function|async\s+function)\s+(\w+)/gm, (_, n) => { declNames.push(n); return _; });
  code.replace(/^const\s+(\w+)\s*=/gm, (_, n) => { declNames.push(n); return _; });
  code += '\n' + declNames.map(n => `window.${n} = ${n};`).join('\n');
  js += `\n/* ====== ${m} ====== */\n` + code;
}

// 注入 __source 引用（指向外部对象，避免内联大 JSON 撑爆主 script）
js = js.replace(/sources\[`src\/\${f}\.js`\] = m\.__source \|\| '';/g, "sources[`src/${f}.js`] = (window.__SPARK_SOURCES__ && window.__SPARK_SOURCES__[f]) || '';");

const css = existsSync(join(SRC, 'styles.css')) ? readFileSync(join(SRC, 'styles.css'), 'utf8') : '';

// 读取 HTML 骨架，注入 css/js
let html = readFileSync(join(SRC, 'index.html'), 'utf8');
// 用 split/join 注入（绝不用 .replace，避免替换串中的 $` $' $& 被特殊解释破坏代码）
html = html.split('/* __INLINE_CSS__ */').join(css);
html = html.split('/* __INLINE_JS__ */').join(js);

// 源码快照 → 独立 sources.js（主路径，绝不内联进主 HTML，彻底规避 script 闭合问题）
// 占位 script 仅声明命名空间；运行时优先读 sources.js，缺失时降级为空对象。
const sourcesObj = {};
modules.forEach(m => { sourcesObj[m.replace('.js', '')] = read(m); });
const sourcesJs = `/* 构建期生成：各模块源码快照，供 AI 自检/升级扫描 */\nwindow.__SPARK_SOURCES__ = ${JSON.stringify(sourcesObj)};\n`;
const dist = join(ROOT, 'dist');
mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, 'sources.js'), sourcesJs);
// 占位 script：仅确保命名空间存在（sources.js 加载后会覆盖填充）
html = html.split('<script>const __SOURCES__ = {};</script>').join('<script>window.__SPARK_SOURCES__ = window.__SPARK_SOURCES__ || {};</script>');
// 将 sources.js 插入到文档中【唯一】的 </body> 之前（精确匹配带前导空白的整行 </body>）
const bodyClose = html.lastIndexOf('</body>');
if (bodyClose > 0 && !html.includes('src="sources.js"')) {
  html = html.slice(0, bodyClose) + '  <script src="sources.js"></script>\n' + html.slice(bodyClose);
}

// 注入本地图片 base64（保证头像/背景在 IPFS 不可达时也必显示）
const logoB64 = existsSync(join(ASSETS, 'logo.png')) ? b64('logo.png') : '';
const bgB64 = existsSync(join(ASSETS, 'background.png')) ? b64('background.png') : '';
// 占位符可能是单引号或双引号包裹，统一用正则替换
html = html.replace(/['"]__LOGO_BASE64__['"]/, JSON.stringify(logoB64));
html = html.replace(/['"]__BG_BASE64__['"]/, JSON.stringify(bgB64));
if (!logoB64) console.warn('⚠️ assets/logo.png 缺失，Logo 将退化为 IPFS');
if (!bgB64) console.warn('⚠️ assets/background.png 缺失，背景将退化为 IPFS');

mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, 'index.html'), html);
console.log('✅ Built dist/index.html');
