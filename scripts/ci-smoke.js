// CI smoke test on the real runner: host scanners, then gw init/doctor/status/run in a fresh project.
'use strict';
const assert = require('assert'), cp = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const FW = path.join(__dirname, '..', 'groundwork'), win = process.platform === 'win32';
const sh = (cmd, args, cwd) => {
  const r = cp.spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  console.log(`$ ${cmd} ${args.join(' ')}  → exit ${r.status}\n${(r.stdout || '').slice(-1500)}${r.stderr ? '\n[stderr] ' + r.stderr.slice(-800) : ''}`);
  assert.equal(r.status, 0, `${cmd} failed`); return r.stdout;
};
const profile = file => {
  const raw = fs.readFileSync(file);
  assert.notDeepEqual([...raw.subarray(0, 3)], [0xef, 0xbb, 0xbf], `${file} starts with a UTF-8 BOM`);
  const h = JSON.parse(raw.toString('utf8'));
  assert.equal(h.schema, 'groundwork.host-profile.v1');
  assert.equal(h.os.family, { win32: 'windows', linux: 'linux', darwin: 'macos' }[process.platform]);
  assert.ok(h.cpu.threads > 0 && h.memory.total_gb > 0, 'cpu/memory read');
  assert.ok(h.toolchains.node && h.toolchains.git, 'node and git detected');
  return h;
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-smoke-'));
if (win) {
  for (const ps of ['powershell', 'pwsh']) {
    const out = path.join(tmp, `${ps}.json`);
    sh(ps, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(FW, 'scan', 'scan.ps1'), '-Out', out]);
    const h = profile(out); console.log(`${ps}: ${h.os.distro} · admin=${h.user.admin_noninteractive} · kind=${h.machine.kind}`);
    JSON.parse(sh(ps, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(FW, 'scan', 'scan.ps1')]));
  }
} else {
  sh('sh', ['-n', path.join(FW, 'scan', 'scan.sh')]);
  sh('sh', [path.join(FW, 'scan', 'scan.sh'), '--out', path.join(tmp, 'sh.json')]); profile(path.join(tmp, 'sh.json'));
}
const proj = path.join(tmp, 'proj'); fs.mkdirSync(proj);
fs.cpSync(FW, path.join(proj, 'groundwork'), { recursive: true });
const gw = (...a) => sh(process.execPath, [path.join('groundwork', 'bin', 'gw.js'), ...a], proj);
gw('init', '--no-hooks');
profile(path.join(proj, '.groundwork', 'host-profile.json'));
gw('doctor'); gw('status');
assert.match(gw('run', 'host', 'S0', '--', 'echo', 'smoke-run-ok'), /smoke-run-ok/);
fs.rmSync(tmp, { recursive: true, force: true }); console.log("ci-smoke: ok");
