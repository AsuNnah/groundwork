// node scripts/fixture-workflows.js [--check] : (re)writes the workflows of tests/ci-fixtures/* at the repo root.
// Each fixture is a small real project in a subfolder, so `gw ci` treats it like a monorepo app: the committed workflow
// runs the pack's CI template on real GitHub runners whenever the fixture or its workflow changes. --check fails on drift.
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const REPO = path.join(__dirname, '..'), FIX = path.join(REPO, 'tests', 'ci-fixtures'), WF = path.join(REPO, '.github', 'workflows');
const check = process.argv.includes('--check'), want = new Map();
const code = `const gw = require(${JSON.stringify(path.join(REPO, 'groundwork', 'bin', 'gw.js'))}), fs = require('fs'), path = require('path');
const proj = JSON.parse(fs.readFileSync(path.join(process.env.GW_PROJECT_DIR, '.groundwork', 'project.json'), 'utf8'));
console.log(JSON.stringify(gw.ciPlan(proj, [], null).map(e => { if (!e.fragment) throw new Error(e.why); return { out: e.out, yaml: gw.ciRender(e).yaml }; })));`;
for (const name of fs.readdirSync(FIX).sort()) {
  const r = cp.spawnSync(process.execPath, ['-e', code], { env: { ...process.env, GW_PROJECT_DIR: path.join(FIX, name) }, encoding: 'utf8' });
  if (r.status !== 0) { console.error(`${name}: ${r.stderr}`); process.exit(1); }
  for (const w of JSON.parse(r.stdout)) want.set(path.join(REPO, w.out), w.yaml);
}
const ours = f => /^gw-tests-ci-fixtures-.+\.yml$/.test(f);
const stale = fs.existsSync(WF) ? fs.readdirSync(WF).filter(ours).map(f => path.join(WF, f)).filter(f => !want.has(f)) : [];
const drift = [...want].filter(([f, y]) => !fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== y).map(([f]) => f);
if (check) {
  if (drift.length || stale.length) { console.error('fixture workflows out of date (run node scripts/fixture-workflows.js):\n' + [...drift, ...stale].map(f => '  ' + path.relative(REPO, f)).join('\n')); process.exit(1); }
  console.log(`fixture workflows: ${want.size} up to date`);
} else {
  fs.mkdirSync(WF, { recursive: true });
  for (const [f, y] of want) fs.writeFileSync(f, y);
  for (const f of stale) fs.unlinkSync(f);
  console.log(`fixture workflows: wrote ${want.size}${stale.length ? `, removed ${stale.length}` : ''}`);
}
