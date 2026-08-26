// scripts/lint.mjs —— 代码静态扫描（无外部依赖，纯正则）
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, '..', 'src');

const rules = [
  { id: 'no-debugger', re: /\bdebugger\b/, msg: '包含 debugger 语句' },
  { id: 'no-alert-in-prod', re: /\balert\(/, msg: '生产代码含 alert（建议用 UI 提示）' },
  { id: 'no-eval', re: /\beval\(/, msg: '禁止 eval' },
  { id: 'no-console-error', re: /console\.error/, msg: '遗留 console.error' },
  { id: 'no-todo', re: /\b(TODO|FIXME|XXX)\b/, msg: '遗留 TODO/FIXME' },
];

const files = [];
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) files.push(p);
  }
};
walk(srcDir);

const issues = [];
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const rule of rules) {
      if (rule.re.test(line)) issues.push({ file: f.split('/').pop(), line: i + 1, rule: rule.id, msg: rule.msg });
    }
  });
}

console.log(`[lint] 扫描 ${files.length} 个文件，发现 ${issues.length} 项`);
for (const it of issues) console.log(`   ${it.file}:${it.line} [${it.rule}] ${it.msg}`);
process.exit(0);
