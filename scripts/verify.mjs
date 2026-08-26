// scripts/verify.mjs —— 入口，直接转发到 selfcheck
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
await import(join(__dirname, 'selfcheck.mjs'));
function join() { return __dirname + '/' + [...arguments].join('/'); }
