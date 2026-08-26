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

function read(p) { return readFileSync(join(SRC, p), 'utf8'); }

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

// 注入 __source 用于 AI 自检（问题7）
js = js.replace(/sources\[`src\/\${f}\.js`\] = m\.__source \|\| '';/g, "sources[`src/${f}.js`] = __SOURCES__[f] || '';");

const css = existsSync(join(SRC, 'styles.css')) ? readFileSync(join(SRC, 'styles.css'), 'utf8') : '';

// 读取 HTML 骨架，注入 css/js
let html = readFileSync(join(SRC, 'index.html'), 'utf8');
html = html.replace('/* __INLINE_CSS__ */', css);
html = html.replace('/* __INLINE_JS__ */', js);

// 注入各模块源码原文（供 UpgradeAgent.scan 使用）
const sourcesObj = {};
modules.forEach(m => { sourcesObj[m.replace('.js', '')] = read(m); });
html = html.replace('const __SOURCES__ = {};', `const __SOURCES__ = ${JSON.stringify(sourcesObj)};`);

const dist = join(ROOT, 'dist');
mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, 'index.html'), html);
console.log('✅ Built dist/index.html');
