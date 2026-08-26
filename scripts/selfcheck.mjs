// scripts/selfcheck.mjs —— 全量自检聚合（本轮"检测"主入口）
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

async function run(name, fn) {
  process.stdout.write(`▶ ${name} ... `);
  try { const r = await fn(); console.log('✅'); return { name, ok: true, result: r }; }
  catch (e) { console.log('❌ ' + e.message); return { name, ok: false, error: e.message }; }
}

const steps = [];

steps.push(await run('构建 build', async () => {
  const { execSync } = await import('child_process');
  const out = execSync('node scripts/build.mjs', { cwd: root, stdio: 'pipe' }).toString();
  if (!/Build done/.test(out)) throw new Error('构建未产出产物');
  return out;
}));

steps.push(await run('代码扫描 lint', async () => {
  const { execSync } = await import('child_process');
  return execSync('node scripts/lint.mjs', { cwd: root, stdio: 'pipe' }).toString();
}));

steps.push(await run('多语言 i18n', async () => {
  const { execSync } = await import('child_process');
  return execSync('node scripts/i18n-check.mjs', { cwd: root, stdio: 'pipe' }).toString();
}));

steps.push(await run('合约检测 contract', async () => {
  const { execSync } = await import('child_process');
  return execSync('node scripts/contract-check.mjs', { cwd: root, stdio: 'pipe' }).toString();
}));

steps.push(await run('官网检测（本地产物）', async () => {
  const { default: SiteChecker } = await import(join(srcDir(), 'site-checker.js'));
  const html = readFileSync(join(root, 'dist', 'index.html'), 'utf8');
  const checker = new SiteChecker({});
  const r = checker.checkLocal(html);
  if (r.counts.high > 0) throw new Error(`${r.counts.high} 个高危偏离：${r.findings.map(f => f.message).join(' | ')}`);
  return r;
}));

steps.push(await run('AI 升级提案生成', async () => {
  const { default: AIUpgrader } = await import(join(srcDir(), 'ai-upgrader.js'));
  const html = readFileSync(join(root, 'dist', 'index.html'), 'utf8');
  const ai = new AIUpgrader({ siteHtml: html });
  const proposal = await ai.scan();
  console.log(`\n   [proposal] v${proposal.version} → v${proposal.targetVersion}, ${proposal.findings.length} 项, ${proposal.actions.length} 个动作`);
  return proposal;
}));

function srcDir() { return join(__dirname, '..', 'src'); }

const failed = steps.filter((s) => !s.ok);
console.log(`\n${'='.repeat(50)}`);
console.log(`自检完成：${steps.length - failed.length}/${steps.length} 通过`);

if (failed.length) {
  console.log('\n需处理：');
  for (const f of failed) console.log(`  ❌ ${f.name}: ${f.error}`);
  process.exit(1);
}
console.log('\n🎉 全部检测通过，产物 dist/index.html 已就绪，可部署。');
process.exit(0);
