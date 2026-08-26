#!/usr/bin/env node
/**
 * 语法自检（问题7 中 AI 升级的前置校验）
 * 用 Node 内置 vm/--check 对每个 JS 文件做真实语法解析，避免正则误报。
 */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');
let errors = 0;

for (const f of readdirSync(SRC)) {
  if (!f.endsWith('.js')) continue;
  const file = join(SRC, f);
  try {
    // node --check 用 CommonJS 解析；ESM 的 import/export 需 --input-type=module，写临时文件更稳
    const code = readFileSync(file, 'utf8');
    execSync(`node --input-type=module --check -`, { input: code, stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(`✅ ${f}`);
  } catch (e) {
    errors++;
    console.error(`❌ ${f}\n${e.stderr?.toString() || e.message}`);
  }
}
console.log(errors ? `\n❌ ${errors} syntax error(s)` : '\n✅ All files pass syntax check');
process.exit(errors ? 1 : 0);
