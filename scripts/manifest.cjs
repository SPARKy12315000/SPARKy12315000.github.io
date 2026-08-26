const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const entries = [];

function walk(dir){
  for (const f of fs.readdirSync(dir)){
    const p = path.join(dir, f);
    const s = fs.statSync(p);
    if (s.isDirectory()){
      if (['node_modules','.git','apk-out','_site','android'].includes(f)) continue;
      walk(p);
    } else {
      const rel = path.relative(ROOT, p).replace(/\\/g,'/');
      entries.push({ path: rel, lines: s.size < 200000 ? (fs.readFileSync(p,'utf8').split('\n').length) : '-', size: (s.size/1024).toFixed(1)+'KB' });
    }
  }
}
walk(ROOT);
console.log(JSON.stringify(entries, null, 2));
console.log('\n总计:', entries.length, '个文件');
