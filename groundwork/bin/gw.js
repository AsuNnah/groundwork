#!/usr/bin/env node
// Groundwork CLI. Zero dependencies (Node 18+). Run from anywhere inside the project:
//   node groundwork/bin/gw.js <command>
// Commands: init | scan | doctor | plan-install | status | set | phase | run | gate | hook | help
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const FW = path.resolve(__dirname, '..');                         // the copied framework folder
const ROOT = process.env.GW_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || path.dirname(FW);
const GW = path.join(ROOT, '.groundwork');                         // per-project state (outside the framework folder)
const P = (...a) => path.join(GW, ...a);

const PHASES = [
  ['H0', 'Host scan'], ['P0', 'Intake & sizing'], ['P1', 'Discover (interview, PRD)'], ['P2', 'Target & stack'],
  ['P3', 'Environment readiness'], ['P4', 'Capability preflight'], ['P5', 'Design docs'], ['P6', 'Plan + GATE 1'],
  ['P7', 'Build'], ['P8', 'Verify in sandbox'], ['P9', 'Review'], ['P10', 'Release + GATE 2'], ['P11', 'Learn'],
];
// which phases run per size tier ('light' = short version, see phases/*.md)
const TIER_PHASES = {
  trivial: ['H0', 'P0', 'P7', 'P8'],
  small: ['H0', 'P0', 'P1', 'P2', 'P3', 'P6', 'P7', 'P8', 'P9'],
  standard: PHASES.map(p => p[0]).filter(p => p !== 'P11'),
  large: PHASES.map(p => p[0]),
};

// ---------- io helpers ----------
const readJson = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n'); };
const exists = f => fs.existsSync(f);
const now = () => new Date().toISOString();
const project = () => readJson(P('project.json'), {});
const state = () => readJson(P('state.json'), { phase: 'H0', phases: {}, waivers: [] });
const VERSION = (() => { try { return fs.readFileSync(path.join(FW, 'VERSION'), 'utf8').trim(); } catch { return '?'; } })();

// ---------- silent feedback log (framework self-observation; never shown unless asked) ----------
const FB = () => P('feedback', 'events.jsonl');
const NOTE_KINDS = ['missing', 'wrong', 'unclear', 'friction', 'user-signal', 'workaround', 'improve', 'worked'];
function fb(kind, data = {}) {
  try {
    if (!exists(GW)) return;
    fs.mkdirSync(path.dirname(FB()), { recursive: true });
    fs.appendFileSync(FB(), JSON.stringify({ at: now(), v: VERSION, phase: state().phase || null, kind, ...data }) + '\n');
  } catch { /* feedback must never break the tool */ }
}
const fbEvents = () => { try { return fs.readFileSync(FB(), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch { return []; } };
function feedbackReport() {
  const ev = fbEvents(), proj = project(), st = state(), env = readJson(P('env-report.json'));
  const notes = ev.filter(e => e.kind === 'note'), auto = ev.filter(e => e.kind !== 'note');
  const L = [];
  L.push(`# Groundwork feedback: ${proj.name || path.basename(ROOT)}`, '');
  L.push(`- Framework version: ${VERSION} · generated: ${now()}`);
  L.push(`- Period: ${ev[0] ? ev[0].at.slice(0, 10) : '-'} → ${ev.length ? ev[ev.length - 1].at.slice(0, 10) : '-'} · events: ${ev.length} (${notes.length} agent notes)`);
  L.push(`- Project: stage ${proj.stage || '?'} · tier ${proj.tier || '?'} · targets ${(proj.targets || []).join(', ') || '?'} · stacks ${JSON.stringify(proj.stacks || {})}`);
  if (env) L.push(`- Host: ${env.host} · dev method: ${env.dev_method.id}`);
  L.push('', '## Agent observations', '');
  if (!notes.length) L.push('_none recorded_', '');
  for (const k of NOTE_KINDS) {
    const n = notes.filter(x => x.category === k); if (!n.length) continue;
    L.push(`### ${k} (${n.length})`);
    for (const x of n) L.push(`- [${x.phase || '-'}] ${x.text}`);
    L.push('');
  }
  L.push('## Automatic signals', '');
  const group = (kind, keyf) => { const m = {}; for (const e of auto.filter(a => a.kind === kind)) { const k = keyf(e); m[k] = (m[k] || 0) + 1; } return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const section = (title, rows) => { if (!rows.length) return; L.push(`### ${title}`); for (const [k, c] of rows) L.push(`- ${c}× ${k}`); L.push(''); };
  section('CLI errors', group('error', e => `\`gw ${e.cmd}\`: ${e.message}`));
  section('Edits blocked by GATE 1 hook', group('edit-blocked', e => e.file));
  section('Gate checks failed', group('gate-failed', e => `${e.gate}: ${e.problem}`));
  section('Environment checks not ok (first seen)', group('check', e => `${e.name}: ${e.status}${e.found ? ' (' + e.found + ')' : ''}`));
  section('Test runs failed', group('run-failed', e => `${e.target} ${e.tier}: \`${e.command}\``));
  section('Phases skipped / blocked', group('phase-skipped', e => `${e.id} skipped: ${e.note || '(no reason)'}`).concat(group('phase-blocked', e => `${e.id} blocked: ${e.note || '(no reason)'}`)));
  section('Host changes / re-scans', group('host-rescan', e => e.reason || 'rescan'));
  section('Unknown targets requested', group('unknown-target', e => e.target));
  L.push('## Phase timeline', '');
  for (const [id, name] of PHASES) { const x = st.phases[id]; if (x) L.push(`- ${id} ${name}: ${x.status} ${x.at.slice(0, 16)}${x.note ? ' · ' + x.note : ''}`); }
  const out = P('FEEDBACK.md'); fs.writeFileSync(out, L.join('\n') + '\n'); return out;
}
const fbRefresh = () => { try { feedbackReport(); } catch { } };

// ---------- H0: scan ----------
function scan() {
  const out = P('host-profile.json');
  fs.mkdirSync(GW, { recursive: true });
  const r = process.platform === 'win32'
    ? cp.spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(FW, 'scan', 'scan.ps1'), '-Out', out], { encoding: 'utf8' })
    : cp.spawnSync('sh', [path.join(FW, 'scan', 'scan.sh'), '--out', out], { encoding: 'utf8', cwd: ROOT });
  if (r.status !== 0 || !exists(out)) throw new Error('host scan failed: ' + (r.stderr || r.error));
  return readJson(out);
}
function hostChanged(h) {
  if (!h) return true;
  const fam = { linux: 'linux', darwin: 'macos', win32: 'windows' }[process.platform] || process.platform;
  const arch = { x64: 'x86_64', arm64: 'arm64' }[process.arch] || process.arch;
  const memGb = Math.floor(os.totalmem() / 1073741824);
  const ageDays = (Date.now() - Date.parse(h.scanned_at)) / 864e5;
  return h.os.family !== fam || h.cpu.arch !== arch || Math.abs((h.memory.total_gb || 0) - memGb) > 1 || !(ageDays < 7);
}
function hostProfile({ fresh = false } = {}) {
  const h = readJson(P('host-profile.json'));
  return fresh || hostChanged(h) ? scan() : h;
}

// ---------- capabilities / method / feasibility ----------
function capabilities(h) {
  const fam = h.os.family, t = h.toolchains || {};
  const mem = h.memory.total_gb || 0, disk = h.disk.free_gb_workdir || 0, thr = h.cpu.threads || 0;
  const c = {
    host_windows: fam === 'windows', host_macos: fam === 'macos', host_linux: fam === 'linux',
    containers: !!(h.containers.docker_daemon_ok || h.containers.podman_ok),
    kvm_vms: !!h.virtualization.kvm_usable,
    hyperv_vms: !!h.virtualization.hyperv_enabled,
    apple_vms: !!h.virtualization.apple_vz,
    build_ios: fam === 'macos' && !!t.xcodebuild,
    gui_tests: !!(h.display.gui || t.xvfb || fam === 'macos' || fam === 'windows'),
    low_resources: mem < 8 || thr < 4 || disk < 20,
    laptop: h.machine.kind === 'laptop',
    admin: !!h.user.admin_noninteractive,
    wsl: !!(h.os.wsl || h.os.wsl2_available),
    ci_remote: !!t.gh,
  };
  c.android_emulator_local = (c.kvm_vms || c.hyperv_vms || fam === 'macos') && mem >= 8 && disk >= 20;
  return c;
}
function devMethod(h, c) {
  const fam = h.os.family, kind = h.machine.kind;
  if (kind === 'container') return { id: 'in-place', why: 'already inside a container; heavy targets go to CI (S3)' };
  if (c.low_resources) return { id: 'light', why: 'under 8 GB RAM, 4 threads or 20 GB disk: no local emulators/VMs, heavy builds on CI' };
  if (fam === 'windows') {
    if (c.wsl) return { id: 'wsl2-first', why: 'web/backend/cli/android-build inside WSL2; .NET/WinUI and Windows UI tests native' };
    return c.admin ? { id: 'native-winget', why: 'native Windows tools via winget' }
      : { id: 'native-user-scope', why: 'no admin: scoop / portable SDKs in the user profile' };
  }
  if (fam === 'macos') return { id: 'native-macos', why: 'native (required for iOS/macOS) with brew + mise; containers for backend deps' };
  if (fam === 'linux' || fam === 'bsd') return c.containers
    ? { id: 'devcontainer', why: 'toolchains in containers per project, mise for host tools' }
    : { id: 'native-user-scope', why: 'no usable container engine: mise/uv in ~/.local' + (c.admin ? '' : ', no sudo') };
  return { id: 'manual', why: 'unknown host' };
}
// project overrides live in .groundwork/ so the framework folder can be replaced on upgrade
function packs() {
  const load = dir => !exists(dir) ? {} : Object.fromEntries(fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'tools.json')
    .map(f => [f.replace(/\.json$/, ''), readJson(path.join(dir, f))]).filter(([, v]) => v));
  return { ...load(path.join(FW, 'packs')), ...load(P('packs')) };
}
const tools = () => ({ ...readJson(path.join(FW, 'packs', 'tools.json'), {}), ...readJson(P('tools.json'), {}) });
function tierAvailable(pack, tier, c) {
  const s = pack.sandbox && pack.sandbox[tier];
  if (!s) return false;
  if (tier === 'S3') return true; // assumes a CI account; doctor warns if gh is missing
  if (s.needs) return s.needs.every(n => c[n]);
  if (s.needs_any) return s.needs_any.some(n => c[n]);
  return true;
}
function feasibility(c) {
  const out = {};
  for (const [id, pk] of Object.entries(packs())) {
    const local = ['S2', 'S1', 'S0'].find(t => tierAvailable(pk, t, c)) || null;
    const hostOk = !pk.host_only || pk.host_only.some(o => c['host_' + o]);
    out[id] = {
      develop_locally: hostOk ? 'yes' : 'shared code only',
      best_local_tier: hostOk ? local : (pk.sandbox.S0 ? 'S0' : null),
      release_tier: pk.min_release_tier,
      release_tier_local: hostOk && !!local && local >= pk.min_release_tier,
      otherwise: pk.sandbox.S3 ? pk.sandbox.S3.how : null,
    };
  }
  return out;
}

// ---------- checks (ok | missing | misconfigured | unsupported | unknown) ----------
function vcmp(a, b) { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; }

function kvmCheck(h, c) {
  const v = h.virtualization, fam = h.os.family, kind = h.machine.kind;
  const base = { id: 'virtualization', name: 'Hardware virtualization (Android emulator, Windows VM, fast QEMU)', severity: 'warn',
    impact: 'until fixed, emulator/VM tests (S2) run on CI (S3) instead' };
  if (fam === 'linux') {
    if (v.kvm_usable) return { ...base, status: 'ok' };
    if (kind === 'container') return { ...base, status: 'unsupported', fix: 'running inside a container: start it with --device /dev/kvm (host must have KVM)' };
    if (v.kvm_device) return { ...base, status: 'misconfigured', found: '/dev/kvm exists but this user cannot use it',
      fix: 'sudo usermod -aG kvm $USER   # then log out and back in' };
    if (h.os.wsl) return { ...base, status: 'misconfigured', found: 'WSL2 without nested virtualization',
      fix: 'Windows 11: add "[wsl2]\\nnestedVirtualization=true" to %UserProfile%\\.wslconfig, then: wsl --shutdown' };
    if (h.cpu.virt_extensions && !v.kvm_module_loaded) return { ...base, status: 'misconfigured', found: 'CPU supports virtualization, KVM module not loaded',
      fix: 'sudo modprobe kvm_intel   # or kvm_amd; install qemu-kvm if the module is missing' };
    if (kind === 'vm') return { ...base, status: 'misconfigured', found: 'VM without nested virtualization',
      fix: 'enable nested virtualization on the hypervisor (Proxmox: CPU type "host"; VMware: "Virtualize Intel VT-x/EPT"; Hyper-V: Set-VMProcessor -ExposeVirtualizationExtensions $true; cloud: pick a bare-metal or nested-virt instance type)' };
    return { ...base, status: 'misconfigured', found: 'CPU virtualization extensions (VT-x / AMD-V) not exposed',
      fix: 'reboot into BIOS/UEFI and enable Intel VT-x (Virtualization Technology) or AMD SVM, then: sudo modprobe kvm_intel (or kvm_amd). If the CPU has no VT-x/AMD-V, use CI (S3).' };
  }
  if (fam === 'windows') {
    if (v.hyperv_enabled) return { ...base, status: 'ok' };
    if (!h.cpu.virt_extensions && !v.hypervisor_present) return { ...base, status: 'misconfigured', found: 'virtualization disabled in firmware',
      fix: 'enable Intel VT-x / AMD-V (SVM) in BIOS/UEFI, then reboot' };
    if (!v.features_checked) return { ...base, status: 'unknown', fix: 'run the scan from an Administrator PowerShell to check Hyper-V / Virtual Machine Platform' };
    return { ...base, status: 'misconfigured', found: 'Hyper-V / Virtual Machine Platform not enabled',
      fix: 'Admin PowerShell: Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform,Microsoft-Hyper-V-All -All   # Windows Home: VirtualMachinePlatform only' };
  }
  if (fam === 'macos') return v.apple_vz || h.cpu.virt_extensions ? { ...base, status: 'ok' }
    : { ...base, status: 'unsupported', found: 'Intel Mac without hypervisor support', fix: 'use CI (S3) for emulator/VM tests' };
  return { ...base, status: 'unknown' };
}
function dockerCheck(h, severity = 'warn') {
  const k = h.containers, base = { id: 'docker', name: 'Container engine (sandbox tier S1)', severity, impact: 'without it, tests run on the host (S0) only' };
  if (k.docker_daemon_ok || k.podman_ok) return { ...base, status: 'ok' };
  if (k.docker_installed) return { ...base, status: 'misconfigured', found: k.docker_problem || 'daemon unreachable',
    fix: /permission/.test(k.docker_problem || '') ? 'sudo usermod -aG docker $USER   # then log out and back in (or set up rootless Docker)'
      : h.os.family === 'linux' ? 'sudo systemctl enable --now docker' : 'start Docker Desktop' };
  return { ...base, status: 'missing', install: true };
}
function toolCheck(h, spec, why) {
  const t = (h.toolchains || {})[spec.id];
  const base = { id: spec.id, name: (tools()[spec.id] || {}).name || spec.id, severity: spec.severity || 'warn', why: spec.why || why };
  if (spec.host && h.os.family !== spec.host) return { ...base, status: 'unsupported', found: `needs a ${spec.host} host`, severity: 'warn' };
  if (spec.project_local) return { ...base, status: t ? 'ok' : 'unknown', found: t || 'checked per project (installed as a dev dependency)', severity: 'info' };
  if (!t) return { ...base, status: 'missing', install: true };
  if (spec.min && t !== 'present' && vcmp(t, spec.min) < 0) return { ...base, status: 'misconfigured', found: t, required: '>= ' + spec.min, install: true };
  return { ...base, status: 'ok', found: t };
}
function doctor(h, proj) {
  const c = capabilities(h), checks = [];
  checks.push(toolCheck(h, { id: 'git', severity: 'block' }, 'version control'));
  checks.push(dockerCheck(h));
  checks.push(kvmCheck(h, c));
  if (!c.ci_remote) checks.push({ id: 'gh', name: 'GitHub CLI (CI sandboxes, S3)', status: 'missing', severity: 'warn', install: true });
  if ((h.memory.total_gb || 0) < 8) checks.push({ id: 'ram', name: 'RAM', status: 'misconfigured', severity: 'warn', found: h.memory.total_gb + ' GB', required: '>= 8 GB for emulators' });
  if ((h.disk.free_gb_workdir || 0) < 20) checks.push({ id: 'disk', name: 'Free disk', status: 'misconfigured', severity: 'warn', found: h.disk.free_gb_workdir + ' GB', required: '>= 20 GB' });
  const all = packs();
  for (const target of proj.targets || []) {
    const pk = all[target];
    if (!pk) { fb('unknown-target', { target }); checks.push({ id: 'pack:' + target, name: 'Pack ' + target, status: 'missing', severity: 'block', fix: 'no pack for this target: add groundwork/packs/' + target + '.json' }); continue; }
    const stack = (proj.stacks || {})[target];
    const specs = [...(pk.tools || []), ...((pk.stack_tools || {})[stack] || [])];
    for (const s of specs) {
      if (s.id === 'docker') continue; // covered above
      const r = toolCheck(h, s, pk.title);
      r.target = target;
      if (!checks.some(x => x.id === r.id && x.status === r.status)) checks.push(r);
    }
    if (pk.host_only && !pk.host_only.some(o => c['host_' + o])) checks.push({ id: target + ':host', target, name: pk.title + ' on this host', status: 'unsupported', severity: 'warn', found: pk.non_mac_note || `needs ${pk.host_only.join('/')} host`, fix: pk.sandbox.S3 && pk.sandbox.S3.how });
  }
  const blocking = checks.filter(x => x.severity === 'block' && x.status !== 'ok');
  const report = { generated_at: now(), host: summary(h), capabilities: c, dev_method: devMethod(h, c), targets: feasibility(c), checks, ready: blocking.length === 0 };
  writeJson(P('env-report.json'), report);
  const seen = new Set(fbEvents().filter(e => e.kind === 'check').map(e => e.id + e.status));
  for (const x of checks) if (x.status !== 'ok' && !seen.has(x.id + x.status)) fb('check', { id: x.id, name: x.name, status: x.status, found: x.found || null });
  return report;
}
function summary(h) {
  return `${h.machine.kind} · ${h.os.distro || h.os.family} ${h.os.version} · ${h.cpu.arch} · ${h.cpu.threads} threads · ${h.memory.total_gb} GB RAM · ${h.disk.free_gb_workdir} GB free${h.gpu.model ? ' · ' + h.gpu.model : ''}`;
}
function installCommand(h, id) {
  const entry = tools()[id]; if (!entry) return null;
  const pms = (h.os.package_managers || '').split(' ').filter(Boolean);
  const have = k => k === 'any' || (h.toolchains || {})[k] || pms.includes(k);
  const order = ['mise', ...pms, 'uv', 'any'];
  for (const k of order) if (entry.install[k] && have(k)) return { via: k, cmd: entry.install[k] };
  const k = Object.keys(entry.install)[0];
  return { via: k + ' (not on this host)', cmd: entry.install[k] };
}

// ---------- status / next ----------
function nextStep() {
  const proj = project(), st = state();
  if (!exists(P('host-profile.json'))) return { phase: 'H0', do: 'node groundwork/bin/gw.js doctor   # scan this machine first' };
  const tier = proj.tier;
  const plan = TIER_PHASES[tier] || TIER_PHASES.standard;
  for (const id of plan) {
    const s = (st.phases[id] || {}).status;
    if (s !== 'done' && s !== 'skipped') return { phase: id, do: `read groundwork/phases/${id}.md` + (tier ? '' : '  (size tier not set yet: P0 decides it)') };
  }
  return { phase: null, do: 'all phases done for tier ' + tier };
}
function statusText() {
  const proj = project(), st = state(), env = readJson(P('env-report.json'));
  const n = nextStep(), lines = [];
  lines.push(`Groundwork · project: ${proj.name || '(unnamed)'} · tier: ${proj.tier || '?'} · targets: ${(proj.targets || []).join(', ') || '?'}`);
  if (env) {
    lines.push(`Host: ${env.host} · dev method: ${env.dev_method.id}`);
    const issues = env.checks.filter(c => c.status !== 'ok' && c.severity !== 'info');
    for (const i of issues) lines.push(`  ${i.severity === 'block' ? '✗ BLOCK' : '! WARN '} ${i.name}: ${i.status}${i.found ? ' (' + i.found + ')' : ''}${i.fix ? ' → ' + i.fix : i.install ? ' → gw plan-install' : ''}`);
  }
  const g = ['G1', 'G2'].map(x => `${x}:${exists(P('gates', x + '.json')) ? 'approved' : 'open'}`).join(' ');
  lines.push(`Gates: ${g} · current phase: ${n.phase || 'done'} → ${n.do}`);
  return lines.join('\n');
}

// ---------- gates & runs ----------
const MARKER = /\[NEEDS CLARIFICATION/;
function gateCheck(id) {
  const proj = project(), problems = [], read = f => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return null; } };
  if (id === 'G1') {
    const need = proj.tier === 'small' ? ['docs/plan.md'] : ['docs/prd.md', 'docs/plan.md', 'docs/test-strategy.md'];
    for (const f of need) { const t = read(f); if (t == null) problems.push(`missing ${f}`); else if (MARKER.test(t)) problems.push(`${f} still has [NEEDS CLARIFICATION] markers`); }
    if (!exists(P('tasks.json'))) problems.push('missing .groundwork/tasks.json');
    const env = readJson(P('env-report.json'));
    if (!env) problems.push('no env-report: run gw doctor'); else if (!env.ready) problems.push('environment has blocking checks: run gw doctor');
  } else if (id === 'G2') {
    if (!exists(P('gates', 'G1.json'))) problems.push('G1 not approved');
    const st = state(), all = packs();
    for (const t of proj.targets || []) {
      const need = (all[t] || {}).min_release_tier || 'S1';
      const ok = runs().some(r => r.target === t && r.exit === 0 && r.tier >= need);
      const waived = (st.waivers || []).some(w => w.target === t);
      if (!ok && !waived) problems.push(`no passing ${need}+ run for ${t} (gw run ${t} ${need} -- <cmd>, or waive in state.json with a reason)`);
    }
  } else problems.push('unknown gate ' + id);
  return problems;
}
function runs() {
  const d = P('runs'); if (!exists(d)) return [];
  return fs.readdirSync(d).map(r => readJson(path.join(d, r, 'receipt.json'))).filter(Boolean);
}

// ---------- wiring (shared by init and migrate) ----------
function wireGitignore() {
  const gi = path.join(ROOT, '.gitignore'), giLines = ['.groundwork/host-profile.json', '.groundwork/env-report.json', '.groundwork/runs/*/logs/', '.groundwork/feedback/', '.groundwork/FEEDBACK.md', '.groundwork/backups/', '.groundwork/cache/'];
  const giText = exists(gi) ? fs.readFileSync(gi, 'utf8') : '';
  const add = giLines.filter(l => !giText.includes(l));
  if (add.length) fs.appendFileSync(gi, (giText && !giText.endsWith('\n') ? '\n' : '') + '# groundwork (machine-specific / personal)\n' + add.join('\n') + '\n');
}
function wireSkill() {
  const sk = path.join(ROOT, '.claude', 'skills', 'groundwork', 'SKILL.md');
  fs.mkdirSync(path.dirname(sk), { recursive: true });
  fs.copyFileSync(path.join(FW, 'hooks', 'SKILL.md'), sk);
}

// ---------- framework integrity & upgrade ----------
const crypto = require('crypto');
const SKIP = new Set(['MANIFEST.json']);
function walk(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const f = path.join(dir, e.name);
    return e.isDirectory() ? walk(f, base) : [path.relative(base, f).split(path.sep).join('/')];
  }).filter(f => !SKIP.has(f)).sort();
}
// hash with normalised line endings so a Windows checkout (CRLF) still verifies
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f).toString('utf8').replace(/\r\n/g, '\n')).digest('hex').slice(0, 16);
const readVersion = dir => { try { return fs.readFileSync(path.join(dir, 'VERSION'), 'utf8').trim(); } catch { return '?'; } };
function buildManifest(dir = FW) {
  return { version: readVersion(dir), files: Object.fromEntries(walk(dir).map(f => [f, sha(path.join(dir, f))])) };
}
function integrity(dir = FW) {
  const m = readJson(path.join(dir, 'MANIFEST.json'));
  if (!m) return { manifest: false, modified: [], stale: [], missing: [] };
  const have = walk(dir);
  return {
    manifest: true, version: m.version,
    modified: have.filter(f => m.files[f] && m.files[f] !== sha(path.join(dir, f))),
    stale: have.filter(f => !m.files[f]),                        // left over from an older version (or user-added)
    missing: Object.keys(m.files).filter(f => !have.includes(f)),
  };
}
// state migrations: each runs once when a project moves past its `to` version
const MIGRATIONS = [
  { to: '0.3.0', run: () => { /* 0.3.0 only adds fields/files; nothing to rewrite */ } },
];
function migrate({ quiet = false } = {}) {
  if (!exists(P('project.json'))) return null;
  const p = project(), from = p.framework_version || '0.2.0';
  if (from === VERSION) return null;
  if (vcmp(from, VERSION) > 0) { if (!quiet) console.log(`Groundwork: project state is from a newer framework (${from}) than this copy (${VERSION}). Upgrade the groundwork/ folder.`); return null; }
  for (const m of MIGRATIONS) if (vcmp(m.to, from) > 0 && vcmp(m.to, VERSION) <= 0) m.run(p);
  p.framework_version = VERSION; writeJson(P('project.json'), p);
  wireGitignore();
  if (exists(path.join(ROOT, '.claude', 'skills', 'groundwork'))) wireSkill();
  fs.appendFileSync(P('decisions.jsonl'), JSON.stringify({ at: now(), kind: 'framework-upgrade', from, to: VERSION }) + '\n');
  fb('upgrade', { from, to: VERSION });
  const notes = changelogSince(from);
  if (!quiet) console.log(`Groundwork upgraded ${from} → ${VERSION}. State migrated.` + (notes ? '\n' + notes : ''));
  return { from, to: VERSION };
}
function changelogSince(from, dir = FW) {
  let t; try { t = fs.readFileSync(path.join(dir, 'CHANGELOG.md'), 'utf8'); } catch { return ''; }
  return t.split(/^## /m).slice(1).filter(sec => { const v = (sec.match(/^\[?([\d.]+)/) || [])[1]; return v && vcmp(v, from) > 0; })
    .map(sec => '## ' + sec.trim()).join('\n\n');
}
function upgrade(src, args) {
  if (!src) throw new Error('usage: gw upgrade <path-to-new-groundwork-folder>');
  src = path.resolve(src);
  if (!exists(path.join(src, 'VERSION')) || !exists(path.join(src, 'bin', 'gw.js')) || !exists(path.join(src, 'GROUNDWORK.md'))) throw new Error(src + ' is not a groundwork folder');
  if (src === FW) throw new Error('source is this same folder');
  const newV = readVersion(src), oldV = VERSION;
  if (vcmp(newV, oldV) < 0 && !args.includes('--force')) throw new Error(`downgrade ${oldV} → ${newV} refused (use --force)`);
  const integ = integrity();
  const backup = P('backups', `groundwork-${oldV}-${now().replace(/[:.]/g, '-')}`);
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  fs.cpSync(FW, backup, { recursive: true });
  const incoming = new Set(walk(src));
  for (const f of walk(FW)) if (!incoming.has(f)) fs.rmSync(path.join(FW, f));   // replace, not merge: drop files the new version removed
  fs.cpSync(src, FW, { recursive: true, force: true });
  console.log(`Replaced groundwork/ ${oldV} → ${newV}. Backup of the old folder: ${path.relative(ROOT, backup)}`);
  if (integ.modified.length) console.log('Local edits found in the old folder (kept only in the backup; move them to .groundwork/packs/, .groundwork/tools.json or CLAUDE.md):\n  ' + integ.modified.join('\n  '));
  const r = cp.spawnSync(process.execPath, [path.join(FW, 'bin', 'gw.js'), 'migrate'], { stdio: 'inherit', cwd: ROOT, env: { ...process.env, GW_PROJECT_DIR: ROOT } });
  return r.status || 0;
}

// ---------- skill catalogue ----------
const catalog = () => readJson(path.join(FW, 'catalog', 'skills.json'), { sources: {}, skills: [] });
function skillInstalled(name) {
  const home = os.homedir();
  const direct = [path.join(ROOT, '.claude', 'skills', name), path.join(home, '.claude', 'skills', name)];
  if (direct.some(d => exists(path.join(d, 'SKILL.md')))) return true;
  const plug = path.join(home, '.claude', 'plugins');   // plugin caches: look a few levels deep for skills/<name>/SKILL.md
  const seek = (d, depth) => { if (depth < 0 || !exists(d)) return false;
    try { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (!e.isDirectory()) continue;
      const f = path.join(d, e.name); if (e.name === name && exists(path.join(f, 'SKILL.md'))) return true; if (seek(f, depth - 1)) return true; } } catch { }
    return false; };
  return seek(plug, 6);
}
function suggestSkills(proj, phase, all = false) {
  const targets = proj.targets || [], stacks = Object.values(proj.stacks || {});
  const stagePlaybook = { upgrade: 'UPGRADE', refactor: 'MAINTAIN', incident: 'OPERATE', security: 'SECURITY', feature: 'CHANGE', bugfix: 'CHANGE', migration: 'CHANGE' }[proj.stage];
  return catalog().skills.filter(s =>
    (s.targets.includes('*') || s.targets.some(t => targets.includes(t))) &&
    (s.stacks.includes('*') || s.stacks.some(t => stacks.includes(t))) &&
    (all || !phase || s.phases.includes(phase) || (stagePlaybook && s.phases.includes(stagePlaybook))));
}
function fetchSkill(s) {
  const src = catalog().sources[s.source];
  const dir = P('cache', 'skills', s.source + '-' + src.ref.slice(0, 12));
  const git = (...a) => { const r = cp.spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' }); if (r.status !== 0) throw new Error('git ' + a.join(' ') + ': ' + (r.stderr || '').trim()); return r.stdout; };
  if (!exists(path.join(dir, '.git'))) {
    fs.mkdirSync(dir, { recursive: true });
    git('init', '-q'); git('remote', 'add', 'origin', src.repo);
    git('sparse-checkout', 'set', '--no-cone', '/' + src.license_file, '/' + s.path + '/');
    git('fetch', '-q', '--depth', '1', 'origin', src.ref); git('checkout', '-q', 'FETCH_HEAD');
  } else { git('sparse-checkout', 'add', '/' + s.path + '/'); }
  const skillDir = path.join(dir, s.path);
  if (!exists(path.join(skillDir, 'SKILL.md'))) throw new Error('fetched, but ' + s.path + '/SKILL.md is missing at ' + src.ref);
  return { dir, skillDir, src };
}

// ---------- maintenance info ----------
function maintainInfo(proj) {
  const all = packs(), out = [];
  for (const t of proj.targets || []) {
    const pk = all[t]; if (!pk) continue;
    const st = (proj.stacks || {})[t], m = (pk.maintain || {})[st];
    out.push({ target: t, stack: st || null, commands: m || null, rollback: pk.rollback || null, observe: pk.observe || [], policies: pk.policies || [] });
  }
  return out;
}
const EOL_PRODUCTS = { node: 'nodejs', python: 'python', dotnet: 'dotnet', java: 'eclipse-temurin', go: 'go' };
async function eolCheck(h) {
  const rows = [];
  for (const [tool, product] of Object.entries(EOL_PRODUCTS)) {
    const v = (h.toolchains || {})[tool]; if (!v || v === 'present') continue;
    let data; try { const r = await fetch(`https://endoflife.date/api/v1/products/${product}`, { signal: AbortSignal.timeout(8000) }); data = await r.json(); }
    catch (e) { rows.push({ tool, version: v, status: 'unknown', note: 'endoflife.date unreachable: ' + e.message }); continue; }
    const rel = ((data.result || {}).releases || []).find(x => v === x.name || v.startsWith(x.name + '.'));
    if (!rel) { rows.push({ tool, version: v, status: 'unknown', note: 'release line not found' }); continue; }
    const days = rel.eolFrom ? Math.round((Date.parse(rel.eolFrom) - Date.now()) / 864e5) : null;
    rows.push({ tool, version: v, line: rel.name, eol: rel.eolFrom || null, days_left: days, lts: !!rel.isLts,
      status: rel.isEol || (days !== null && days < 0) ? 'eol' : days !== null && days < 180 ? 'soon' : 'ok' });
  }
  return rows;
}

// ---------- init ----------
const HOOK_CMD = 'node "$CLAUDE_PROJECT_DIR/groundwork/bin/gw.js" hook';
function init(args) {
  const profile = flag(args, '--profile') || 'standard';
  if (!exists(P('project.json'))) writeJson(P('project.json'), { name: path.basename(ROOT), stage: null, tier: null, targets: [], stacks: {}, profile, created_at: now() });
  if (!exists(P('state.json'))) writeJson(P('state.json'), { phase: 'H0', phases: {}, waivers: [] });
  wireGitignore();
  const cm = path.join(ROOT, 'CLAUDE.md'), imp = '@groundwork/GROUNDWORK.md';
  const cmText = exists(cm) ? fs.readFileSync(cm, 'utf8') : '';
  if (!cmText.includes(imp)) fs.appendFileSync(cm, (cmText ? '\n' : '') + '## Groundwork framework\n' + imp + '\n');
  const ag = path.join(ROOT, 'AGENTS.md');
  if (exists(ag) && !fs.readFileSync(ag, 'utf8').includes('groundwork/GROUNDWORK.md')) fs.appendFileSync(ag, '\n## Groundwork framework\nRead and follow groundwork/GROUNDWORK.md before any development work.\n');
  wireSkill();
  if (profile !== 'minimal' && !args.includes('--no-hooks')) {
    const sf = path.join(ROOT, '.claude', 'settings.json'), s = readJson(sf, {});
    if (exists(sf) && !readJson(sf)) throw new Error('.claude/settings.json is not valid JSON; fix it or pass --no-hooks');
    s.hooks = s.hooks || {};
    const addHook = (ev, matcher, sub) => {
      s.hooks[ev] = s.hooks[ev] || [];
      if (JSON.stringify(s.hooks[ev]).includes('groundwork/bin/gw.js')) return;
      s.hooks[ev].push({ ...(matcher ? { matcher } : {}), hooks: [{ type: 'command', command: `${HOOK_CMD} ${sub}` }] });
    };
    addHook('SessionStart', null, 'session-start');
    addHook('PreToolUse', 'Edit|Write|MultiEdit|NotebookEdit', 'pre-edit');
    writeJson(sf, s);
  }
  const p = project(); p.profile = profile; p.framework_version = VERSION; writeJson(P('project.json'), p);
  const r = doctor(hostProfile({ fresh: true }), project());
  const st = state(); st.phases.H0 = { status: 'done', at: now() }; writeJson(P('state.json'), st);
  return r;
}

// ---------- hooks ----------
function hook(sub) {
  const p = project(); if (!exists(P('project.json'))) return 0;   // not initialised: stay silent
  if (sub === 'session-start') {
    try { migrate(); } catch (e) { console.log('Groundwork: migration failed: ' + e.message); }
    const integ = integrity();
    if (integ.stale.length || integ.missing.length) console.log(`Groundwork: framework folder has ${integ.stale.length} leftover and ${integ.missing.length} missing file(s) vs its manifest (copied over an old version?). Run: gw verify --clean`);
    const h = readJson(P('host-profile.json'));
    if (hostChanged(h)) { try { doctor(scan(), p); fb('host-rescan', { reason: h ? 'host changed or scan stale' : 'first scan' }); console.log('Groundwork: host changed or scan older than 7 days, re-scanned.'); } catch (e) { console.log('Groundwork: re-scan failed: ' + e.message); } }
    console.log(statusText());
    return 0;
  }
  if (sub === 'pre-edit') {
    // incidents and security fixes are emergencies: their playbooks (OPERATE/SECURITY) replace GATE 1
    if (p.profile === 'minimal' || !['standard', 'large'].includes(p.tier) || ['incident', 'security'].includes(p.stage) || exists(P('gates', 'G1.json'))) return 0;
    let input = {}; try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { }
    const f = path.relative(ROOT, (input.tool_input || {}).file_path || (input.tool_input || {}).notebook_path || '').split(path.sep).join('/');
    const allowed = /^(docs\/|\.groundwork\/|groundwork\/|\.claude\/|tests?\/|spec\/|__tests__\/)|(\.md|\.test\.[a-z]+|_test\.[a-z]+|\.spec\.[a-z]+)$|^(CLAUDE|AGENTS|README|CONSTRAINTS)/i;
    if (!f || f.startsWith('..') || allowed.test(f)) return 0;
    process.stderr.write(`Groundwork: GATE 1 (plan approval) is not approved yet for this ${p.tier} project, so source edits are blocked.\n` +
      `Allowed now: docs/, tests, .groundwork/. Next: finish groundwork/phases/P6.md, then gw gate G1 --approve "<user's words>".\n`);
    fb('edit-blocked', { file: f });
    return 2;
  }
  return 0;
}

// ---------- cli ----------
function flag(args, name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; }
function printDoctor(r) {
  console.log(`Host: ${r.host}\nDev method: ${r.dev_method.id}: ${r.dev_method.why}\n`);
  const icon = { ok: '✓', missing: '✗', misconfigured: '⚠', unsupported: '–', unknown: '?' };
  console.log('Checks:');
  for (const c of r.checks) console.log(`  ${icon[c.status] || '?'} [${c.severity}] ${c.name}${c.target ? ' (' + c.target + ')' : ''}: ${c.status}${c.found ? ', found ' + c.found : ''}${c.required ? ', need ' + c.required : ''}` +
    (c.status !== 'ok' && c.fix ? `\n      fix: ${c.fix}` : '') + (c.status !== 'ok' && c.impact ? `\n      impact: ${c.impact}` : '') + (c.install && c.status !== 'ok' ? '\n      install: see gw plan-install' : ''));
  console.log('\nTargets on this machine (develop / best local test tier / release tier):');
  for (const [t, f] of Object.entries(r.targets)) console.log(`  ${t.padEnd(14)} ${f.develop_locally.padEnd(18)} ${String(f.best_local_tier || '-').padEnd(4)} need ${f.release_tier}${f.release_tier_local ? '' : '  → ' + (f.otherwise || 'not available')}`);
  console.log(`\nReady: ${r.ready ? 'yes' : 'NO, fix the BLOCK items first'}`);
}
function main(argv) {
  const [cmd, ...args] = argv;
  if (!['upgrade', 'migrate', 'hook', 'help', undefined].includes(cmd)) migrate();
  switch (cmd) {
    case 'init': { const r = init(args); printDoctor(r); console.log('\nInitialised. Next: ' + nextStep().do); return 0; }
    case 'scan': { const h = scan(); console.log(JSON.stringify(h, null, 2)); return 0; }
    case 'doctor': {
      const r = doctor(hostProfile({ fresh: args.includes('--fresh') }), project());
      if (args.includes('--json')) console.log(JSON.stringify(r, null, 2)); else printDoctor(r);
      const st = state(); st.phases.H0 = { status: 'done', at: now() }; if (project().targets?.length) st.phases.P3 = { status: r.ready ? 'done' : 'blocked', at: now() }; writeJson(P('state.json'), st);
      return r.ready ? 0 : 1;
    }
    case 'plan-install': {
      const h = hostProfile(), r = readJson(P('env-report.json')) || doctor(h, project());
      const todo = r.checks.filter(c => c.status !== 'ok' && c.status !== 'unsupported' && c.severity !== 'info');
      if (!todo.length) { console.log('Nothing to install or fix.'); return 0; }
      console.log('Install / fix plan (review, then run yourself or ask the agent to run approved lines):\n');
      for (const c of todo) {
        const ic = c.install ? installCommand(h, c.id) : null;
        const alt = ic && /^sudo /.test(ic.cmd) && !h.user.admin_noninteractive && (tools()[c.id] || {}).install.mise
          ? `\n    no passwordless admin: user-scope alternative → install mise (${tools().mise.install.any}), then: ${tools()[c.id].install.mise}` : '';
        console.log(`- [${c.severity}] ${c.name}${c.why ? ' (' + c.why + ')' : ''}\n    ${ic ? `${ic.via}: ${ic.cmd}` : c.fix || 'manual: see docs'}${alt}`);
      }
      return 0;
    }
    case 'status': console.log(statusText()); return 0;
    case 'next': console.log(JSON.stringify(nextStep())); return 0;
    case 'set': {   // gw set tier=standard stage=greenfield targets=web,android stacks.android=flutter name=x
      const p = project();
      for (const kv of args) { const [k, ...v] = kv.split('='); const val = v.join('=');
        if (k === 'targets') p.targets = val.split(',').filter(Boolean);
        else if (k.startsWith('stacks.')) { p.stacks = p.stacks || {}; p.stacks[k.slice(7)] = val; }
        else if (k === 'tier' && !TIER_PHASES[val]) throw new Error('tier must be one of ' + Object.keys(TIER_PHASES));
        else p[k] = val; }
      writeJson(P('project.json'), p); console.log(JSON.stringify(p, null, 2)); return 0;
    }
    case 'phase': {   // gw phase P1 done|skipped|in_progress|blocked ["note"]
      const [id, status, note] = args;
      if (!PHASES.some(p => p[0] === id) || !['done', 'skipped', 'in_progress', 'blocked'].includes(status)) throw new Error('usage: gw phase <H0..P11> <done|skipped|in_progress|blocked> ["note"]');
      if (id === 'P6' && status === 'done' && !exists(P('gates', 'G1.json'))) throw new Error('P6 needs GATE 1: gw gate G1 --approve "..."');
      if (id === 'P10' && status === 'done' && !exists(P('gates', 'G2.json'))) throw new Error('P10 needs GATE 2: gw gate G2 --approve "..."');
      const st = state(); st.phases[id] = { status, at: now(), ...(note ? { note } : {}) }; writeJson(P('state.json'), st);
      st.phase = nextStep().phase; writeJson(P('state.json'), st);
      if (status === 'blocked' || status === 'skipped') fb('phase-' + status, { id, note: note || null });
      fbRefresh(); console.log(statusText()); return 0;
    }
    case 'run': {     // gw run <target> <S0|S1|S2|S3> -- <command...>
      const [target, tier] = args, i = args.indexOf('--');
      if (!target || !/^S[0-3]$/.test(tier || '') || i < 0) throw new Error('usage: gw run <target> <S0..S3> -- <command>');
      const c = capabilities(hostProfile()), pk = packs()[target];
      if (!pk) throw new Error('unknown target ' + target);
      if ((tier === 'S1' || tier === 'S2') && !tierAvailable(pk, tier, c))
        throw new Error(`${tier} is not available for ${target} on this host (see gw doctor). Fix the warning, or run on CI and record it as S3.`);
      const command = args.slice(i + 1).join(' '), id =new Date().toISOString().replace(/[:.]/g, '-') + '-' + target;
      const started = now(), r = cp.spawnSync(command, { shell: true, stdio: 'inherit', cwd: ROOT });
      const commit = (cp.spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout || '').trim() || null;
      writeJson(P('runs', id, 'receipt.json'), { target, tier, command, exit: r.status, commit, started, ended: now() });
      if (r.status !== 0) fb('run-failed', { target, tier, command });
      console.log(`\nGroundwork run receipt: .groundwork/runs/${id}/receipt.json (exit ${r.status})`); return r.status === 0 ? 0 : 1;
    }
    case 'gate': {    // gw gate G1|G2 [--approve "user's exact words"]
      const id = args[0], approval = flag(args, '--approve'), problems = gateCheck(id);
      if (problems.length) { for (const pr of problems) fb('gate-failed', { gate: id, problem: pr }); console.log(`${id} NOT ready:\n- ` + problems.join('\n- ')); return 1; }
      if (!approval) { console.log(`${id} checks pass. Ask the user for approval, then: gw gate ${id} --approve "<their words>"`); return 0; }
      writeJson(P('gates', id + '.json'), { gate: id, approved_at: now(), approval_quote: approval, checks: 'pass' });
      fs.appendFileSync(P('decisions.jsonl'), JSON.stringify({ at: now(), kind: 'gate', gate: id, approval }) + '\n');
      console.log(`${id} approved and recorded.`); return 0;
    }
    case 'hook': return hook(args[0]);
    case 'note': {    // silent agent self-observation: gw note <category> "text"
      const [category, ...rest] = args, text = rest.join(' ').trim();
      if (!NOTE_KINDS.includes(category) || !text) throw new Error('usage: gw note <' + NOTE_KINDS.join('|') + '> "text"');
      fb('note', { category, text }); fbRefresh(); return 0;   // prints nothing on purpose
    }
    case 'feedback': { console.log(feedbackReport()); return 0; }
    case 'skills': {  // gw skills [--all] | fetch <id> | install <id> [--force]
      const sub = args[0], cat = catalog();
      if (sub === 'fetch' || sub === 'install') {
        const s = cat.skills.find(x => x.id === args[1]);
        if (!s) throw new Error('unknown skill id; see gw skills --all');
        const { skillDir, src, dir } = fetchSkill(s);
        const files = walk(skillDir), scripts = files.filter(f => /\.(sh|bash|ps1|js|mjs|cjs|ts|py|rb|exe|bat|cmd)$/i.test(f));
        if (sub === 'fetch') {
          console.log(`Fetched ${s.id} @ ${src.ref.slice(0, 12)} (${src.license}) to ${path.relative(ROOT, skillDir)}\nFiles: ${files.join(', ')}` +
            (scripts.length ? `\n⚠ contains executable files: ${scripts.join(', ')}. Read them before installing.` : '\nNo executable files.') +
            (s.note ? `\nNote: ${s.note}` : '') + `\nReview SKILL.md (third-party content, phases/P4.md), then: gw skills install ${s.id}`);
          return 0;
        }
        const dest = path.join(ROOT, '.claude', 'skills', s.name);
        if (exists(dest) && !args.includes('--force')) throw new Error(`${path.relative(ROOT, dest)} already exists (use --force to replace)`);
        fs.rmSync(dest, { recursive: true, force: true });
        fs.cpSync(skillDir, dest, { recursive: true });
        fs.copyFileSync(path.join(dir, src.license_file), path.join(dest, 'LICENSE'));   // MIT requires keeping the notice
        const lock = readJson(P('skills.lock.json'), {});
        lock[s.name] = { id: s.id, repo: src.repo, ref: src.ref, path: s.path, license: src.license, installed_at: now(), files: Object.fromEntries(walk(dest).map(f => [f, sha(path.join(dest, f))])) };
        writeJson(P('skills.lock.json'), lock);
        console.log(`Installed ${s.id} → ${path.relative(ROOT, dest)} (with LICENSE). Recorded in .groundwork/skills.lock.json. Add it to docs/skill-requirements.md.`);
        return 0;
      }
      const proj = project(), phase = nextStep().phase, list = suggestSkills(proj, phase, args.includes('--all'));
      console.log(`Skills for ${args.includes('--all') ? 'all phases' : 'phase ' + phase}${proj.stage ? ' · stage ' + proj.stage : ''} · targets ${(proj.targets || []).join(',') || 'any'} (${list.length}):`);
      for (const s of list) console.log(`  ${skillInstalled(s.name) ? '✓ installed ' : '  available '} ${s.id.padEnd(46)} [${s.phases.join(',')}] ${s.why}`);
      console.log('\nInstalled-check looks for the same skill name in .claude/skills, ~/.claude/skills and plugin caches; a same-named skill from another source counts as installed.');
      console.log('Fetch for review: gw skills fetch <id>   ·   install into this project: gw skills install <id>');
      return 0;
    }
    case 'maintain': {
      const info = maintainInfo(project());
      if (!info.length) { console.log('No targets set yet: gw set targets=…'); return 0; }
      for (const m of info) {
        console.log(`\n== ${m.target}${m.stack ? ' / ' + m.stack : ''}`);
        if (m.commands) { for (const [k, v] of Object.entries(m.commands)) if (!['ecosystem', 'eol'].includes(k) && v) console.log(`  ${k.padEnd(14)} ${v}`); }
        else console.log('  (no stack set, or no maintain data for it: gw set stacks.<target>=<stack>)');
        if (m.rollback) console.log(`  rollback       ${m.rollback}`);
        for (const o of m.observe) console.log(`  observe        ${o}`);
        for (const p of m.policies) console.log(`  POLICY         ${p.what} (as of ${p.as_of}; re-check ${p.check})`);
      }
      console.log('\nPlaybooks: phases/UPGRADE.md · MAINTAIN.md · OPERATE.md · SECURITY.md · end-of-life check: gw eol');
      return 0;
    }
    case 'eol': return eolCheck(hostProfile()).then(rows => {
      if (!rows.length) { console.log('No runtimes with end-of-life data detected (node, python, dotnet, java, go).'); return 0; }
      for (const r of rows) console.log(`  ${r.status === 'eol' ? '✗ EOL ' : r.status === 'soon' ? '! SOON' : r.status === 'ok' ? '✓ ok  ' : '? ' + r.status}  ${r.tool} ${r.version}${r.line ? ` (line ${r.line}${r.lts ? ', LTS' : ''}, end of life ${r.eol || 'n/a'}${r.days_left !== null ? ', ' + r.days_left + ' days' : ''})` : ''}${r.note ? ' · ' + r.note : ''}`);
      console.log('Checks this machine\'s runtimes. Project pins (.nvmrc, global.json, TargetFramework, toolchain files) may differ: check those too (phases/UPGRADE.md).');
      return rows.some(r => r.status === 'eol') ? 1 : 0;
    });
    case 'version': console.log(`groundwork ${VERSION}` + (exists(P('project.json')) ? ` · project state ${project().framework_version || '0.2.0'}` : '')); return 0;
    case 'migrate': migrate(); return 0;
    case 'upgrade': return upgrade(args[0], args);
    case 'verify': {  // gw verify [--clean]: compare the framework folder with its manifest
      const i = integrity();
      if (!i.manifest) { console.log('No MANIFEST.json in groundwork/: cannot verify.'); return 1; }
      console.log(`groundwork ${VERSION} (manifest ${i.version})`);
      const list = (t, a) => a.length && console.log(`${t} (${a.length}):\n  ` + a.join('\n  '));
      list('Modified locally (lost on upgrade; move to .groundwork/ overrides)', i.modified);
      list('Leftover files not in this version (stale instructions)', i.stale);
      list('Missing files (incomplete copy)', i.missing);
      if (args.includes('--clean')) for (const f of i.stale) { fs.rmSync(path.join(FW, f)); console.log('removed ' + f); }
      if (!i.modified.length && !i.stale.length && !i.missing.length) console.log('Clean: matches the shipped version.');
      return i.missing.length ? 1 : 0;
    }

    default:
      console.log('Groundwork CLI\n  init [--profile minimal|standard|strict] [--no-hooks]   set up this project (state, CLAUDE.md import, hooks) and scan the host\n' +
        '  doctor [--fresh] [--json]   scan host if needed, check tools for the chosen targets\n  plan-install   list install/fix commands for this machine (never runs them)\n' +
        '  status | next   show phase, blockers, next step\n  set k=v ...   e.g. set tier=standard stage=greenfield targets=web,android stacks.android=flutter\n' +
        '  phase <id> <status> ["note"]   record phase progress\n  run <target> <tier> -- <cmd>   run tests and write a receipt\n  gate <G1|G2> [--approve "..."]   check / approve a gate\n  scan   print raw host profile\n  note <category> "text"   silent framework feedback (agent)\n  feedback   write .groundwork/FEEDBACK.md\n  skills [--all] | skills fetch <id> | skills install <id>   catalogue of vetted-source skills\n  maintain   upgrade/audit/dead-code/rollback/observability commands for this project\n  eol   runtime end-of-life check (endoflife.date)\n  version | verify [--clean] | upgrade <new-groundwork-folder> [--force] | migrate');
      return cmd ? 1 : 0;
  }
}

module.exports = { suggestSkills, maintainInfo, catalog, buildManifest, integrity, changelogSince, capabilities, devMethod, feasibility, kvmCheck, dockerCheck, toolCheck, vcmp, installCommand };
if (require.main === module) {
  try { const r = main(process.argv.slice(2)); if (r && r.then) r.then(c => { process.exitCode = c; }, e => { fb('error', { cmd: process.argv[2] || '', message: e.message }); console.error('gw: ' + e.message); process.exitCode = 1; }); else process.exitCode = r; } catch (e) { fb('error', { cmd: process.argv[2] || '', message: e.message }); console.error('gw: ' + e.message); process.exitCode = 1; }
}
