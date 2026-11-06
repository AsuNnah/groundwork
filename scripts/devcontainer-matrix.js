// node scripts/devcontainer-matrix.js                 → JSON list of every distinct dev container (one sample stack per block set)
// node scripts/devcontainer-matrix.js <id> <dir>      → a sample project in <dir>: gw devcontainer output + .gw-check.sh
// Used by .github/workflows/devcontainers.yml, which builds each one with the devcontainer CLI and runs its checks inside.
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const REPO = path.join(__dirname, '..'), gw = require(path.join(REPO, 'groundwork', 'bin', 'gw.js'));
const sets = new Map();
for (const [target, pk] of Object.entries(gw.packs())) for (const [stack, st] of Object.entries(pk.stacks || {}))
  if ((st.devcontainer || []).length) { const id = st.devcontainer.join('+'); if (!sets.has(id)) sets.set(id, { id, target, stack }); }
const [id, dir] = process.argv.slice(2);
if (!id) { console.log(JSON.stringify([...sets.values()])); process.exit(0); }
const s = sets.get(id); if (!s) throw new Error('unknown set ' + id);
fs.mkdirSync(path.join(dir, '.groundwork'), { recursive: true });
fs.writeFileSync(path.join(dir, '.groundwork', 'project.json'), JSON.stringify({ name: 'dc-check', targets: [s.target], stacks: { [s.target]: s.stack } }));
const r = cp.spawnSync(process.execPath, ['-e', `const gw = require(${JSON.stringify(path.join(REPO, 'groundwork', 'bin', 'gw.js'))});
  const p = gw.devcontainerPlan(JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))); console.log(JSON.stringify(p));`, path.join(dir, '.groundwork', 'project.json')],
  { env: { ...process.env, GW_PROJECT_DIR: dir }, encoding: 'utf8' });
if (r.status !== 0) throw new Error(r.stderr);
const p = JSON.parse(r.stdout);
fs.mkdirSync(path.join(dir, '.devcontainer'), { recursive: true });
fs.writeFileSync(path.join(dir, '.devcontainer', 'devcontainer.json'), JSON.stringify(p.dc, null, 2));
fs.writeFileSync(path.join(dir, '.gw-check.sh'), 'set -e\ntrap \'echo "failed; PATH=$PATH"\' ERR\n' + p.checks.map(c => `echo "== ${c.block}: ${c.cmd.replace(/"/g, '\\"')}"\n${c.cmd}`).join('\n') + '\n');
console.log(JSON.stringify(p.dc, null, 2));
