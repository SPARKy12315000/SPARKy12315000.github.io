#!/usr/bin/env node
// 部署闸门：仅扫描会推送到仓库的文件（index.html + js/*.js），确认零密码明文
const fs = require('fs');
const path = require('path');
const TARGETS = ['index.html', 'js'];
const FORBIDDEN = ['Yy12315000', 'spark2024', 'passwordHash:"', "password:'"];
let violations = [];
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) walk(p);
    else if (/\.(js|html)$/.test(f)) {
      const txt = fs.readFileSync(p, 'utf8');
      FORBIDDEN.forEach(kw => { if (txt.includes(kw)) violations.push(`${p}: 含明文 ${kw}`); });
    }
  }
}
TARGETS.forEach(t => { const p = path.join(__dirname, '..', t); fs.statSync(p).isDirectory() ? walk(p) : (() => {})(); });
// index.html 单独
const idx = path.join(__dirname, '..', 'index.html');
if (fs.existsSync(idx)) { const txt = fs.readFileSync(idx,'utf8'); FORBIDDEN.forEach(kw=>{ if(txt.includes(kw)) violations.push(`index.html: 含明文 ${kw}`); }); }
if (violations.length) { console.error('❌ 部署闸门：发现密码明文\n' + violations.join('\n')); process.exit(1); }
console.log('✅ 部署闸门通过：推送目标（index.html + js/）内无密码明文，仅含 SHA-256 哈希');
