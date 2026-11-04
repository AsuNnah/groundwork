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
console.log(`\n${n} checks passed`);
