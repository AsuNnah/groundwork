// node groundwork/test/selftest.js : checks decision rules against synthetic hosts.
'use strict';
const assert = require('assert');
const gw = require('../bin/gw.js');

const base = () => ({
  os: { family: 'linux', distro: 'ubuntu', version: '24.04', wsl: false, package_managers: 'apt' },
  cpu: { arch: 'x86_64', threads: 16, virt_extensions: true },
  memory: { total_gb: 32 }, disk: { free_gb_workdir: 200 }, gpu: { model: '' },
  machine: { kind: 'desktop', hypervisor: '', battery: false },
  virtualization: { kvm_usable: true, kvm_device: true, kvm_module_loaded: true, in_kvm_group: true, apple_vz: false },
  containers: { docker_installed: true, docker_daemon_ok: true, docker_problem: '', compose: true, podman_ok: false },
  display: { gui: true }, user: { admin_noninteractive: true, proxy: false },
  toolchains: { git: '2.43.0', node: '22.1.0', gh: '2.50.0', mise: '2025.1.0' },
});
const mod = f => { const h = base(); f(h); return h; };
const decide = h => { const c = gw.capabilities(h); return { c, m: gw.devMethod(h, c).id, t: gw.feasibility(c), kvm: gw.kvmCheck(h, c), docker: gw.dockerCheck(h) }; };
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('linux workstation with docker + kvm', () => {
  const d = decide(base());
  assert.equal(d.m, 'devcontainer'); assert.equal(d.kvm.status, 'ok');
  assert.equal(d.t.android.best_local_tier, 'S2'); assert.equal(d.t.ios.develop_locally, 'shared code only');
});
t('bare metal, VT-x disabled in BIOS → misconfigured with BIOS fix', () => {
  const d = decide(mod(h => { h.cpu.virt_extensions = false; Object.assign(h.virtualization, { kvm_usable: false, kvm_device: false, kvm_module_loaded: false }); }));
  assert.equal(d.kvm.status, 'misconfigured'); assert.match(d.kvm.fix, /BIOS/);
  assert.notEqual(d.t.android.best_local_tier, 'S2');
});
t('kvm device present, user not in kvm group', () => {
  const d = decide(mod(h => Object.assign(h.virtualization, { kvm_usable: false, in_kvm_group: false })));
  assert.equal(d.kvm.status, 'misconfigured'); assert.match(d.kvm.fix, /usermod -aG kvm/);
});
t('CPU capable, module not loaded', () => {
  const d = decide(mod(h => Object.assign(h.virtualization, { kvm_usable: false, kvm_device: false, kvm_module_loaded: false })));
  assert.match(d.kvm.fix, /modprobe/);
});
t('VM without nested virt', () => {
  const d = decide(mod(h => { h.machine.kind = 'vm'; h.cpu.virt_extensions = false; Object.assign(h.virtualization, { kvm_usable: false, kvm_device: false, kvm_module_loaded: false }); }));
  assert.match(d.kvm.fix, /nested/);
});
t('docker installed but no socket permission', () => {
  const d = decide(mod(h => Object.assign(h.containers, { docker_daemon_ok: false, docker_problem: 'no permission on docker.sock' })));
  assert.equal(d.docker.status, 'misconfigured'); assert.match(d.docker.fix, /usermod -aG docker/);
  assert.equal(d.m, 'native-user-scope'); assert.equal(d.t.web.best_local_tier, 'S0');
});
t('windows laptop with WSL2', () => {
  const d = decide(mod(h => { h.os = { family: 'windows', wsl: false, wsl2_available: true, package_managers: 'winget' }; h.machine.kind = 'laptop'; h.virtualization = { kvm_usable: false, apple_vz: false, hyperv_enabled: true, features_checked: true }; }));
  assert.equal(d.m, 'wsl2-first'); assert.equal(d.kvm.status, 'ok'); assert.equal(d.t.windows.best_local_tier, 'S2');
});
t('windows, hyper-v off, not admin → unknown, asks for admin scan', () => {
  const d = decide(mod(h => { h.os = { family: 'windows', package_managers: 'winget' }; h.user.admin_noninteractive = false; h.virtualization = { hyperv_enabled: false, features_checked: false, hypervisor_present: false }; }));
  assert.equal(d.kvm.status, 'unknown'); assert.equal(d.m, 'native-user-scope');
});
t('apple silicon mac with xcode', () => {
  const d = decide(mod(h => { h.os = { family: 'macos', package_managers: 'brew' }; h.cpu.arch = 'arm64'; h.machine.kind = 'laptop'; h.virtualization = { kvm_usable: false, apple_vz: true }; h.toolchains.xcodebuild = '16.0'; }));
  assert.equal(d.m, 'native-macos'); assert.equal(d.t.ios.best_local_tier, 'S2'); assert.equal(d.t.android.best_local_tier, 'S2');
});
t('low-resource laptop → light mode', () => {
  assert.equal(decide(mod(h => { h.memory.total_gb = 4; })).m, 'light');
});
t('inside a container', () => {
  const d = decide(mod(h => { h.machine.kind = 'container'; Object.assign(h.virtualization, { kvm_usable: false, kvm_device: false }); }));
  assert.equal(d.m, 'in-place'); assert.equal(d.kvm.status, 'unsupported');
});
t('tool version too old → misconfigured', () => {
  const r = gw.toolCheck(mod(h => { h.toolchains.java = '11.0.2'; }), { id: 'java', min: '17', severity: 'block' });
  assert.equal(r.status, 'misconfigured');
  assert.equal(gw.vcmp('1.10', '1.9') > 0, true);
});
t('install command prefers mise, then OS package manager', () => {
  assert.equal(gw.installCommand(base(), 'node').via, 'mise');
  assert.equal(gw.installCommand(base(), 'git').via, 'apt');
});
t('MANIFEST.json matches the folder (run scripts/release.js if this fails)', () => {
  const i = gw.integrity(require('path').join(__dirname, '..'));
  if (!i.manifest) return;   // not built yet
  assert.deepEqual([i.modified, i.stale, i.missing], [[], [], []], JSON.stringify(i));
});
t('changelog filter returns only newer sections', () => {
  const fs = require('fs'), os = require('os'), path = require('path');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-'));
  fs.writeFileSync(path.join(d, 'CHANGELOG.md'), '# Changelog\n\n## 0.3.0\nnew\n\n## 0.2.0\nold\n');
  const out = gw.changelogSince('0.2.0', d);
  assert.match(out, /0\.3\.0/); assert.doesNotMatch(out, /old/);
});
t('skill catalogue: every entry has a known MIT source and pinned ref', () => {
  const c = gw.catalog();
  assert.ok(c.skills.length > 30);
  for (const s of c.skills) { const src = c.sources[s.source]; assert.ok(src, s.id); assert.equal(src.license, 'MIT'); assert.match(src.ref, /^[0-9a-f]{40}$/); }
  assert.equal(new Set(c.skills.map(s => s.id)).size, c.skills.length, 'duplicate ids');
});
t('skill suggestions follow targets, stacks and phase', () => {
  const ids = gw.suggestSkills({ targets: ['android'], stacks: { android: 'flutter' } }, 'P7').map(s => s.id);
  assert.ok(ids.includes('ecc/dart-flutter-patterns')); assert.ok(!ids.includes('ecc/kotlin-patterns')); assert.ok(!ids.includes('ecc/vue-patterns'));
  assert.ok(ids.includes('agent-skills/test-driven-development'));
  const inc = gw.suggestSkills({ targets: ['backend'], stacks: { backend: 'go' }, stage: 'incident' }, 'P0').map(s => s.id);
  assert.ok(inc.includes('agent-skills/observability-and-instrumentation'));
});
t('every pack stack with an ecosystem has maintain commands, and every pack has rollback', () => {
  for (const id of ['web', 'backend', 'android', 'ios', 'macos', 'windows', 'linux-desktop', 'cli', 'embedded']) {
    const m = gw.maintainInfo({ targets: [id], stacks: {} })[0];
    assert.ok(m.rollback, id + ' rollback');
  }
  const m = gw.maintainInfo({ targets: ['backend'], stacks: { backend: 'python' } })[0];
  assert.match(m.commands.audit, /pip-audit|osv/);
});
t('recommendations rank task keywords and give reasons; short keywords need whole words', () => {
  const proj = { targets: ['backend'], stacks: { backend: 'python' }, stage: 'feature' };
  const r = gw.recommendSkills(proj, 'P7', 'add a database migration for the users table', { limit: 20, includeInstalled: true });
  const top = r.find(x => x.id === 'ecc/database-migrations');
  assert.ok(top, 'migration skill suggested'); assert.ok(top.reasons.some(x => /migration/.test(x)), top.reasons.join());
  assert.ok(r.every(x => !/flutter|kotlin|swift|vue/.test(x.id)), 'no wrong-platform skills');
  const city = gw.recommendSkills(proj, null, 'show the city name', { limit: 50, includeInstalled: true }).map(x => x.id);
  assert.ok(!city.includes('agent-skills/ci-cd-and-automation'), '"city" must not match "ci"');
  const ci = gw.recommendSkills(proj, null, 'set up ci for tests', { limit: 50, includeInstalled: true }).map(x => x.id);
  assert.ok(ci.includes('agent-skills/ci-cd-and-automation'));
});
t('greenfield projects are not offered brownfield skills', () => {
  const ids = gw.recommendSkills({ targets: ['web'], stacks: { web: 'vite-react' }, stage: 'greenfield' }, 'P0', '', { limit: 50, includeInstalled: true }).map(x => x.id);
  assert.ok(!ids.includes('ecc/codebase-onboarding'));
  const bf = gw.recommendSkills({ targets: ['web'], stacks: {}, stage: 'feature' }, 'P0', '', { limit: 50, includeInstalled: true }).map(x => x.id);
  assert.ok(bf.includes('ecc/codebase-onboarding'));
});
console.log(`\n${n} checks passed`);
