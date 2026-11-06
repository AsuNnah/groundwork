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
const readJson = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')); } catch { return d; } };   // BOM: Windows PowerShell 5.1 writes one
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
    feedbackReport();   // keep FEEDBACK.md current: users copy it whenever they like
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
  section('Stop blocked (task not verified)', group('stop-blocked', e => e.reason));
  section('Circuit breakers (3+ failed checks)', group('circuit-breaker', e => e.task));
  section('Tasks over the diff budget', group('diff-budget', e => `${e.task}: ${e.lines} lines`));
  section('Task checks changed', group('verify-changed', e => `${e.task}: \`${e.from}\` → \`${e.to}\``));
  try { const m = metrics(proj); if (m.tasks) L.push('## Delivery metrics', '', `- Tasks: ${m.tasks} · done: ${m.done} · first-pass (check passed first time): ${m.first_pass} · reopened: ${m.reopened} · rework rate: ${m.rework_rate ?? '-'}`,
    `- Failed checks: ${m.failed_checks} · median task: ${m.median_task_minutes ?? '-'} min · release runs: ${m.release_runs} (${m.release_runs_failed} failed) · reverts: ${m.reverts} · circuit breakers: ${m.circuit_breakers} · stop blocks: ${m.stop_blocks}`, ''); } catch { }
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
  const h = readJson(out);
  if (!h || !h.os) throw new Error(`host scan wrote ${path.relative(ROOT, out)}, but it is not a readable host profile. Run the scanner by hand to see why: ${process.platform === 'win32' ? 'powershell -ExecutionPolicy Bypass -File groundwork\\scan\\scan.ps1' : 'sh groundwork/scan/scan.sh'}`);
  return h;
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
// the project may override the host's dev method (e.g. a no-Docker rule); non-container methods then don't use local containers
const DEV_METHODS = ['devcontainer', 'native-user-scope', 'wsl2-first', 'native-winget', 'native-macos', 'light', 'in-place', 'manual'];
function projectCaps(h, proj) {
  const c = capabilities(h);
  if (proj.dev_method && !['devcontainer', 'in-place'].includes(proj.dev_method)) c.containers = false;
  return c;
}
function chosenMethod(h, c, proj) {
  const auto = devMethod(h, c);
  if (!proj.dev_method || proj.dev_method === auto.id) return auto;
  return { id: proj.dev_method, why: 'project override' + (proj.dev_method_reason ? ': ' + proj.dev_method_reason : '') + ` (host default: ${auto.id}); local container tiers off`, override: true, host_default: auto.id };
}
// project overrides live in .groundwork/ so the framework folder can be replaced on upgrade
function packs() {
  const load = dir => !exists(dir) ? {} : Object.fromEntries(fs.readdirSync(dir).filter(f => f.endsWith('.json') && !['tools.json', 'presets.json', 'devcontainers.json'].includes(f))
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
// Figma MCP for mockups (phases/MOCKUP.md). Files only: config presence, never credentials; the agent verifies the login with whoami.
const FIGMA_MCP = /mcp\.figma\.com|127\.0\.0\.1:3845/;
function figmaConfigured(home = os.homedir()) {
  const hit = f => { try { return FIGMA_MCP.test(fs.readFileSync(f, 'utf8')); } catch { return false; } };
  if ([path.join(ROOT, '.mcp.json'), path.join(home, '.claude.json'), path.join(home, '.claude', 'settings.json'), path.join(ROOT, '.claude', 'settings.json')].some(hit)) return true;
  const seek = (d, depth) => { if (depth < 0) return false;   // plugin caches: <plugin>/.mcp.json
    try { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name);
      if (e.isFile() && e.name === '.mcp.json' && /figma/i.test(d) && hit(f)) return true;
      if (e.isDirectory() && seek(f, depth - 1)) return true; } } catch { }
    return false; };
  return seek(path.join(home, '.claude', 'plugins'), 5);
}
function figmaCheck(proj, all = packs()) {
  if (!(proj.targets || []).some(t => (all[t] || {}).ui)) return null;   // only projects with screens
  const base = { id: 'figma', name: 'Figma MCP (mockups, phases/MOCKUP.md)', severity: 'warn', why: 'visual mockups you can open, comment on and share' };
  if (figmaConfigured()) return { ...base, status: 'unknown', found: 'Figma MCP is set up; login not verified',
    fix: 'agent: call the Figma whoami tool. If it fails, MANUAL ACTION by the user: in Claude Code run /mcp, choose figma, Authenticate, and sign in to Figma in the browser (on a headless machine, open the printed link on any device). No Figma account? Sign up free at figma.com. Steps that need the browser (capture a web app, open the file): MANUAL ACTION: log in to figma.com in the browser and install/turn on the Claude in Chrome extension',
    impact: 'until verified, mockups fall back to the HTML prototype' };
  return { ...base, status: 'missing', found: 'no Figma plugin or MCP configured for this agent',
    fix: 'suggest turning it on. Agent, with approval: claude mcp add --transport http figma https://mcp.figma.com/mcp (or the user installs the Figma plugin via /plugin). Then MANUAL ACTION by the user: restart the agent, run /mcp → figma → Authenticate, and sign in to Figma (free account is enough); for browser steps also log in to figma.com in the browser and install/turn on the Claude in Chrome extension',
    impact: 'mockups use the no-account HTML prototype instead' };
}
function doctor(h, proj) {
  const c = projectCaps(h, proj), checks = [];
  checks.push(toolCheck(h, { id: 'git', severity: 'block' }, 'version control'));
  checks.push(dockerCheck(h));
  checks.push(kvmCheck(h, c));
  { const ins = inspectorStatus();   // vetting third-party skills before install (phases/P4.md)
    checks.push(ins.skill ? { id: 'skill-vetting', name: 'Skill vetting (skill-inspector + SkillSpector)', status: 'ok', severity: ins.cli ? 'warn' : 'info',
        ...(ins.cli ? {} : { found: 'skill-inspector installed; optional SkillSpector CLI not installed (reviews are semantic-only, see gw plan-install)' }) }
      : { id: ins.skill ? 'skillspector' : 'skill-vetting', name: 'Skill vetting (skill-inspector + SkillSpector)', status: 'missing', severity: 'warn',
          found: ins.skill ? 'skill-inspector installed, SkillSpector CLI missing' : (ins.cli ? 'SkillSpector CLI only' : 'neither installed'),
          impact: ins.skill ? 'skill reviews are semantic-only (lower confidence)' : 'skill reviews fall back to the manual checklist in phases/P4.md',
          fix: ins.skill ? 'install the SkillSpector CLI (see gw plan-install), with approval' : `install it first, Groundwork uses it to vet every skill: ${INSPECTOR_INSTALL}; optional scanner: see gw plan-install`, install: ins.skill }); }
  if ((proj.references || []).length) for (const id of ['rea', 'scrapling'])   // reference-app research (phases/RESEARCH.md)
    checks.push(toolCheck(h, { id, severity: 'warn', why: 'reference-app research: ' + (id === 'rea' ? 'how an app, APK, binary or site works inside' : 'fetch and parse reference web pages') }));
  { const f = figmaCheck(proj); if (f) checks.push(f); }
  if (!c.ci_remote) checks.push({ id: 'gh', name: 'GitHub CLI (CI sandboxes, S3)', status: 'missing', severity: 'warn', install: true });
  if ((h.memory.total_gb || 0) < 8) checks.push({ id: 'ram', name: 'RAM', status: 'misconfigured', severity: 'warn', found: h.memory.total_gb + ' GB', required: '>= 8 GB for emulators' });
  if ((h.disk.free_gb_workdir || 0) < 20) checks.push({ id: 'disk', name: 'Free disk', status: 'misconfigured', severity: 'warn', found: h.disk.free_gb_workdir + ' GB', required: '>= 20 GB' });
  const all = packs();
  for (const target of proj.targets || []) {
    const pk = all[target];
    if (!pk) { fb('unknown-target', { target }); checks.push({ id: 'pack:' + target, name: 'Pack ' + target, status: 'missing', severity: 'block', fix: `no pack named "${target}". Known targets: ${Object.keys(all).join(', ')} (e.g. an HTTP API is "backend"). Or add groundwork/packs/${target}.json` }); continue; }
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
  const feas = feasibility(c);
  for (const target of proj.targets || []) {   // release tier only on CI: point at the ready-made workflow
    let e = null; try { e = ciPlan(proj, [target], null)[0]; } catch { }
    if (e && e.fragment && feas[target] && !feas[target].release_tier_local && !exists(path.join(e.top, e.out)))
      checks.push({ id: 'ci:' + target, target, name: `CI workflow for ${target} (release tier ${feas[target].release_tier} runs on CI here)`, status: 'missing', severity: 'warn', fix: `gw ci write ${target}`, impact: 'no release-tier receipt for this target until CI runs' });
  }
  const blocking = checks.filter(x => x.severity === 'block' && x.status !== 'ok');
  const report = { generated_at: now(), host: summary(h), capabilities: c, dev_method: chosenMethod(h, capabilities(h), proj), targets: feas, checks, ready: blocking.length === 0 };
  writeJson(P('env-report.json'), report);
  const seen = new Set(fbEvents().filter(e => e.kind === 'check').map(e => e.id + e.status));
  for (const x of checks) if (x.status !== 'ok' && x.severity !== 'info' && !seen.has(x.id + x.status)) fb('check', { id: x.id, name: x.name, status: x.status, found: x.found || null });
  return report;
}
function summary(h) {
  return `${h.machine.kind} · ${h.os.distro || h.os.family} ${h.os.version} · ${h.cpu.arch} · ${h.cpu.threads} threads · ${h.memory.total_gb} GB RAM · ${h.disk.free_gb_workdir} GB free${h.gpu.model ? ' · ' + h.gpu.model : ''}`;
}
function installCommand(h, id) {
  const entry = tools()[id]; if (!entry) return null;
  const pms = (h.os.package_managers || '').split(' ').filter(Boolean);
  const have = k => k === 'any' || (h.toolchains || {})[k] || pms.includes(k);
  const order = ['mise', ...pms, 'uv', 'npm', 'any'];
  for (const k of order) if (entry.install[k] && have(k)) return { via: k, cmd: entry.install[k] };
  const k = Object.keys(entry.install)[0];
  return { via: k + ' (not on this host)', cmd: entry.install[k] };
}

// ---------- status / next ----------
function nextStep() {
  const proj = project(), st = state();
  if (!exists(P('host-profile.json'))) return { phase: 'H0', do: 'node groundwork/bin/gw.js doctor   # scan this machine first' };
  const tier = proj.tier;
  const plan = (TIER_PHASES[tier] || TIER_PHASES.standard).filter(id => !(BROWNFIELD.includes(proj.stage) && ['P1', 'P5'].includes(id)));   // CHANGE.md's change folder replaces discovery and design docs
  const light = ['trivial', 'small'].includes(tier) && !(proj.targets || []).length;   // the CLI says the whole step, so no phase file to read
  for (const id of plan) {
    const s = (st.phases[id] || {}).status;
    if (s === 'done' || s === 'skipped') continue;
    if (tier === 'trivial' && id === 'P7') return { phase: id, do: 'one task: gw task add T01 "<the fix>" --verify "<test command>", gw task start T01, make the fix, gw task done T01, then gw phase P7 done' };
    if (light && id === 'P8') return { phase: id, do: 'no targets, so the task receipts are the verification: gw phase P8 done' };
    if (BROWNFIELD.includes(proj.stage) && ['P2', 'P3', 'P4'].includes(id)) return { phase: id, do: `read groundwork/phases/${id}.md only if the change adds a target, stack or dependency; otherwise gw phase ${id} skipped "${{ P2: 'existing stack', P3: 'environment unchanged', P4: 'no new tools or skills' }[id]}"` };
    return { phase: id, do: `read groundwork/phases/${id}.md` + (tier ? '' : '  (size tier not set yet: P0 decides it)') };
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
  const cur = loadTasks().list.find(t => t.status === 'in_progress');
  if (cur) lines.push(`Task in progress: ${cur.id} ${cur.title || ''} · check: ${cur.verify || '(none: add one)'} · finish with gw task done ${cur.id}`);
  if (st.recheck && st.recheck.length) lines.push(`Re-check after the framework upgrade (their instructions changed): ${st.recheck.join(', ')}`);
  return lines.join('\n');
}

// ---------- gates & runs ----------
const MARKER = /\[NEEDS CLARIFICATION/;
const DOC_KEYS = { 'prd.md': 'prd', 'plan.md': 'plan', 'test-strategy.md': 'test_strategy' };
const readRel = f => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return null; } };
// where a project doc lives: docs.<key> override > docs_dir > docs/; file names match case-insensitively (PRD.md)
function docPath(name, proj = project()) {
  const o = (proj.docs || {})[DOC_KEYS[name] || name.replace(/\.md$/, '')];
  if (o) return o;
  const dir = proj.docs_dir || 'docs';
  try { const hit = fs.readdirSync(path.join(ROOT, dir)).find(f => f.toLowerCase() === name); if (hit) return path.posix.join(dir, hit); } catch { }
  return path.posix.join(dir, name);
}
// documents the tier and the project's features need: GATE 1 checks exactly these, P5 writes only these (doc budget)
const FEATURES = ['ui', 'api', 'db', 'auth', 'pii', 'payments', 'public'];
function projectFeatures(proj = project(), all = packs()) {
  const f = new Set(proj.features || []);
  if ((proj.targets || []).some(t => (all[t] || {}).ui)) f.add('ui');
  if ((proj.targets || []).includes('backend')) f.add('api');
  return f;
}
const BROWNFIELD = ['feature', 'bugfix', 'migration', 'refactor'];   // changes to an existing system: phases/CHANGE.md
function requiredDocs(proj = project(), all = packs()) {
  const tier = proj.tier, f = projectFeatures(proj, all), out = [], add = (doc, why) => out.push({ doc, why });
  if (!tier || tier === 'trivial') return out;
  if (BROWNFIELD.includes(proj.stage)) {   // the current-truth docs already exist: write the change, not a new doc set
    if (proj.stage === 'bugfix') add('changes/<id>/bugfix.md', 'current vs expected behaviour, repro, root cause');
    else { add('changes/<id>/proposal.md', 'why, what changes, out of scope, affected REQ IDs'); add('changes/<id>/delta.md', 'requirements ADDED / MODIFIED / REMOVED'); }
    if ((proj.features || []).includes('ui')) add('dbd.md', 'changes screens: mockup of the changed screens');
    if (tier === 'large' || ['auth', 'pii', 'payments', 'public'].some(x => f.has(x))) add('srd.md', tier === 'large' ? 'large tier' : 'touches auth, personal data, payments or a public API');
    return out;
  }
  if (tier === 'small') {
    add('plan.md', 'small: a short plan with the tasks and their checks');
    if (f.has('ui')) add('dbd.md', 'has screens: the approved mockup is recorded here');
    return out;
  }
  add('intent.md', 'the confirmed intent, before the PRD'); add('prd.md', 'requirements with IDs');
  add('fsd.md', 'features and acceptance criteria'); add('trd.md', 'architecture and technical decisions');
  if (f.has('ui')) add('dbd.md', 'has screens');
  if (f.has('api') || f.has('db')) add('bsd.md', 'has an API or a database');
  if (tier === 'large' || ['auth', 'pii', 'payments', 'public'].some(x => f.has(x))) add('srd.md', tier === 'large' ? 'large tier' : 'touches auth, personal data, payments or a public API');
  if (tier === 'large') { add('afd.md', 'large: flows across modules'); for (const t of proj.targets || []) add(`platform/${t}.md`, `large: platform notes for ${t}`); }
  add('plan.md', 'milestones, risks, complexity tracking'); add('test-strategy.md', 'which tests run at which sandbox tier');
  return out;
}
// the change being worked on: the newest folder in docs/changes/ (archive excluded)
function activeChange(proj = project()) {
  try { return fs.readdirSync(path.join(ROOT, proj.docs_dir || 'docs', 'changes'), { withFileTypes: true }).filter(e => e.isDirectory() && e.name !== 'archive').map(e => e.name).sort().pop() || null; } catch { return null; }
}
function resolveDoc(doc, proj = project()) {
  if (!doc.startsWith('changes/<id>/')) return docPath(doc, proj);
  return path.posix.join(proj.docs_dir || 'docs', 'changes', activeChange(proj) || '<YYYYMMDD-slug>', doc.slice('changes/<id>/'.length));
}
// requirement IDs defined in the PRD (table rows "| REQ-001 |" or headings "### REQ-001"); rows saying out of scope are excluded
const REQ_ID = /\b(?:REQ|NFR|JRN|SEC)-\d{3,}\b/g;
const REQ_DEF = /^\s*(?:\|\s*|#{2,4}\s+)\**((?:REQ|NFR|JRN|SEC)-\d{3,})\b/;
function prdRequirements(text) {
  return String(text || '').split('\n').map(line => { const m = line.match(REQ_DEF); return m && { id: m[1], text: line,
    out: /\b(out of scope|out-of-scope|deferred|not in v1|won'?t do)\b/i.test(line), delivered: /\b(delivered|already built|shipped)\b/i.test(line) }; }).filter(Boolean);
}
const TEST_FILE = /(^|\/)(tests?|spec|__tests__|e2e)\/|\.(test|spec)\.[a-z0-9]+$|_test\.[a-z0-9]+$|(^|\/)test_[^/]+\.py$/i;
const SKIP_DIRS = new Set(['node_modules', '.git', 'groundwork', '.groundwork', 'dist', 'build', 'target', 'vendor', '.venv', 'venv', '__pycache__', '.next', 'coverage', '.dart_tool', 'Pods', '.gradle']);
function testFiles(dir = ROOT, out = [], depth = 0) {
  if (depth > 8 || out.length > 5000) return out;   // shortcut: very large repos are only partly scanned; set docs/tests paths if this misses tests
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) { const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) testFiles(f, out, depth + 1); }
    else if (TEST_FILE.test(path.relative(ROOT, f).split(path.sep).join('/'))) out.push(f); }
  return out;
}
// REQ → tasks → tests (V-model pairing). Only REQ- and SEC- IDs must have a task and a test; NFR/JRN are reported.
function trace(proj = project()) {
  let prdFile = docPath('prd.md', proj), defs = prdRequirements(readRel(prdFile));
  if (!defs.length) { const pf = docPath('plan.md', proj), d = prdRequirements(readRel(pf)); if (d.length) { prdFile = pf; defs = d; } }   // small tier: REQs live in the plan
  const tasks = loadTasks().list, tests = testFiles().map(f => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } }).join('\n');
  // a change to an existing system answers for the IDs its change docs name; requirements already delivered need no new task
  // a delivered row needs a task only when the change's spec (delta.md / bugfix.md) names it, not for a mention in the proposal ("REQ-001 tests still pass")
  const ch = BROWNFIELD.includes(proj.stage) && activeChange(proj), chDoc = f => readRel(path.posix.join(proj.docs_dir || 'docs', 'changes', ch, f)) || '';
  const inChange = ch ? new Set(['proposal.md', 'delta.md', 'bugfix.md'].map(chDoc).join('\n').match(REQ_ID) || []) : null;
  const inSpec = ch ? new Set([chDoc('delta.md'), chDoc('bugfix.md')].join('\n').match(REQ_ID) || []) : new Set();
  const ids = [...new Set(defs.filter(d => !d.out).map(d => d.id))], delivered = new Set(defs.filter(d => d.delivered).map(d => d.id));
  const rows = ids.map(id => ({ id, delivered: delivered.has(id), enforced: /^(REQ|SEC)-/.test(id) && (inChange ? inChange.has(id) && (!delivered.has(id) || inSpec.has(id)) : !delivered.has(id)), tasks: tasks.filter(t => (t.req || []).includes(id)).map(t => t.id), tested: new RegExp(`\\b${id}\\b`).test(tests) }));
  const known = new Set(defs.map(d => d.id)), orphans = [...new Set(tasks.flatMap(t => t.req || []))].filter(r => !known.has(r));
  return { prd: defs.length ? prdFile : null, change: ch || null, rows, out_of_scope: defs.filter(d => d.out).map(d => d.id), orphans };
}
// requirement quality and OpenSpec delta structure: errors fail GATE 1, warnings are advice
function lint(proj = project()) {
  const errors = [], warnings = [], prdFile = docPath('prd.md', proj), seen = new Set();
  for (const d of prdRequirements(readRel(prdFile))) {
    if (seen.has(d.id)) errors.push(`${prdFile}: ${d.id} is defined more than once`); seen.add(d.id);
    const len = d.text.replace(/\|/g, ' ').trim().length;
    if (len > 500) warnings.push(`${prdFile}: ${d.id} is ${len} characters; split it (one need per requirement)`);
    if (/^(REQ|SEC)-/.test(d.id) && !d.out && !/\bshall\b|\bmust\b|\b(when|given|if|while)\b[\s\S]*\bthen\b/i.test(d.text))
      warnings.push(`${prdFile}: ${d.id} has no testable acceptance criterion (EARS "WHEN … the system SHALL …" or Given/When/Then)`);
  }
  const cdir = path.posix.join(proj.docs_dir || 'docs', 'changes');
  let changes = []; try { changes = fs.readdirSync(path.join(ROOT, cdir)).filter(d => d !== 'archive'); } catch { }
  for (const c of changes) {
    const rel = path.posix.join(cdir, c, 'delta.md'), t = readRel(rel); if (t == null) continue;
    let section = null, req = null;
    const close = () => { if (!req) return;
      if (['ADDED', 'MODIFIED'].includes(section)) {
        if (!/\b(SHALL|MUST)\b/.test(req.body)) errors.push(`${rel}: "${req.name}" (${section}) has no SHALL/MUST statement`);
        if (!req.scenarios.length) errors.push(`${rel}: "${req.name}" (${section}) has no #### Scenario`);
        for (const s of req.scenarios) if (!/\bWHEN\b/.test(s.body) || !/\bTHEN\b/.test(s.body)) warnings.push(`${rel}: scenario "${s.name}" needs a WHEN and a THEN step`);
      }
      if (section === 'REMOVED' && !/reason/i.test(req.body)) warnings.push(`${rel}: removed "${req.name}" has no Reason`);
      req = null; };
    for (const line of t.split('\n')) {
      let m;
      if ((m = line.match(/^## (\w+)/))) { close(); section = /^(ADDED|MODIFIED|REMOVED|RENAMED)$/i.test(m[1]) ? m[1].toUpperCase() : null; }
      else if ((m = line.match(/^### Requirement:\s*(.*)/))) { close(); req = { name: m[1].trim(), body: '', scenarios: [] }; }
      else if ((m = line.match(/^#### Scenario:\s*(.*)/)) && req) req.scenarios.push({ name: m[1].trim(), body: '' });
      else if (req) { req.body += line + '\n'; if (req.scenarios.length) req.scenarios[req.scenarios.length - 1].body += line + '\n'; }
    }
    close();
  }
  return { errors, warnings };
}
function gateCheck(id) {
  const proj = project(), problems = [];
  if (id === 'G1') {
    const need = requiredDocs(proj).map(d => resolveDoc(d.doc, proj));
    if (!need.length) need.push(docPath('plan.md', proj));
    for (const f of need) { const t = readRel(f); if (t == null) problems.push(`missing ${f}`); else if (MARKER.test(t)) problems.push(`${f} still has [NEEDS CLARIFICATION] markers`); }
    const T = loadTasks();
    if (!T.exists) problems.push('missing .groundwork/tasks.json');
    for (const t of T.list) if (!t.verify) problems.push(`task ${t.id} has no "verify" command (the check that proves it works)`);
    for (const r of trace(proj).rows) if (r.enforced && !r.tasks.length) problems.push(`${r.id} has no task: add its ID to a task's "req" (gw task add … --req ${r.id}). ` + (r.delivered ? `It is delivered, but this change's delta or bugfix names it, so the change must prove it again.` : `Already built: write "delivered" in its PRD row. Not planned: "out of scope".`));
    for (const e of lint(proj).errors) problems.push(e);
    const env = readJson(P('env-report.json'));
    if (!env) problems.push('no env-report: run gw doctor'); else if (!env.ready) problems.push('environment has blocking checks: run gw doctor');
  } else if (id === 'G2') {
    if (!exists(P('gates', 'G1.json'))) problems.push('G1 not approved');
    const st = state(), all = packs(), rs = runs();
    for (const t of proj.targets || []) {
      const need = (all[t] || {}).min_release_tier || 'S1';
      const ok = rs.some(r => r.target === t && r.exit === 0 && r.tier >= need);
      const waived = (st.waivers || []).some(w => w.target === t);
      if (!ok && !waived) problems.push(`no passing ${need}+ run for ${t} (gw run ${t} ${need} -- <cmd>, or waive in state.json with a reason)`);
    }
    for (const t of loadTasks().list) {
      if (['todo', 'in_progress'].includes(t.status)) problems.push(`task ${t.id} is ${t.status} (finish it with gw task done ${t.id}, or gw task block ${t.id} "<reason>")`);
      if (t.status === 'done' && !t.legacy && !taskPassed(t)) problems.push(`task ${t.id} is marked done without a passing check: gw task done ${t.id}`);
    }
    for (const r of trace(proj).rows) if (r.enforced && !r.tested && !(st.waivers || []).some(w => w.req === r.id)) problems.push(`${r.id} has no test that names it (put the ID in a test name or comment, or waive: {"req":"${r.id}","reason":"…"} in state.json)`);
    if (['standard', 'large'].includes(proj.tier)) {
      const rv = reviewLog();
      if (!rv.some(x => x.kind === 'review')) problems.push('no code review recorded: run a fresh-context review (phases/P9.md), then gw review done --reviewer fresh-context "<summary>"');
      for (const x of rv.filter(x => x.kind === 'finding' && ['CRITICAL', 'HIGH'].includes(x.severity)))
        if (x.verdict === 'open' || (x.verdict === 'waived' && !x.reason)) problems.push(`${x.severity} review finding ${x.verdict === 'open' ? 'still open' : 'waived without a reason'}: ${x.finding}`);
    }
    problems.push(...credits(proj).problems);   // reused open-source code needs a source and a license that allows it
  } else problems.push('unknown gate ' + id);
  return problems;
}
function runs() {
  const d = P('runs'); if (!exists(d)) return [];
  return fs.readdirSync(d).map(r => readJson(path.join(d, r, 'receipt.json'))).filter(Boolean);
}
const git = (...a) => { const r = cp.spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; };
function recordRun({ target, tier, command, task }) {
  const id = now().replace(/[:.]/g, '-') + '-' + (task || target), started = now();
  const log = P('runs', id, 'logs', 'output.txt'); fs.mkdirSync(path.dirname(log), { recursive: true });
  const fd = fs.openSync(log, 'w'), r = cp.spawnSync(command, { shell: true, stdio: ['inherit', fd, fd], cwd: ROOT }); fs.closeSync(fd);   // one file keeps stdout/stderr order
  const out = fs.readFileSync(log, 'utf8').trimEnd().split('\n'), keep = r.status === 0 ? 12 : 60;   // a pass needs only the summary; a failure needs the error
  if (out.length > keep) console.log(`… ${out.length - keep} earlier lines in .groundwork/runs/${id}/logs/output.txt`);
  if (out.join('')) console.log(out.slice(-keep).join('\n'));
  const receipt = { target, tier, command, exit: r.status, commit: git('rev-parse', '--short', 'HEAD'), started, ended: now(), ...(task ? { task } : {}) };
  writeJson(P('runs', id, 'receipt.json'), receipt);
  if (r.status !== 0) fb('run-failed', { target, tier, command });
  return { id, receipt };
}

// ---------- tasks: done only when the task's check passes (A1); one in progress at a time (A6) ----------
function loadTasks() {
  const raw = readJson(P('tasks.json'), null), list = Array.isArray(raw) ? raw : ((raw && raw.tasks) || []);
  const save = () => { const f = P('tasks.json'), tmp = f + '.tmp'; writeJson(tmp, Array.isArray(raw) || !raw ? list : { ...raw, tasks: list }); fs.renameSync(tmp, f); };
  return { list, save, exists: !!raw };
}
const taskRuns = id => runs().filter(r => r.task === id).sort((a, b) => String(a.started).localeCompare(String(b.started)));
// only receipts from the current attempt count: a reopened task needs a new passing check
const taskPassed = t => { const r = taskRuns(t.id).filter(x => !t.started_at || String(x.started) >= t.started_at).pop(); return !!(r && r.exit === 0); };
function diffLines(base) {   // lines added + removed since the task started, new untracked files included
  if (!base) return 0;
  const skip = ['groundwork', '.groundwork', '.claude'].map(d => `:(exclude)${d}`);   // framework files are not the task's change
  const tracked = (git('diff', '--numstat', base, '--', '.', ...skip) || '').split('\n').filter(Boolean).reduce((a, l) => { const [x, y] = l.split('\t'); return a + (+x || 0) + (+y || 0); }, 0);
  const untracked = (git('ls-files', '--others', '--exclude-standard', '--', '.', ...skip) || '').split('\n').filter(Boolean)
    .reduce((a, f) => { try { const s = fs.statSync(path.join(ROOT, f)); return a + (s.size < 1e6 ? fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').length : 0); } catch { return a; } }, 0);
  return tracked + untracked;
}
function taskCmd(args) {
  const [sub, id, ...rest] = args, T = loadTasks(), proj = project();
  const find = () => { const t = T.list.find(x => x.id === id); if (!t) throw new Error(`no task "${id}" in .groundwork/tasks.json (gw task list)`); return t; };
  if (sub === 'add') {   // gw task add T01 "title" --verify "<cmd>" [--req REQ-001,REQ-002]
    const title = rest.find((a, i) => !a.startsWith('--') && !['--verify', '--req'].includes(rest[i - 1]));
    if (!id || !title || !flag(rest, '--verify')) throw new Error('usage: gw task add <id> "<title>" --verify "<command that proves it works>" [--req REQ-001,...]');
    if (T.list.some(x => x.id === id)) throw new Error(`task ${id} already exists (gw task list). Change its check with gw task verify ${id} "<cmd>", or use a new id.`);
    T.list.push({ id, title, req: (flag(rest, '--req') || '').split(',').map(x => x.trim()).filter(Boolean), verify: flag(rest, '--verify'), status: 'todo' });
    T.save(); console.log(`Added ${id}. Next: gw task start ${id}`); return 0;
  }
  if (sub === 'start') {
    const t = find(), other = T.list.find(x => x.status === 'in_progress' && x.id !== id);
    if (other) throw new Error(`${other.id} is still in progress. One task at a time: finish it (gw task done ${other.id}) or block it (gw task block ${other.id} "<reason>") first.`);
    if (!t.verify) throw new Error(`${id} has no "verify" command. Add the command that proves it works to the task in .groundwork/tasks.json.`);
    Object.assign(t, { status: 'in_progress', started_at: now(), base: git('rev-parse', 'HEAD') }); T.save();
    console.log(`${id} in progress: ${t.title}\nIts check: ${t.verify}\nWhen the check should pass: gw task done ${id}`); return 0;
  }
  if (sub === 'done') {
    const t = find();
    if (!t.verify) throw new Error(`${id} has no "verify" command, so it can't be checked. Add one to the task in .groundwork/tasks.json.`);
    const tier = /^S[0-3]$/.test(t.tier || '') ? t.tier : 'S0', target = t.target || (proj.targets || [])[0] || 'host';
    console.log(`Running the check for ${id}: ${t.verify}`);
    const { id: rid, receipt } = recordRun({ target, tier, command: t.verify, task: id });
    if (receipt.exit === 0) {
      const lines = diffLines(t.base), budget = +proj.diff_budget || 400;
      Object.assign(t, { status: 'done', done_at: now(), receipt: rid }); delete t.blocked_reason; T.save();
      console.log(`${id} done: its check passed (receipt .groundwork/runs/${rid}).\nIn your report, say what this check ran (${t.verify}) and its real pass/fail counts. If the full test suite has failures that were there before this task, name them as pre-existing: no output from a filtered command is not a pass.`);
      if (lines > budget) { console.log(`Note: ${id} changed ${lines} lines (budget ${budget}). Split work like this into smaller tasks next time: small diffs are easier to verify.`); fb('diff-budget', { task: id, lines, budget }); }
      return 0;
    }
    t.failed_checks = (t.failed_checks || 0) + 1; if (t.status !== 'done') t.status = 'in_progress'; T.save();
    const limit = +proj.attempt_limit || 3;
    console.log(`${id} is NOT done: its check failed (exit ${receipt.exit}, failed check ${t.failed_checks} of ${limit}). Fix the cause; don't weaken the check.` +
      (t.failed_checks === 1 ? `\nIf the failing tests are not this task's and already failed before it (baseline), scope the check to this task's tests: gw task verify ${id} "<cmd>", and tell the user which tests fail.` : ''));
    if (t.failed_checks >= limit) { console.log(`Circuit breaker: ${t.failed_checks} failed checks on ${id}. Stop changing code. Tell the user what fails and why, and reshape the task with them (smaller scope, another approach, or gw task block ${id} "<reason>").`); fb('circuit-breaker', { task: id, failed: t.failed_checks }); }
    return 1;
  }
  if (sub === 'block') { const t = find(), why = rest.join(' ').trim(); if (!why) throw new Error('usage: gw task block <id> "<what blocks it>"');
    Object.assign(t, { status: 'blocked', blocked_reason: why, blocked_at: now() }); T.save(); fb('task-blocked', { task: id, reason: why });
    console.log(`${id} blocked: ${why}. Tell the user what is needed to unblock it.`); return 0; }
  if (sub === 'reopen') { const t = find(); Object.assign(t, { status: 'todo', reopened: (t.reopened || 0) + 1, failed_checks: 0, started_at: now() }); delete t.done_at; delete t.receipt; delete t.legacy; T.save();
    fb('task-reopened', { task: id, reason: rest.join(' ') || null }); console.log(`${id} reopened.`); return 0; }
  if (sub === 'verify') {   // change a task's check: a visible decision, never a silent edit
    const t = find(), cmd = rest.join(' ').trim(); if (!cmd) throw new Error('usage: gw task verify <id> "<new check command>"');
    if (t.status === 'done') throw new Error(`${id} is done; reopen it first (gw task reopen ${id} "<why>")`);
    const from = t.verify || null; t.verify = cmd; T.save();
    fs.appendFileSync(P('decisions.jsonl'), JSON.stringify({ at: now(), kind: 'verify-changed', task: id, from, to: cmd }) + '\n'); fb('verify-changed', { task: id, from, to: cmd });
    console.log(`${id} check changed: ${from || '(none)'} → ${cmd}. Tell the user why (e.g. tests that already failed before this task).`); return 0;
  }
  const usage = 'usage: gw task [list] | add <id> "<title>" --verify "<cmd>" [--req REQ-001] | start <id> | done <id> | verify <id> "<new check>" | block <id> "<reason>" | reopen <id> ["reason"]';
  if (sub === 'help') { console.log(usage); return 0; }
  if (sub && sub !== 'list') throw new Error(usage);
  if (!T.exists) { console.log('No tasks yet. Add one: gw task add T01 "<title>" --verify "<command that proves it works>"'); return 0; }
  for (const t of T.list) console.log(`${String(t.id).padEnd(6)} ${String(t.status).padEnd(12)} ${t.title || ''}${t.failed_checks ? ` · ${t.failed_checks} failed check(s)` : ''}${t.blocked_reason ? ' · ' + t.blocked_reason : ''}`);
  return 0;
}

// ---------- review findings (P9) ----------
const reviewLog = () => { try { return fs.readFileSync(P('reviews.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch { return []; } };
function reviewCmd(args) {
  const [sub, ...rest] = args, text = rest.filter((a, i) => !a.startsWith('--') && !['--reviewer', '--verdict', '--reason'].includes(rest[i - 1]));
  const log = x => { fs.mkdirSync(GW, { recursive: true }); fs.appendFileSync(P('reviews.jsonl'), JSON.stringify({ at: now(), ...x }) + '\n'); };
  if (sub === 'add') {   // gw review add HIGH "<finding>" --verdict fixed|waived|deferred|open [--reason "..."]
    const [severity, finding] = text, verdict = flag(rest, '--verdict') || 'open';
    if (!['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(severity) || !finding || !['fixed', 'waived', 'deferred', 'open'].includes(verdict))
      throw new Error('usage: gw review add <CRITICAL|HIGH|MEDIUM|LOW> "<finding>" --verdict <fixed|waived|deferred|open> [--reason "…"]');
    log({ kind: 'finding', severity, finding, verdict, reason: flag(rest, '--reason') || null }); console.log(`Recorded ${severity} finding (${verdict}).`); return 0;
  }
  if (sub === 'done') {  // gw review done --reviewer fresh-context "<summary>"
    const reviewer = flag(rest, '--reviewer');
    if (!['fresh-context', 'human', 'ci'].includes(reviewer) || !text[0]) throw new Error('usage: gw review done --reviewer <fresh-context|human|ci> "<summary>"  (a self-review does not count)');
    log({ kind: 'review', reviewer, summary: text[0] }); console.log('Review recorded.'); return 0;
  }
  if (sub === 'help') { console.log('usage: gw review [list] | add <CRITICAL|HIGH|MEDIUM|LOW> "<finding>" --verdict <fixed|waived|deferred|open> [--reason "…"] | done --reviewer <fresh-context|human|ci> "<summary>"'); return 0; }
  const rv = reviewLog(); if (!rv.length) { console.log('No review recorded yet (phases/P9.md).'); return 0; }
  for (const x of rv) console.log(x.kind === 'review' ? `review by ${x.reviewer}: ${x.summary}` : `  ${x.severity.padEnd(8)} ${x.verdict.padEnd(8)} ${x.finding}${x.reason ? ' · ' + x.reason : ''}`);
  return 0;
}

// ---------- reusing open-source code (phases/REUSE.md): license check, credits ----------
const LICENSE_TEXT = [   // first match wins: restricted add-ons and AGPL/LGPL before GPL, BSD-3 before BSD-2
  ['Commons-Clause', /Commons Clause/i], ['SSPL-1.0', /Server Side Public License/i], ['BUSL-1.1', /Business Source License/i], ['Elastic-2.0', /Elastic License/i],
  ['AGPL-3.0', /GNU AFFERO GENERAL PUBLIC LICENSE/i], ['LGPL-3.0', /GNU LESSER GENERAL PUBLIC LICENSE\s+Version 3/i], ['LGPL-2.1', /GNU (LESSER|LIBRARY) GENERAL PUBLIC LICENSE/i],
  ['GPL-3.0', /GNU GENERAL PUBLIC LICENSE\s+Version 3/i], ['GPL-2.0', /GNU GENERAL PUBLIC LICENSE/i], ['MPL-2.0', /Mozilla Public License,? (Version |v\.? ?)2\.0/i], ['EPL-2.0', /Eclipse Public License/i],
  ['Apache-2.0', /Apache License,?\s+Version 2\.0/i], ['MIT', /Permission is hereby granted, free of charge/i], ['ISC', /Permission to use, copy, modify, and\/or distribute this software for any purpose/i],
  ['BSD-3-Clause', /Redistribution and use in source and binary forms[\s\S]*Neither the name/i], ['BSD-2-Clause', /Redistribution and use in source and binary forms/i],
  ['Unlicense', /free and unencumbered software released into the public domain/i], ['CC0-1.0', /CC0 1\.0 Universal/i], ['Zlib', /provided 'as-is'[\s\S]*plainly marked/i],
];
function licenseClass(id = '') {
  const s = String(id).trim(), rank = ['permissive', 'weak', 'strong', 'unknown', 'restricted', 'none'];
  if (/\s+OR\s+/i.test(s)) return s.split(/\s+OR\s+/i).map(licenseClass).sort((a, b) => rank.indexOf(a) - rank.indexOf(b))[0];   // dual license: you pick the freer one
  if (!s || /^(none|unlicensed|proprietary|all rights reserved|see license)/i.test(s)) return 'none';
  if (/SSPL|BUSL|Business Source|Elastic|Commons.Clause|PolyForm|non-?commercial/i.test(s)) return 'restricted';
  if (/\bA?GPL|GNU (Affero )?General Public/i.test(s)) return 'strong';
  if (/LGPL|MPL|EPL|CDDL|Lesser General Public/i.test(s)) return 'weak';
  if (/MIT|ISC|BSD|Apache|Unlicense|CC0|Zlib|BSL-1\.0|PSF|Python-2|WTFPL/i.test(s)) return 'permissive';
  return 'unknown';
}
const REUSE_ADVICE = {
  permissive: 'reuse allowed: keep its copyright and license notice with the code you copy',
  weak: 'reuse allowed as a separate library or files; changes to those files stay under that license. Prefer it as a dependency to copying it into your code',
  strong: 'the whole program would have to be under a compatible GPL license (AGPL: also when it is only used over a network). Ask the user first, unless this project already is',
  restricted: 'source-available, not open source: do not copy its code (reading it to learn is fine)',
  none: 'no license means all rights reserved: do not copy its code (reading it to learn is fine)',
  unknown: 'license not recognised: read it and tell the user what it allows before copying anything',
};
function detectLicense(dir) {
  let files = []; try { files = fs.readdirSync(dir).filter(f => /^(licen[sc]e|copying|unlicense)([.-]|$)/i.test(f)); } catch { }
  for (const f of files) { const t = fs.readFileSync(path.join(dir, f), 'utf8').slice(0, 40000), hit = LICENSE_TEXT.find(([, re]) => re.test(t)); if (hit) return { id: hit[0], file: f }; }
  const pj = readJson(path.join(dir, 'package.json')); if (pj && typeof pj.license === 'string') return { id: pj.license, file: 'package.json' };
  for (const [f, re] of [['Cargo.toml', /^license\s*=\s*"([^"]+)"/m], ['pyproject.toml', /^license\s*=\s*(?:\{\s*text\s*=\s*)?"([^"]+)"/m]]) {
    let t = null; try { t = fs.readFileSync(path.join(dir, f), 'utf8'); } catch { } const m = t && t.match(re); if (m) return { id: m[1], file: f }; }
  return { id: files.length ? 'unknown' : 'none', file: files[0] || null };
}
const projectLicense = (proj = project()) => proj.license || (readJson(path.join(ROOT, 'package.json')) || {}).license || (d => d.file ? d.id : null)(detectLicense(ROOT));
function credits(proj = project()) {   // rows of docs/credits.md and what GATE 2 objects to
  const f = docPath('credits.md', proj), t = readRel(f), rows = [], problems = [];
  if (t == null) return { file: f, rows, problems };
  for (const line of t.replace(/<!--[\s\S]*?-->/g, '').split('\n')) {
    if (!/^\s*\|/.test(line) || /^\s*\|\s*:?-{3}/.test(line)) continue;
    const [name, source, version, license, used] = line.split('|').slice(1, -1).map(x => x.trim());
    if (name && !/^project$/i.test(name)) rows.push({ name, source, version, license, used });
  }
  const own = projectLicense(proj);
  for (const r of rows) {
    const cls = licenseClass(r.license), noted = /\b(permission|checked):/i.test(r.used || '');
    if (!r.source || !/[/:.]/.test(r.source)) problems.push(`${f}: "${r.name}" has no source link`);
    if (!r.license) problems.push(`${f}: "${r.name}" has no license`);
    else if (['none', 'restricted', 'unknown'].includes(cls) && !noted) problems.push(`${f}: "${r.name}" is ${r.license}: ${REUSE_ADVICE[cls]}. Remove that code, or after the user agreed write "permission: <who granted it, where>" or "checked: <what it allows>" in its row`);
    else if (cls === 'strong' && licenseClass(own || '') !== 'strong' && !noted) problems.push(`${f}: "${r.name}" is ${r.license} but this project is ${own || 'not GPL-licensed'}: ${REUSE_ADVICE.strong} (then gw set license=<SPDX id>)`);
  }
  return { file: f, rows, problems };
}
function reuseCmd([url, nameArg]) {   // gw reuse <git-url> [name]: shallow clone to read or reuse, with its license
  const dir = P('reuse');
  if (!url) {
    const have = exists(dir) ? fs.readdirSync(dir) : [], c = credits();
    for (const n of have) { const l = detectLicense(path.join(dir, n)); console.log(`${n.padEnd(24)} ${l.id} (${licenseClass(l.id)})`); }
    console.log(`${have.length ? '' : 'No repos cloned yet (gw reuse <git-url>). '}Credited in ${c.file}: ${c.rows.length}${c.problems.length ? '\n  ' + c.problems.join('\n  ') : ''}`); return 0;
  }
  if (url.startsWith('-')) throw new Error('usage: gw reuse <git-url> [name]');
  let name = (nameArg || url.replace(/[/\\]+$/, '').replace(/\.git$/, '').split(/[/\\:]/).pop() || 'repo').replace(/[^\w.-]/g, '-');
  if (/^\.*$/.test(name)) name = 'repo';
  const dest = path.join(dir, name), rel = `.groundwork/reuse/${name}`;
  if (!exists(dest)) { fs.mkdirSync(dir, { recursive: true }); wireGitignore();
    const r = cp.spawnSync('git', ['clone', '--depth', '1', '--quiet', '--', url, dest], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('git clone failed: ' + (r.stderr || r.error || '').toString().trim()); }
  const commit = (cp.spawnSync('git', ['-C', dest, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout || '').trim() || '?';
  const lic = detectLicense(dest), cls = licenseClass(lic.id); fb('reuse-clone', { license: lic.id, class: cls });
  console.log(`Cloned to ${rel} (commit ${commit}; git-ignored, not part of the project).\nLicense: ${lic.id}${lic.file ? ' (' + lic.file + ')' : ''}: ${REUSE_ADVICE[cls]}${/Apache/i.test(lic.id) ? ', plus its NOTICE file, and mark your changes' : ''}.` +
    `\nUntrusted until reviewed: read it, but don't run its scripts, builds or installs before review (phases/P4.md). Copy only what the task needs.` +
    (['permissive', 'weak', 'strong'].includes(cls) ? `\nFor code you use from it, add a row to ${docPath('credits.md')} (templates/credits.md):\n| ${name} | ${url} | ${commit} | ${lic.id} | <what you used, and where it is now> |` : ''));
  return 0;
}

// ---------- delivery metrics (DORA-style outcomes instead of perceived speed) ----------
function metrics(proj = project()) {
  const all = runs(), ev = fbEvents();
  const per = loadTasks().list.map(t => { const r = all.filter(x => x.task === t.id);
    return { id: t.id, status: t.status, checks: r.length, failed: r.filter(x => x.exit !== 0).length, reopened: t.reopened || 0,
      minutes: t.started_at && t.done_at ? Math.round((Date.parse(t.done_at) - Date.parse(t.started_at)) / 6e4) : null }; });
  const done = per.filter(t => t.status === 'done'), mins = done.map(t => t.minutes).filter(x => x != null).sort((a, b) => a - b);
  const reopened = per.reduce((a, t) => a + t.reopened, 0);
  const reverts = (git('log', '--oneline', '-i', '--grep=^revert', ...(proj.created_at ? ['--since=' + proj.created_at] : [])) || '').split('\n').filter(Boolean).length;
  return { tasks: per.length, done: done.length, first_pass: done.filter(t => t.failed === 0).length, reopened, rework_rate: done.length ? +(reopened / done.length).toFixed(2) : null,
    failed_checks: per.reduce((a, t) => a + t.failed, 0), median_task_minutes: mins.length ? mins[Math.floor(mins.length / 2)] : null,
    release_runs: all.filter(r => !r.task).length, release_runs_failed: all.filter(r => !r.task && r.exit !== 0).length, reverts,
    circuit_breakers: ev.filter(e => e.kind === 'circuit-breaker').length, stop_blocks: ev.filter(e => e.kind === 'stop-blocked').length, per };
}

// ---------- wiring (shared by init and migrate) ----------
function wireGitignore() {
  const gi = path.join(ROOT, '.gitignore'), giLines = ['.groundwork/host-profile.json', '.groundwork/env-report.json', '.groundwork/runs/*/logs/', '.groundwork/feedback/', '.groundwork/FEEDBACK.md', '.groundwork/backups/', '.groundwork/cache/', '.groundwork/reuse/'];
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
  { to: '0.5.0', run: () => {   // tasks finished before checks were recorded stay done; G2 does not ask them for receipts
    const T = loadTasks(); let n = 0;
    for (const t of T.list) if (t.status === 'done' && !t.receipt && !t.legacy) { t.legacy = true; n++; }
    if (n) T.save();
  } },
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
  try { if (JSON.stringify((readJson(SETTINGS(), {}) || {}).hooks || {}).includes('gw.js') && JSON.stringify(readJson(SETTINGS(), {}).hooks).includes('hook session-start')) wireHooks(); } catch { }
  fs.appendFileSync(P('decisions.jsonl'), JSON.stringify({ at: now(), kind: 'framework-upgrade', from, to: VERSION }) + '\n');
  fb('upgrade', { from, to: VERSION });
  // finished phases whose instructions changed since the backed-up old folder (gw upgrade); manual copies have no backup
  const bdir = P('backups'), old = exists(bdir) ? fs.readdirSync(bdir).filter(d => d.startsWith(`groundwork-${from}-`)).sort().pop() : null;
  const recheck = old ? changedPhases(readJson(path.join(bdir, old, 'MANIFEST.json'), { files: {} }), readJson(path.join(FW, 'MANIFEST.json'), { files: {} }), state()) : [];
  if (recheck.length) { const st = state(); st.recheck = [...new Set([...(st.recheck || []), ...recheck])]; writeJson(P('state.json'), st); }
  const notes = changelogSince(from);
  if (!quiet) console.log(`Groundwork upgraded ${from} → ${VERSION}. State migrated.` + (notes ? '\n' + notes : '') +
    (recheck.length ? `\nPhases already done whose instructions changed: ${recheck.join(', ')}. Re-read those phase files, apply the new steps, then gw phase <id> done.` : ''));
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
  if (vcmp(newV, oldV) < 0 && exists(P('project.json'))) {   // rollback: the older CLI must accept the state, and re-upgrading re-runs newer migrations (they are idempotent)
    const p = project(); p.framework_version = newV; writeJson(P('project.json'), p);
    fs.appendFileSync(P('decisions.jsonl'), JSON.stringify({ at: now(), kind: 'framework-rollback', from: oldV, to: newV }) + '\n');
    console.log(`Rolled back to ${newV}. Project state is kept: newer fields stay and are ignored; newer hooks do nothing under ${newV}. Back to ${oldV}: gw upgrade ${path.relative(ROOT, backup)}`);
  }
  const r = cp.spawnSync(process.execPath, [path.join(FW, 'bin', 'gw.js'), 'migrate'], { stdio: 'inherit', cwd: ROOT, env: { ...process.env, GW_PROJECT_DIR: ROOT } });
  return r.status || 0;
}
// phases marked done (or skipped) whose phase file differs between two manifests
function changedPhases(oldM, newM, st) {
  return Object.keys(st.phases || {}).filter(id => ['done', 'skipped'].includes(st.phases[id].status))
    .filter(id => { const f = `phases/${id}.md`; return oldM.files[f] && newM.files[f] && oldM.files[f] !== newM.files[f]; });
}

// ---------- skill catalogue ----------
const curatedCatalog = () => readJson(path.join(FW, 'catalog', 'skills.json'), { sources: {}, skills: [] });
// curated (shipped) + this project's weekly trending discoveries (.groundwork/skills-discovered.json)
const catalog = () => { const c = curatedCatalog(), d = readJson(P('skills-discovered.json'), { skills: [] }); return { ...c, skills: [...c.skills, ...(d.skills || [])] }; };
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
  const src = s.repo ? { repo: s.repo, ref: s.ref, license: 'unknown (check)', license_file: null } : catalog().sources[s.source];
  const dir = P('cache', 'skills', (s.repo ? 'trending-' + s.repo.split('/').slice(-2).join('-') : s.source) + '-' + src.ref.slice(0, 12));
  const git = (...a) => { const r = cp.spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' }); if (r.status !== 0) throw new Error('git ' + a.join(' ') + ': ' + (r.stderr || '').trim()); return r.stdout; };
  if (!exists(path.join(dir, '.git'))) {
    fs.mkdirSync(dir, { recursive: true });
    git('init', '-q'); git('remote', 'add', 'origin', src.repo);
    git('sparse-checkout', 'set', '--no-cone', src.license_file ? '/' + src.license_file : '/LICENSE*', '/' + (s.path ? s.path + '/' : 'SKILL.md'));
    git('fetch', '-q', '--depth', '1', 'origin', src.ref); git('checkout', '-q', 'FETCH_HEAD');
  } else { git('sparse-checkout', 'add', '/' + (s.path ? s.path + '/' : 'SKILL.md')); }
  const skillDir = s.path ? path.join(dir, s.path) : dir;
  if (!exists(path.join(skillDir, 'SKILL.md'))) throw new Error('fetched, but ' + s.path + '/SKILL.md is missing at ' + src.ref);
  return { dir, skillDir, src };
}

// ---------- context-aware skill recommendations ----------
const PHASE_NAMES = Object.fromEntries(PHASES);
const STAGE_PLAYBOOK = { upgrade: 'UPGRADE', refactor: 'MAINTAIN', incident: 'OPERATE', security: 'SECURITY', feature: 'CHANGE', bugfix: 'CHANGE', migration: 'CHANGE' };
function currentTaskText() {
  const t = readJson(P('tasks.json'), []);
  const list = Array.isArray(t) ? t : (t.tasks || []);
  const cur = list.find(x => x.status === 'in_progress') || list.find(x => x.status === 'todo');
  return cur ? `${cur.title || ''} ${(cur.files || []).join(' ')}` : '';
}
function recommendSkills(proj, phase, text = '', { limit = 5, includeInstalled = false } = {}) {
  const targets = proj.targets || [], stacks = proj.stacks || {}, stackVals = Object.values(stacks);
  const playbook = STAGE_PLAYBOOK[proj.stage], declined = new Set((state().skills_declined || []).map(d => d.id));
  const words = String(text).toLowerCase();
  const out = [];
  for (const s of catalog().skills) {
    if (declined.has(s.id)) continue;
    const tHit = s.targets.includes('*') ? null : s.targets.filter(t => targets.includes(t));
    const sHit = s.stacks.includes('*') ? null : s.stacks.filter(x => stackVals.includes(x));
    if ((tHit && !tHit.length) || (sHit && !sHit.length)) continue;     // wrong platform/stack: never suggest
    if (s.tiers && proj.tier && !s.tiers.includes(proj.tier)) continue;   // e.g. a subagent per task only pays off at large
    const reasons = []; let score = 0;
    const kw = (s.keywords || []).filter(k => words && new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${k.length <= 4 ? '(?![a-z])' : ''}`).test(words));   // short keywords (ci, pr, ui) must be whole words
    if (kw.length) { score += 3 * kw.length; reasons.push(`task mentions "${kw.slice(0, 2).join('", "')}"`); }
    const ctx = proj.tier !== 'trivial';   // a one-line fix gets a skill only when the task names its topic
    if (ctx && phase && s.phases.includes(phase)) { score += 2; reasons.push(`used in ${phase} ${PHASE_NAMES[phase] || ''}`.trim()); }
    if (ctx && playbook && s.phases.includes(playbook)) { score += 2; reasons.push(`stage "${proj.stage}" uses the ${playbook} playbook`); }
    if (s.trending && s.text && words) {   // trending entries have no curated keywords: match task words against their description
      const STOP = new Set(['with', 'when', 'that', 'this', 'from', 'into', 'make', 'need', 'want', 'some', 'have', 'like', 'more', 'also', 'your', 'them', 'then', 'than', 'what', 'about', 'should', 'would', 'could', 'before', 'after', 'while', 'where', 'which', 'there', 'their', 'using', 'used', 'just', 'only', 'each', 'every', 'other', 'over', 'under', 'very', 'will', 'here', 'these', 'those', 'into', 'onto', 'upon']);
      const hit = [...new Set(words.split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !STOP.has(w)))].filter(w => new RegExp(`\\b${w}`).test(s.text)).slice(0, 2);
      if (hit.length && !kw.length) { score += 2 * hit.length; reasons.push(`task mentions "${hit.join('", "')}"`); }
    }
    if (s.trending && score) reasons.push(`trending #${s.trending.rank} on skills.sh this week (${s.trending.installs} installs), not reviewed`);
    if (!score) continue;                                                  // platform match alone is not a reason
    if (sHit) { score += 1; reasons.push(`stack ${sHit.join('/')}`); } else if (tHit) { score += 1; reasons.push(`target ${tHit.join('/')}`); }
    const installed = skillInstalled(s.name);
    if (installed && !includeInstalled) continue;
    out.push({ id: s.id, name: s.name, why: s.why, note: s.note, score, reasons, installed, trending: !!s.trending });
  }
  out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  if (!skillInstalled(INSPECTOR)) {   // required by Groundwork itself: always first while missing
    const ins = catalog().skills.find(x => x.id === INSPECTOR_ID);
    if (ins) { const i = out.findIndex(r => r.id === INSPECTOR_ID); if (i >= 0) out.splice(i, 1);
      out.unshift({ id: ins.id, name: ins.name, why: ins.why, score: 99, reasons: ['required by Groundwork to inspect every skill before install; install it first: ' + INSPECTOR_INSTALL], installed: false, trending: false }); }
  }
  const trend = out.filter(r => r.trending), cur = out.filter(r => !r.trending), slots = Math.min(trend.length, limit >= 5 ? 2 : 1);
  return [...cur.slice(0, limit - slots), ...trend.slice(0, slots)];
}
function recText(recs, header) {
  if (!recs.length) return '';
  return header + '\n' + recs.map(r => `  • ${r.id}: ${r.why}. Why now: ${r.reasons.join('; ')}.`).join('\n') +
    '\n  (Agent: offer these to the user once, with the reason. Fetch for review: gw skills fetch <id> · install: gw skills install <id> · declined: gw skills decline <id>)';
}

// ---------- weekly trending skill discovery (silent; machine cache + per-project fit) ----------
const HOME_GW = process.env.GW_HOME || path.join(os.homedir(), '.groundwork');
const gcfg = () => readJson(path.join(HOME_GW, 'config.json'), {});
const setGcfg = (k, v) => { const c = gcfg(); c[k] = v; writeJson(path.join(HOME_GW, 'config.json'), c); };
const TREND_URL = 'https://www.skills.sh/trending';
function parseTrending(html) {
  const t = String(html).replace(/\\"/g, '"'), re = /\{"source":"([^"]+)","skillId":"([^"]+)","name":"([^"]+)","installs":(\d+)/g;
  const out = [], seen = new Set(); let m;
  while ((m = re.exec(t))) { const k = m[1] + '/' + m[2]; if (seen.has(k)) continue; seen.add(k); out.push({ source: m[1], skillId: m[2], name: m[3], installs: +m[4], rank: out.length + 1 }); }
  return out;
}
// vocabulary → what a skill is about. dev:false entries never fit a software project.
const VOCAB = [
  [/\b(react|jsx|tsx)\b/, { targets: ['web', 'android', 'ios'], stacks: ['vite-react', 'nextjs', 'react-native'] }],
  [/\bnext\.?js\b|\bnextjs\b/, { targets: ['web'], stacks: ['nextjs'] }],
  [/\b(vue|nuxt|pinia)\b/, { targets: ['web'], stacks: ['vue'] }],
  [/\bsvelte/, { targets: ['web'], stacks: ['svelte'] }],
  [/\b(tailwind|css|frontend|front-end|web app|website|landing page|html|browser|vite)\b/, { targets: ['web'] }],
  [/\b(flutter|dart)\b/, { targets: ['android', 'ios'], stacks: ['flutter'] }],
  [/\b(mobile app|mobile apps|mobile ui)\b/, { targets: ['android', 'ios'] }],
  [/\b(react[- ]native|expo)\b/, { targets: ['android', 'ios'], stacks: ['react-native'] }],
  [/\b(android|kotlin|jetpack|compose|gradle)\b/, { targets: ['android'] }],
  [/\b(ios|swift|swiftui|xcode|uikit)\b/, { targets: ['ios', 'macos'], stacks: ['swiftui'] }],
  [/\b(macos|appkit)\b/, { targets: ['macos'] }],
  [/\b(electron)\b/, { targets: ['windows', 'macos', 'linux-desktop'], stacks: ['electron'] }],
  [/\b(tauri)\b/, { targets: ['windows', 'macos', 'linux-desktop'], stacks: ['tauri'] }],
  [/\b(wpf|winui|winforms|windows desktop)\b/, { targets: ['windows'], stacks: ['dotnet-wpf-winui'] }],
  [/\b(\.net|dotnet|c#|csharp|asp\.net)\b/, { targets: ['backend', 'windows'], stacks: ['dotnet', 'dotnet-wpf-winui'] }],
  [/\b(fastapi|django|flask|python|pytest|pydantic)\b/, { targets: ['backend', 'cli'], stacks: ['python'] }],
  [/\b(golang|go module|gin)\b/, { targets: ['backend', 'cli'], stacks: ['go'] }],
  [/\b(rust|cargo|tokio)\b/, { targets: ['cli', 'backend'], stacks: ['rust', 'tauri'] }],
  [/\b(spring|java|jvm)\b/, { targets: ['backend'], stacks: ['java-spring'] }],
  [/\b(node\.?js|express|nestjs|hono|fastify|bun|deno|prisma|drizzle|typeorm|sequelize)\b/, { targets: ['backend'], stacks: ['node'] }],
  [/\b(postgres|postgresql|mysql|sqlite|sql|supabase|database|schema|orm|redis|mongodb)\b/, { targets: ['backend'], phases: ['P5', 'P7'] }],
  [/\b(api|rest|graphql|openapi|endpoint|grpc)\b/, { targets: ['backend', 'web'], phases: ['P5'], weak: true }],
  [/\b(embedded|firmware|arduino|esp32|zephyr|stm32|microcontroller)\b/, { targets: ['embedded'] }],
  [/\b(cli|command[- ]line|terminal tool)\b/, { targets: ['cli'], weak: true }],
  [/\b(test|tests|testing|tdd|unit test|jest|vitest)\b/, { phases: ['P7', 'P8'] }],
  [/\b(e2e|end-to-end|playwright|cypress|selenium|appium|maestro)\b/, { phases: ['P8'] }],
  [/\b(code review|review|lint|refactor|clean code|simplif|tech debt|dead code)\b/, { phases: ['P9', 'MAINTAIN'] }],
  [/\b(security|vulnerab|owasp|secret|auth|authentication|oauth|jwt|pentest)\b/, { phases: ['P9', 'SECURITY'] }],
  [/\b(deploy|deployment|docker|kubernetes|k8s|ci\/cd|ci|github actions|pipeline|vercel|aws|azure|gcp|cloudflare|terraform)\b/, { phases: ['P10', 'OPERATE'] }],
  [/\b(monitor|observability|logging|tracing|metrics|sentry|incident)\b/, { phases: ['OPERATE'] }],
  [/\b(upgrade|migration|migrate|deprecat)\b/, { phases: ['UPGRADE'] }],
  [/\b(prd|spec|requirements|planning|architecture|design system|ux|ui design|accessibility|a11y)\b/, { phases: ['P1', 'P5', 'P6'] }],
  [/\b(debug|debugging|bug|error handling|performance|profil)\b/, { phases: ['P7', 'OPERATE'] }],
];
// cloud/vendor/framework-specific skills only fit projects that declared it (project.json "services", set in P2)
const VENDORS = { azure: /\b(azure|aks|app insights|appinsights|entra|microsoft foundry)\b/, aws: /\b(aws|amazon web services|lambda|dynamodb|bedrock)\b/,
  gcp: /\b(gcp|google cloud|vertex|adk|google agents?)\b/, firebase: /\bfirebase\b/, supabase: /\bsupabase\b/, vercel: /\bvercel\b/, netlify: /\bnetlify\b/,
  cloudflare: /\bcloudflare\b/, heroku: /\bheroku\b/, stripe: /\bstripe\b/, shopify: /\bshopify\b/, salesforce: /\bsalesforce\b/, twilio: /\btwilio\b/,
neon: /\bneon\b/, planetscale: /\bplanetscale\b/, turso: /\bturso\b/, railway: /\brailway\b/, render: /\brender\.com\b/,
  remotion: /\bremotion\b/, runcomfy: /\brun ?comfy\b/, heygen: /\bheygen\b/, uizze: /\buizze\b/ };
// content-generation / marketing skills are not software-development skills
const NONDEV = /\b(music|song|video generation|video edit\w*|image generation|ai image|ai video|avatar|photo edit\w*|tweet|twitter|reddit|linkedin|instagram|tiktok|youtube|podcast|voice clon\w*|marketing|seo|social media|newsletter|copywriting|trading)\b/;
// skills for evading detection or abusing services are never recommended
const RISKY = /\b(anti ?detect|fingerprint spoof\w*|real device fingerprint|captcha (solv|bypass)\w*|evade (bot )?detection|undetectable|bot farm|account farm|multi account isolation|mass (dm|messaging))\b/;
function classifySkill(text, name = '', source = '') {
  const s = String(text).toLowerCase().replace(/[-_]/g, ' '), n = String(name).toLowerCase().replace(/[-_]/g, ' '), src = String(source).toLowerCase();
  const head = n + ' ' + s.split(/(?<=\.)\s/)[0];                     // name + first sentence: what the skill is *about*
  const c = { targets: new Set(), stacks: new Set(), phases: new Set(), keywords: [], vendors: new Set(), strong: false };
  for (const [v, re] of Object.entries(VENDORS)) if (re.test(head)) c.vendors.add(v);
  for (const [re, v] of VOCAB) { const m = s.match(re); if (!m) continue;
    const platform = !!(v.targets || v.stacks) && !v.weak;
    if (!platform && !re.test(n)) continue;                            // phase words only count when they are in the skill's name
    if (platform) c.strong = true; else c.strong = c.strong || re.test(n);
    (v.targets || []).forEach(x => c.targets.add(x)); (v.stacks || []).forEach(x => c.stacks.add(x)); (v.phases || []).forEach(x => c.phases.add(x));
    if (!c.keywords.includes(m[0])) c.keywords.push(m[0]); }
  c.risky = RISKY.test(n + ' ' + s);
  c.dev = c.strong && !NONDEV.test(head) && !/(marketing|seo|growth|social|content)/.test(src) && !c.risky;   // repo names: plain substring ("marketingskills")
  return c;
}
function fitsProject(c, proj) {
  if (!c.dev) return false;
  const targets = proj.targets || [], stacks = Object.values(proj.stacks || {}), services = (proj.services || []).map(x => String(x).toLowerCase());
  if (c.vendors.size && ![...c.vendors].some(v => services.includes(v))) return false;
  if (c.targets.size && targets.length && ![...c.targets].some(t => targets.includes(t))) return false;
  if (c.stacks.size && stacks.length && ![...c.stacks].some(t => stacks.includes(t))) return false;   // tied to a stack this project doesn't use
  return c.targets.size > 0 || c.phases.size > 0;
}
async function fetchText(url, ms = 8000) { const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { 'user-agent': 'groundwork-cli' } }); if (!r.ok) throw new Error(url + ' → ' + r.status); return r.text(); }
async function skillDescription(source, id) {
  for (const p of [`skills/${id}/SKILL.md`, `${id}/SKILL.md`, `.claude/skills/${id}/SKILL.md`, `plugins/${id}/SKILL.md`, 'SKILL.md']) {
    let t; try { t = await fetchText(`https://raw.githubusercontent.com/${source}/HEAD/${p}`); } catch { continue; }
    const fm = (t.match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
    const name = ((fm.match(/^name:\s*(.+)$/m) || [])[1] || '').trim().replace(/^["']|["']$/g, '');
    let desc = ((fm.match(/^description:\s*(.+)$/m) || [])[1] || '').trim().replace(/^["'>|-]+\s*|["']$/g, '');
    if (!desc) desc = ((fm.match(/^description:\s*[>|]-?\s*\n((?:\s+.+\n?)+)/m) || [])[1] || '').replace(/\s+/g, ' ').trim();
    if (p === 'SKILL.md' && name && name !== id) continue;
    return { path: p.replace(/\/?SKILL\.md$/, ''), description: desc };
  }
  return null;
}
function isLookalike(source) {   // same repo name as a curated source but a different owner → possible impersonation
  const [owner, repo] = source.toLowerCase().split('/');
  const GENERIC = new Set(['skills', 'agent-skills', 'claude-skills', 'ai-skills', 'agents', 'awesome-skills', 'claude-code-skills']);   // common names, not impersonation
  if (GENERIC.has(repo)) return false;
  return Object.values(curatedCatalog().sources).some(s => { const [o, r] = s.repo.toLowerCase().replace('https://github.com/', '').split('/'); return r === repo && o !== owner; });
}
function refreshDue() {
  const cfg = gcfg(); if (cfg.trending === false) return false;
  const tr = readJson(path.join(HOME_GW, 'trending.json')), last = tr ? Date.parse(tr.fetched_at) : 0;
  let dueAt = Date.now() - 7 * 864e5;
  if (cfg.refresh_weekday != null) {             // weekly usage-reset day: due once that weekday has passed since the last refresh
    const d = new Date(); d.setHours(0, 0, 0, 0); while (d.getDay() !== cfg.refresh_weekday) d.setDate(d.getDate() - 1); dueAt = d.getTime();
  }
  if (last < dueAt) return true;
  const disc = readJson(P('skills-discovered.json'));
  return exists(P('project.json')) && (!disc || disc.from !== tr.fetched_at);
}
function maybeRefreshInBackground() {
  try {
    if (!refreshDue()) return;
    const lock = path.join(HOME_GW, 'refresh.lock');
    if (exists(lock) && Date.now() - fs.statSync(lock).mtimeMs < 3600e3) return;
    fs.mkdirSync(HOME_GW, { recursive: true }); fs.writeFileSync(lock, now());
    cp.spawn(process.execPath, [__filename, 'skills', 'refresh', '--quiet'], { detached: true, stdio: 'ignore', cwd: ROOT, env: { ...process.env, GW_PROJECT_DIR: ROOT } }).unref();
  } catch { /* never disturb the session */ }
}
async function refreshTrending({ quiet = false, force = false } = {}) {
  const log = m => { if (!quiet) console.log(m); };
  let tr = readJson(path.join(HOME_GW, 'trending.json'));
  const stale = !tr || Date.now() - Date.parse(tr.fetched_at) > 6 * 864e5;
  if (force || stale || (gcfg().refresh_weekday != null && refreshDue())) {
    const list = parseTrending(await fetchText(TREND_URL, 15000));
    if (list.length < 10) throw new Error('trending page format changed (parsed ' + list.length + ' skills)');
    tr = { fetched_at: now(), url: TREND_URL, skills: list };
    writeJson(path.join(HOME_GW, 'trending.json'), tr);
    log(`Fetched ${list.length} trending skills from skills.sh.`);
  }
  if (!exists(P('project.json'))) return null;
  const proj = project(), curatedNames = new Set(curatedCatalog().skills.map(s => s.name));
  const declined = new Set((state().skills_declined || []).map(d => d.id));
  const picked = [], skipped = { lookalike: [], nofit: 0, nodesc: 0, unpinned: 0 };
  const cands = [];
  for (const t of tr.skills) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(t.source) || curatedNames.has(t.skillId) || declined.has(`trending/${t.source}/${t.skillId}`)) continue;
    if (isLookalike(t.source)) { skipped.lookalike.push(`${t.source}/${t.skillId}`); continue; }
    if (!classifySkill(t.skillId).dev && t.rank > 300) continue;           // deep in the list and not obviously dev: skip the fetch
    cands.push(t);
  }
  // pin without the GitHub API (no rate limit): git ls-remote
  const headRef = source => { const r = cp.spawnSync('git', ['ls-remote', `https://github.com/${source}`, 'HEAD'], { encoding: 'utf8', timeout: 15000 }); const m = (r.stdout || '').match(/^([0-9a-f]{40})\s+HEAD/m); return m ? m[1] : null; };
  for (let i = 0; i < cands.length && picked.length < 10; i += 8) {            // 8 descriptions in parallel, results kept in rank order
    const batch = cands.slice(i, i + 8), descs = await Promise.all(batch.map(t => skillDescription(t.source, t.skillId).catch(() => null)));
    for (let j = 0; j < batch.length && picked.length < 10; j++) {
      const t = batch[j], d = descs[j];
      if (!d) { skipped.nodesc++; continue; }
      const c = classifySkill(t.skillId + ' ' + d.description, t.skillId, t.source);
      if (c.risky) { (skipped.risky = skipped.risky || []).push(`${t.source}/${t.skillId}`); continue; }
      if (!fitsProject(c, proj)) { skipped.nofit++; continue; }
      if (picked.filter(x => x.repo.endsWith('/' + t.source)).length >= 3) { skipped.nofit++; continue; }   // diversity: max 3 per repo
      const ref = picked.find(x => x.repo.endsWith('/' + t.source))?.ref || headRef(t.source);
      if (!ref) { skipped.unpinned++; continue; }                                                           // install must be pinned
      picked.push({ id: `trending/${t.source}/${t.skillId}`, source: 'trending', repo: `https://github.com/${t.source}`, ref, path: d.path, name: t.skillId,
        why: (d.description || t.name).split(/(?<=\.)\s/)[0].slice(0, 120), phases: [...c.phases], targets: c.targets.size ? [...c.targets] : ['*'],
        stacks: c.stacks.size ? [...c.stacks] : ['*'], keywords: c.keywords, text: (t.skillId + ' ' + (d.description || '')).toLowerCase().slice(0, 400),
        trending: { rank: t.rank, installs: t.installs, week_of: tr.fetched_at.slice(0, 10) },
        note: Object.values(curatedCatalog().sources).some(x => x.repo.toLowerCase() === `https://github.com/${t.source}`.toLowerCase()) ? 'trending, from a source already in the curated catalogue; still read it before installing' : 'trending, not reviewed: third-party; fetch and read it before installing' });
    }
  }
  writeJson(P('skills-discovered.json'), { refreshed_at: now(), from: tr.fetched_at, project_targets: proj.targets || [], skills: picked, skipped });
  { const seen = new Set(fbEvents().filter(e => e.kind === 'trending-lookalike').flatMap(e => e.repos || []));
    const repos = [...new Set(skipped.lookalike.map(x => x.split('/').slice(0, 2).join('/')))].filter(r => !seen.has(r));
    if (repos.length) fb('trending-lookalike', { repos, skills: skipped.lookalike.length }); }
  log(`Kept ${picked.length} trending skills that fit this project (skipped: ${skipped.lookalike.length} lookalikes of known sources, ${skipped.nofit} not fitting, ${skipped.nodesc} unreadable).`);
  return picked;
}

// ---------- skill inspection (skill-inspector + SkillSpector) ----------
const INSPECTOR = 'skill-inspector', INSPECTOR_ID = 'skillspector/skill-inspector';
const INSPECTOR_INSTALL = `gw skills install ${INSPECTOR_ID} --global`;
function inspectorStatus() {
  // one command string, not args + shell (Node 26 warns on that, DEP0190); the shell finds skillspector.cmd on Windows
  const r = process.platform === 'win32' ? cp.spawnSync('skillspector --version', { encoding: 'utf8', shell: true }) : cp.spawnSync('skillspector', ['--version'], { encoding: 'utf8' });
  return { skill: skillInstalled(INSPECTOR), cli: !r.error && r.status === 0 };
}
const reviews = () => readJson(P('skills-reviews.json'), {});
const skillRef = s => s.repo ? s.ref : (catalog().sources[s.source] || {}).ref;
// decides whether `gw skills install` may proceed for a fetched skill
function installGate(review, ref, args = [], s = {}) {
  if (s.role === 'inspector' && s.source === 'skillspector') return { ok: true, bootstrap: true, msg: 'bootstrap install of the inspector from its pinned official source' };
  if (review && review.verdict === 'REJECT') {   // the user decides, after seeing why
    const o = args.indexOf('--override-reject'), words = o >= 0 ? args[o + 1] : null;
    if (review.ref === ref && words && !words.startsWith('--')) return { ok: true, overridden: true, msg: `installed despite REJECT, user decision: "${words}"` };
    return { ok: false, rejected: true, msg: `skill-inspector verdict REJECT: ${review.summary || '(no reason recorded)'}` + (review.report ? ` · full report: ${review.report}` : '') +
      `\n  Show the user these reasons. Only if they decide to install anyway: gw skills install <id> --override-reject "<the user's words>"` };
  }
  const skip = args.indexOf('--skip-inspection'), skipReason = skip >= 0 ? args[skip + 1] : null;
  if (skipReason && !skipReason.startsWith('--')) return { ok: true, skipped: true, msg: 'inspection skipped: ' + skipReason };
  if (!review) return { ok: false, msg: 'not inspected yet' };
  if (review.ref !== ref) return { ok: false, msg: `inspected at ${String(review.ref).slice(0, 12)}, but the catalogue now pins ${String(ref).slice(0, 12)}: inspect again` };
  if (review.verdict === 'CAUTION' && !args.includes('--accept-caution')) return { ok: false, msg: 'verdict CAUTION: show the user the guardrails, and on their approval re-run with --accept-caution' };
  return { ok: true, msg: 'verdict ' + review.verdict };
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
const SETTINGS = () => path.join(ROOT, '.claude', 'settings.json');
function wireHooks() {
  const sf = SETTINGS(), s = readJson(sf, {});
  if (exists(sf) && !readJson(sf)) throw new Error('.claude/settings.json is not valid JSON; fix it or pass --no-hooks');
  s.hooks = s.hooks || {};
  const addHook = (ev, matcher, sub) => {
    s.hooks[ev] = s.hooks[ev] || [];
    if (JSON.stringify(s.hooks[ev]).includes('groundwork/bin/gw.js')) return;
    s.hooks[ev].push({ ...(matcher ? { matcher } : {}), hooks: [{ type: 'command', command: `${HOOK_CMD} ${sub}` }] });
  };
  addHook('SessionStart', null, 'session-start');
  addHook('PreToolUse', 'Edit|Write|MultiEdit|NotebookEdit', 'pre-edit');
  addHook('UserPromptSubmit', null, 'prompt');   // spots "learn X" / "app like X" and points the agent at RESEARCH.md
  addHook('Stop', null, 'stop');                 // a task in progress must pass its check before the agent reports done
  writeJson(sf, s);
}
// ---------- CI workflows and dev containers, from pack data (templates/ci, packs/devcontainers.json) ----------
const RUNNERS = { linux: 'ubuntu-latest', ubuntu: 'ubuntu-latest', windows: 'windows-latest', macos: 'macos-latest', mac: 'macos-latest' };
const CI_DIR = path.join(FW, 'templates', 'ci');
function ciFragment(id, seen = []) {   // a steps file: "# about", "# verified: …", "# timeout: …", then step lines; __INCLUDE x__ inlines another fragment
  const f = path.join(CI_DIR, 'steps', id + '.yml');
  if (!/^[\w-]+$/.test(id) || !exists(f)) throw new Error(`no CI fragment templates/ci/steps/${id}.yml`);
  if (seen.includes(id)) throw new Error('CI fragment include loop: ' + [...seen, id].join(' → '));
  const meta = { id, about: '', verified: 'no', timeout: '30' }, body = [];
  for (const l of fs.readFileSync(f, 'utf8').replace(/\r/g, '').split('\n')) {
    const m = !body.length && l.match(/^# (verified|timeout): (.*)$/), inc = l.match(/^__INCLUDE ([\w-]+)__$/);
    if (m) meta[m[1]] = m[2].trim(); else if (!body.length && l.startsWith('# ')) meta.about = l.slice(2); else if (inc) body.push(...ciFragment(inc[1], [...seen, id]).body); else if (l.trim() || body.length) body.push(l);
  }
  while (body.length && !body[body.length - 1].trim()) body.pop();
  return { ...meta, body };
}
function gitTop() {   // the repository root and this project's folder in it: workflows live at the root even in a monorepo
  // --show-prefix, not a path.relative of two absolute paths: those can differ in spelling (Windows 8.3 names, symlinks)
  const r = cp.spawnSync('git', ['rev-parse', '--show-prefix'], { cwd: ROOT, encoding: 'utf8' });
  const dir = r.status === 0 ? r.stdout.trim().replace(/\/$/, '') : '';
  return { top: dir ? path.resolve(ROOT, ...dir.split('/').map(() => '..')) : ROOT, dir: dir || '.' };
}
function ciPlan(proj, targets, osArg) {
  const all = packs(), { top, dir } = gitTop();
  const prefix = dir === '.' ? 'gw-' : `gw-${dir.replace(/[^\w.-]+/g, '-')}-`;
  osArg = osArg || proj.ci_os;
  return (targets.length ? targets : proj.targets || []).map(t => {
    const pk = all[t]; if (!pk) throw new Error(`unknown target ${t}. Known targets: ${Object.keys(all).join(', ')}`);
    const stack = (proj.stacks || {})[t], st = (pk.stacks || {})[stack], out = `.github/workflows/${prefix}${t}.yml`, base = { target: t, stack: stack || null, out, top, dir };
    if (!stack || !st) return { ...base, why: `set the stack first: gw set stacks.${t}=<${Object.keys(pk.stacks || {}).join('|')}>` };
    if (!st.ci) return { ...base, why: `no ready-made workflow for ${stack}: ${(pk.sandbox.S3 || {}).how || 'write one from the pack notes'}` };
    let os = st.ci_os || (pk.ci || {}).os || ['ubuntu-latest'];   // a stack can narrow its pack's runners (KMP web tests run in headless Chrome only)
    if (osArg) {
      const want = [...new Set(String(osArg).split(',').map(x => RUNNERS[x.trim().toLowerCase()] || x.trim()))].filter(r => os.includes(r) || !proj.ci_os || osArg !== proj.ci_os);
      const bad = want.filter(r => !os.includes(r));
      if (bad.length) throw new Error(`${t} CI runs on ${os.join(', ')}; --os ${bad.join(',')} is not one of them`);
      if (want.length) os = want;   // a project-wide ci_os only narrows the packs it overlaps
    }
    return { ...base, fragment: st.ci, os, services: (pk.ci || {}).services || null, vars: (pk.ci || {}).vars || {} };
  });
}
function gitDefaultBranch(top) {
  const r = cp.spawnSync('git', ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], { cwd: top || ROOT, encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim().replace(/^origin\//, '') : 'main';
}
function ciRender(e) {
  const fr = ciFragment(e.fragment), sub = e.dir && e.dir !== '.';
  const services = e.services ? fs.readFileSync(path.join(CI_DIR, 'services', e.services + '.yml'), 'utf8').replace(/\r/g, '').trimEnd() : '';
  const untested = fr.verified === 'no' ? [] : e.os.filter(o => !fr.verified.split(/[\s,]+/).includes(o));   // runners this workflow uses that the fragment hasn't been proven on
  const verified = fr.verified === 'no' ? 'Not yet verified by Groundwork on a real runner: watch the first run.'
    : `Verified by Groundwork on real runners: ${fr.verified}${untested.length ? `. Not yet on ${untested.join(', ')}: watch the first run there.` : ''}`;
  let y = fs.readFileSync(path.join(CI_DIR, 'workflow.yml'), 'utf8').replace(/\r/g, '');
  const vals = { VERSION: VERSION, TARGET: e.target, STACK: e.stack, FRAGMENT: fr.id, VERIFIED: verified, NAME: JSON.stringify(`${sub ? e.dir + ' · ' : ''}${e.target} (${e.stack})`), BRANCH: gitDefaultBranch(e.top),
    OS: '[' + e.os.join(', ') + ']', TIMEOUT: fr.timeout, SERVICES: services, STEPS: fr.body.join('\n'), DIR: sub ? e.dir + '/' : '', WORKDIR: sub ? JSON.stringify(e.dir) : '.' };
  y = y.replace(/^__SERVICES__\n/m, services ? '__SERVICES__\n' : '');
  if (sub) {   // a subfolder project: run there, and only when it (or this workflow) changes
    const paths = `    paths: ${JSON.stringify([e.dir + '/**', e.out]).replace(/,/g, ', ')}\n`;
    y = y.replace(/^(    branches: \[.*\]\n)/m, '$1' + paths).replace(/^(  pull_request:\n)/m, '$1' + paths)
      .replace(/^(    timeout-minutes: .*\n)/m, `$1    defaults:\n      run:\n        working-directory: ${JSON.stringify(e.dir)}\n`);
  }
  for (const [k, v] of Object.entries({ ...vals, ...e.vars })) y = y.split(`__${k}__`).join(v);
  const left = y.match(/__[A-Za-z][\w]*__/);
  if (left) throw new Error(`CI template for ${e.target}/${e.stack} needs ${left[0]}: add it to packs/${e.target}.json ci.vars`);
  return { yaml: y, verified: fr.verified, untested, about: Object.entries(e.vars).reduce((a, [k, v]) => a.split(`__${k}__`).join(v), fr.about) };
}
function ciCmd(args) {
  const [sub = 'list', ...rest] = args, osArg = flag(rest, '--os'), force = rest.includes('--force');
  const names = rest.filter((a, i) => !a.startsWith('--') && rest[i - 1] !== '--os');
  if (!['list', 'write', 'print'].includes(sub)) throw new Error('usage: gw ci [list] | ci print <target> [--os linux,windows,macos] | ci write [target...] [--os …] [--force]');
  const plan = ciPlan(project(), names, osArg);
  if (!plan.length) throw new Error('no targets yet: gw set targets=<…> (and stacks.<target>=<stack>)');
  if (sub === 'print') { for (const e of plan) { if (!e.fragment) throw new Error(e.why); process.stdout.write(ciRender(e).yaml); } return 0; }
  for (const e of plan) {
    if (!e.fragment) { console.log(`- ${e.target}: ${e.why}`); continue; }
    const r = ciRender(e), file = path.join(e.top, e.out), there = exists(file);
    const label = `${e.target} (${e.stack}) → ${e.out}${e.dir !== '.' ? ' (repo root, runs in ' + e.dir + ')' : ''} · ${e.os.join(', ')} · ${r.verified === 'no' ? 'not yet verified on a runner' : 'verified ' + r.verified + (r.untested.length ? ` (not yet on ${r.untested.join(', ')})` : '')}`;
    if (sub === 'list') { console.log(`- ${label}${there ? ' · written' : ''}\n    ${r.about}`); continue; }
    if (there && !force) { console.log(`- ${e.target}: ${e.out} exists, kept (your edits win; --force replaces it)`); continue; }
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, r.yaml);
    fb('ci-write', { target: e.target, stack: e.stack, fragment: e.fragment, verified: r.verified });
    console.log(`- wrote ${label}`);
  }
  if (sub === 'write') console.log('Next: commit, push a branch, then record the run: gw run <target> S3 -- gh run watch <run-id> --exit-status');
  else console.log('Write them: gw ci write [target...] [--os linux,windows,macos]  (or once for all: gw set ci_os=linux,windows)');
  return 0;
}
const presets = () => { const { _doc, ...p } = { ...readJson(path.join(FW, 'packs', 'presets.json'), {}), ...readJson(P('presets.json'), {}) }; return p; };
const presetsFor = targets => Object.entries(presets()).filter(([, pr]) => targets.every(t => pr.targets[t]));   // presets that cover every one of these targets
const dcBlocks = () => readJson(path.join(FW, 'packs', 'devcontainers.json'), {});
function devcontainerPlan(proj) {
  const all = packs(), B = dcBlocks(), ids = [], skipped = [];
  for (const t of proj.targets || []) {
    const pk = all[t], stack = (proj.stacks || {})[t], st = pk && (pk.stacks || {})[stack];
    if (!st) { skipped.push(`${t}: set the stack first (gw set stacks.${t}=<…>)`); continue; }
    if (!(st.devcontainer || []).length) { skipped.push(`${t} (${stack}): develops on the host${pk.host_only ? ' (' + pk.host_only.join('/') + ' only)' : ''}; tests at ${pk.min_release_tier} via ${(pk.sandbox.S3 || {}).how || 'the pack notes'}`); continue; }
    for (const id of st.devcontainer) { if (!B[id]) throw new Error(`packs/devcontainers.json has no block "${id}" (stack ${t}/${stack})`); if (!ids.includes(id)) ids.push(id); }
  }
  const dc = { name: proj.name || path.basename(ROOT), image: (ids.map(i => B[i]).find(b => b.image) || B.base).image, features: {} };
  const ports = [], ext = [], env = {}, pth = [], post = [], notes = [], checks = [];
  for (const id of ids) { const b = B[id];
    for (const [k, v] of Object.entries(b.features || {})) if (!(k in dc.features)) dc.features[k] = v;
    for (const x of b.ports || []) if (!ports.includes(x)) ports.push(x);
    for (const x of b.extensions || []) if (!ext.includes(x)) ext.push(x);
    Object.assign(env, b.env || {}); pth.push(...(b.path || []));
    if (b.post) post.push(b.post); if (b.note) notes.push(b.note); if (b.check) checks.push({ block: id, cmd: b.check }); }
  if (!Object.keys(dc.features).length) delete dc.features;
  if (ports.length) dc.forwardPorts = ports;
  if (Object.keys(env).length) dc.containerEnv = env;
  if (pth.length) dc.remoteEnv = { PATH: '${containerEnv:PATH}:' + pth.join(':') };
  if (post.length) dc.postCreateCommand = post.join(' && ');
  if (ext.length) dc.customizations = { vscode: { extensions: ext } };
  return { ids, dc, skipped, notes, checks };
}
function devcontainerCmd(args) {
  const r = devcontainerPlan(project()), file = path.join(ROOT, '.devcontainer', 'devcontainer.json');
  for (const s of r.skipped) console.log('- ' + s);
  if (!r.ids.length) { console.log('No container setup for these targets.'); return 0; }
  const text = `// Generated by Groundwork ${VERSION} (gw devcontainer) from packs/devcontainers.json: ${r.ids.join(', ')}. Edit freely; gw devcontainer keeps it unless --force.\n` + JSON.stringify(r.dc, null, 2) + '\n';
  if (args.includes('--print')) { process.stdout.write(text); return 0; }
  if (exists(file) && !args.includes('--force')) { console.log('.devcontainer/devcontainer.json exists, kept (your edits win; --force replaces it)'); return 0; }
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); fb('devcontainer-write', { blocks: r.ids });
  console.log(`Wrote .devcontainer/devcontainer.json (${r.dc.image}; ${r.ids.join(', ')})`);
  for (const n of r.notes) console.log('  note: ' + n);
  console.log(`Check inside it: ${r.checks.map(c => c.cmd).join(' ; ')}\nOpen it in VS Code (Dev Containers) or: npx --yes @devcontainers/cli@0.89.0 up --workspace-folder .\nTest in it (S1): gw run <target> S1 -- npx --yes @devcontainers/cli@0.89.0 exec --workspace-folder . <test command>`);
  return 0;
}

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
  if (profile !== 'minimal' && !args.includes('--no-hooks')) wireHooks();
  const p = project(); p.profile = profile; p.framework_version = VERSION; writeJson(P('project.json'), p);
  const r = doctor(hostProfile({ fresh: true }), project());
  const st = state(); st.phases.H0 = { status: 'done', at: now() }; writeJson(P('state.json'), st);
  return r;
}

// ---------- hooks ----------
// does a user message point at a reference app to learn from? (English + Indonesian; the agent makes the final call)
const APPWORD = String.raw`(app|apps|application|aplikasi|apk|site|website|web|situs|bot|game|tool|platform|extension|plugin|software|program)`;
const REF_PATTERNS = [
  /\b(learn|study|research|analy[sz]e|investigate)\b.{0,30}\b(how|from|what|why|the way|cara)\b|\breverse[- ]?engineer|\b(look into|figure out|find out) how\b/,
  /\b(pelajari|pelajarin|mempelajari|belajar dari|teliti|meneliti|analisa|analisis|bedah|tiru|niru|meniru|contek|nyontek|cari tahu cara)\b/,
  /\b(clone of|copy of|inspired by|modell?ed on)\b/,
  new RegExp(String.raw`\b(like|similar to|same as|based on|seperti|mirip|kayak|kaya|ala|sejenis)\b.{0,40}\b${APPWORD}\b|\b${APPWORD}\b.{0,30}\b(like|similar to|same as|seperti|mirip|kayak|kaya|ala|sejenis)\b`),
  /\b(for|as) (a )?reference\b|\breferen(ce|si|sinya)\b|\bacuan\b|\bcontoh(nya)? (dari|aplikasi|app|web)\b|\bpatokan\b/,
];
function referenceIntent(text) {
  const raw = String(text || ''), t = raw.toLowerCase().replace(/\b(would|'d|looks|look|seems|seem|feels|feel|sounds) like\b/g, '')
    .replace(/\b(like|seperti|kayak) (this|that|it|before|so|usual|normal|biasa|sebelumnya|ini|itu)\b/g, '');
  return REF_PATTERNS.some(r => r.test(t)) || /\b(learn|study|analy[sz]e|research)\s+[A-Z][\w.-]+/.test(raw);   // "learn Splitwise": a proper name
}
const mockupIntent = text => /\b(mock-?ups?|wireframes?|prototypes?|figma|ui\s*\/\s*ux|desain (ui|aplikasi|tampilan)|tampilan(nya)? (aplikasi|app|layar)|lihat tampilan|visual(isasi)? (aplikasi|app)|see (how it|what it) looks?|how (will|would) (it|the app) look)\b/i.test(String(text || ''));
function hook(sub) {
  const p = project(); if (!exists(P('project.json'))) return 0;   // not initialised: stay silent
  if (sub === 'session-start') {
    try { migrate(); } catch (e) { console.log('Groundwork: migration failed: ' + e.message); }
    maybeRefreshInBackground();   // weekly, silent, detached
    if (!skillInstalled(INSPECTOR)) console.log(`Groundwork: the ${INSPECTOR} skill is not installed on this machine. Groundwork uses it to vet every skill before install. Suggest installing it first: ${INSPECTOR_INSTALL}`);
    const integ = integrity();
    if (integ.stale.length || integ.missing.length) console.log(`Groundwork: framework folder has ${integ.stale.length} leftover and ${integ.missing.length} missing file(s) vs its manifest (copied over an old version?). Run: gw verify --clean`);
    const h = readJson(P('host-profile.json'));
    if (hostChanged(h)) { try { doctor(scan(), p); fb('host-rescan', { reason: h ? 'host changed or scan stale' : 'first scan' }); console.log('Groundwork: host changed or scan older than 7 days, re-scanned.'); } catch (e) { console.log('Groundwork: re-scan failed: ' + e.message); } }
    console.log(statusText());
    try { const t = recText(recommendSkills(p, nextStep().phase, currentTaskText(), { limit: 3 }).filter(r => r.id !== INSPECTOR_ID), 'Groundwork skill suggestions for the current phase/task:'); if (t) console.log(t); } catch { }   // inspector already has its own banner
    return 0;
  }
  if (sub === 'prompt') {   // UserPromptSubmit: stdout becomes context for the agent
    let input = {}; try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { }
    if (referenceIntent(input.prompt)) console.log('Groundwork: this message may point at a reference app or site to learn from. If it does, follow groundwork/phases/RESEARCH.md: ' +
      'make the goal clear first (ask if it is vague), record it with gw research "<name>" "<goal>", recommend the depth the goal needs, and escalate to the next method if the goal is not met. If it does not, ignore this note.');
    if (mockupIntent(input.prompt)) console.log('Groundwork: this message asks to see the design. Follow groundwork/phases/MOCKUP.md: offer Figma (if connected) or an HTML clickable prototype, cover every screen state, and record the user\'s approval in docs/dbd.md.');
    return 0;
  }
  if (sub === 'pre-edit') {
    // incidents and security fixes are emergencies: their playbooks (OPERATE/SECURITY) replace GATE 1
    if (p.profile === 'minimal' || !['standard', 'large'].includes(p.tier) || ['incident', 'security'].includes(p.stage) || exists(P('gates', 'G1.json'))) return 0;
    let input = {}; try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { }
    const f = path.relative(ROOT, (input.tool_input || {}).file_path || (input.tool_input || {}).notebook_path || '').split(path.sep).join('/');
    const allowed = /^(docs\/|\.groundwork\/|groundwork\/|\.claude\/|tests?\/|spec\/|__tests__\/)|(\.md|\.test\.[a-z]+|_test\.[a-z]+|\.spec\.[a-z]+)$|^(CLAUDE|AGENTS|README|CONSTRAINTS)/i;
    const docDirs = [p.docs_dir, ...Object.values(p.docs || {}).map(d => path.posix.dirname(d))].filter(d => d && d !== '.');
    if (!f || f.startsWith('..') || allowed.test(f) || docDirs.some(d => f.startsWith(d.replace(/\/?$/, '/')))) return 0;
    process.stderr.write(`Groundwork: GATE 1 (plan approval) is not approved yet for this ${p.tier} project, so source edits are blocked.\n` +
      `Allowed now: docs/, tests, .groundwork/. Next: finish groundwork/phases/P6.md, then gw gate G1 --approve "<user's words>".\n`);
    fb('edit-blocked', { file: f });
    return 2;
  }
  if (sub === 'stop') {   // Stop: exit 2 sends stderr back to the agent and it keeps working
    let input = {}; try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { }
    if (input.stop_hook_active || p.profile === 'minimal' || p.stop_hook === 'off') return 0;   // already continued once: never loop
    const msgs = [];
    for (const t of loadTasks().list) {
      if (t.status === 'in_progress' && !taskPassed(t)) msgs.push(`${t.id} (${t.title || ''}) is in progress and its check has not passed. Run gw task done ${t.id} (it runs: ${t.verify || 'no check set'}). If you can't finish it, run gw task block ${t.id} "<what blocks it>" and tell the user.`);
      if (t.status === 'done' && !t.legacy && !taskPassed(t)) msgs.push(`${t.id} is marked done but no passing check is recorded. Run gw task done ${t.id} to verify it.`);
    }
    if (!msgs.length) return 0;
    // block once per change: if nothing changed since the last block (e.g. waiting for the user), let the turn end
    const fp = crypto.createHash('sha256').update([git('status', '--porcelain'), git('diff', 'HEAD'), readRel('.groundwork/tasks.json')].join('\0')).digest('hex').slice(0, 16);
    const st = state(); if (st.stop_fp === fp) return 0;
    st.stop_fp = fp; writeJson(P('state.json'), st);
    fb('stop-blocked', { reason: msgs.length + ' unverified task(s)' });
    process.stderr.write('Groundwork: not finished yet.\n- ' + msgs.join('\n- ') + '\nDo not report the work as done until its check passes. If the user asked you to stop here or not to run checks, end the turn by saying plainly which task is not verified.\n');
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
const HELP = 'Groundwork CLI\n  init [--profile minimal|standard|strict] [--no-hooks]   set up this project (state, CLAUDE.md import, hooks) and scan the host\n' +
        '  doctor [--fresh] [--json]   scan host if needed, check tools for the chosen targets\n  plan-install   list install/fix commands for this machine (never runs them)\n' +
        '  status | next   show phase, blockers, next step\n  set k=v ...   e.g. set tier=standard stage=greenfield targets=web,android stacks.android=flutter · set preset=flutter [targets=android,web]\n' +
        '  phase <id> <status> ["note"]   record phase progress\n  run <target> <tier> -- <cmd>   run tests and write a receipt\n  gate <G1|G2> [--approve "..."]   check / approve a gate\n' +
        '  task [list] | add <id> "<title>" --verify "<cmd>" [--req REQ-001] | start | done | block <id> "<reason>" | reopen   tasks; done only when the check passes\n' +
        '  docs   documents this tier and features need · trace   REQ → task → test · lint   requirement quality · metrics [--json]   delivery outcomes\n' +
        '  review add <SEV> "<finding>" --verdict <fixed|waived|deferred|open> | review done --reviewer <fresh-context|human|ci> "<summary>"\n  ci [list] | ci print <target> | ci write [target...] [--os linux,windows,macos] [--force]   GitHub Actions workflow per target from its pack (S3)\n  devcontainer [--print] [--force]   .devcontainer/devcontainer.json for the target stacks (S1)\n  reuse [<git-url> [name]]   shallow-clone an open-source repo to read or reuse, with its license and credit row (phases/REUSE.md)\n  scan   print raw host profile\n  note <category> "text"   silent framework feedback (agent)\n  feedback   write .groundwork/FEEDBACK.md\n  skills [--for \"task\"] [--all] | skills fetch|install [--global]|decline <id> | skills verdict <id> <APPROVE|CAUTION|REJECT> \"reason\"   context-aware skill recommendations\n  skills refresh [--force] | skills trending on|off | skills refresh-day <mon..sun|off>   weekly trending discovery\n  maintain   upgrade/audit/dead-code/rollback/observability commands for this project\n  eol   runtime end-of-life check (endoflife.date)\n  version | verify [--clean] | upgrade <new-groundwork-folder> [--force] | migrate';
function main(argv) {
  const [cmd, ...args] = argv;
  if (['task', 'review'].includes(cmd) && args.some(a => ['--help', '-h'].includes(a) || a === 'help' && a === args[0])) args.splice(0, args.length, 'help');   // gw task add --help too
  const own = args.includes('--') ? args.slice(0, args.indexOf('--')) : args;   // gw run host S0 -- tool --help is a real run
  if (cmd && !['task', 'review'].includes(cmd) && own.some(a => ['--help', '-h'].includes(a))) {
    const lines = HELP.split('\n').filter(l => new RegExp(`^  ${cmd.replace(/[^\w-]/g, '')}\\b|[|·] ${cmd.replace(/[^\w-]/g, '')}\\b`).test(l)); console.log(lines.length ? lines.join('\n') : HELP); return 0; }
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
      const p = project(), oldTier = p.tier;
      for (const kv of args) { const [k, ...v] = kv.split('='); const val = v.join('=');
        if (k === 'references') p[k] = val.split(',').map(x => x.trim()).filter(Boolean);
        else if (k === 'features') { const f = val.split(',').map(x => x.trim().toLowerCase()).filter(Boolean), bad = f.filter(x => !FEATURES.includes(x));
          if (bad.length) throw new Error(`unknown feature ${bad.join(',')}; use any of ${FEATURES.join(',')}`); p.features = f; }
        else if (k === 'targets' || k === 'services') { p[k] = val.split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
          const bad = k === 'targets' ? p[k].filter(t => !packs()[t]) : [];
          if (bad.length) throw new Error(`unknown target ${bad.join(',')}. Known targets: ${Object.keys(packs()).join(', ')} (an HTTP API or service is "backend"; a library or CLI is "cli")`); }
        else if (k === 'preset') { if (!presets()[val]) throw new Error(`unknown preset ${val}. Presets: ${Object.keys(presets()).join(', ')}`); p.preset = val; }
        else if (k.startsWith('stacks.')) { p.stacks = p.stacks || {}; p.stacks[k.slice(7)] = val; }
        else if (k.startsWith('docs.')) { p.docs = p.docs || {}; p.docs[k.slice(5)] = val; }
        else if (k === 'tier' && !TIER_PHASES[val]) throw new Error('tier must be one of ' + Object.keys(TIER_PHASES));
        else if (k === 'dev_method' && val && !DEV_METHODS.includes(val)) throw new Error('dev_method must be one of ' + DEV_METHODS.join(', ') + ' (empty to clear)');
        else p[k] = val; }
      if (args.some(a => a.startsWith('preset='))) {   // one stack for several targets; targets= in the same command takes a subset
        const pr = presets()[p.preset].targets, want = args.some(a => a.startsWith('targets=')) ? p.targets : Object.keys(pr), bad = want.filter(t => !pr[t]);
        if (bad.length) throw new Error(`preset ${p.preset} covers ${Object.keys(pr).join(', ')}; not ${bad.join(', ')}`);
        p.targets = want; p.stacks = { ...(p.stacks || {}), ...Object.fromEntries(want.map(t => [t, pr[t]])) };
      }
      if (p.dev_method === '') delete p.dev_method_reason;
      for (const k of Object.keys(p)) if (p[k] === '') delete p[k];   // `gw set dev_method=` clears an override
      writeJson(P('project.json'), p);
      console.log(`Set ${args.map(a => a.split('=')[0]).join(', ')} · stage ${p.stage || '?'} · tier ${p.tier || '?'} · features ${(p.features || []).join(',') || '-'} · targets ${(p.targets || []).join(',') || '-'}`);
      const open = (p.targets || []).filter(t => (packs()[t] || {}).ui && !(p.stacks || {})[t]);   // UI targets with no stack yet
      if (args.some(a => a.startsWith('targets=')) && !args.some(a => a.startsWith('preset=')) && open.length >= 2) {
        const fit = presetsFor(open);
        console.log(fit.length ? `One codebase for ${open.join(', ')}: ${fit.map(([id, pr]) => `${id} (${pr.title.split(':')[0]})`).join(', ')}. Use one with gw set preset=<id> targets=${open.join(',')}, or set a stack per target (stacks.<target>=…).`
          : `No single preset covers ${open.join(', ')}: set a stack per target (stacks.<target>=…), or share code between the ones a preset covers.`);
        console.log('Either way each target gets its own CI workflow and tests on its platform (gw ci write).');
      }
      if (oldTier && p.tier !== oldTier) {   // re-tiering is a decision: keep why
        fs.appendFileSync(P('decisions.jsonl'), JSON.stringify({ at: now(), kind: 're-tier', from: oldTier, to: p.tier, reason: p.tier_reason || null }) + '\n');
        if (!args.some(a => a.startsWith('tier_reason='))) console.log(`Tier changed ${oldTier} → ${p.tier}. Record why: gw set tier_reason="<what changed>"`);
        console.log('Documents now required: gw docs');
      }
      if (args.some(a => /^dev_method=/.test(a)) && exists(P('host-profile.json'))) { const r = doctor(hostProfile(), p); console.log(`Dev method: ${r.dev_method.id}: ${r.dev_method.why}`); }
      return 0;
    }
    case 'phase': {   // gw phase P1 done|skipped|in_progress|blocked ["note"]
      const [id, status, note] = args;
      if (!PHASES.some(p => p[0] === id) || !['done', 'skipped', 'in_progress', 'blocked'].includes(status)) throw new Error('usage: gw phase <H0..P11> <done|skipped|in_progress|blocked> ["note"]');
      if (id === 'P6' && status === 'done' && !exists(P('gates', 'G1.json'))) throw new Error('P6 needs GATE 1: gw gate G1 --approve "..."');
      if (id === 'P10' && status === 'done' && !exists(P('gates', 'G2.json'))) throw new Error('P10 needs GATE 2: gw gate G2 --approve "..."');
      const st = state(); st.phases[id] = { status, at: now(), ...(note ? { note } : {}) };
      if (st.recheck) { st.recheck = st.recheck.filter(x => x !== id); if (!st.recheck.length) delete st.recheck; }
      writeJson(P('state.json'), st);
      st.phase = nextStep().phase; writeJson(P('state.json'), st);
      if (status === 'blocked' || status === 'skipped') fb('phase-' + status, { id, note: note || null });
      fbRefresh(); const n = nextStep();   // one line: the full status (host, skills) is printed at session start and by gw status
      console.log(`${id} ${status}. Next: ${n.phase ? n.phase + ' → ' + n.do : n.do}`);
      if (st.recheck && st.recheck.length) console.log(`Re-check after the framework upgrade: ${st.recheck.join(', ')}`);
      return 0;
    }
    case 'run': {     // gw run <target> <S0|S1|S2|S3> -- <command...>
      const [target, tier] = args, i = args.indexOf('--');
      if (!target || !/^S[0-3]$/.test(tier || '') || i < 0) throw new Error('usage: gw run <target> <S0..S3> -- <command>');
      const command = args.slice(i + 1).join(' '), all = packs(), pk = all[target];
      if (target === 'host') {   // a plain run on this machine (S0); it never counts as a target's release run
        if (tier !== 'S0') throw new Error('target "host" means this machine, so only S0. For S1–S3 name the target (gw doctor lists them)');
        const { id, receipt } = recordRun({ target, tier, command });
        console.log(`\nGroundwork run receipt: .groundwork/runs/${id}/receipt.json (exit ${receipt.exit})`); return receipt.exit === 0 ? 0 : 1;
      }
      if (!pk) throw new Error(`unknown target "${target}". Known targets: ${Object.keys(all).join(', ')}${(project().targets || []).length ? ' · this project: ' + project().targets.join(', ') : ' · this project has none: use "host" for S0 runs'} (an HTTP API is "backend")`);
      // a receipt must not claim more isolation than the command shows (a host npm test is not S1)
      const SIGN = { S1: /\b(docker|podman|nerdctl|devcontainers?|compose|container)\b/i, S2: /\b(emulator|adb|simctl|xcrun|avd|qemu|virsh|vagrant|multipass|lima|utm|parallels|hyper-?v|vm)\b/i, S3: /\b(gh (run|workflow)|act|ci|gitlab|circleci|buildkite|jenkins|azure|codemagic|bitrise)\b/i };
      if (SIGN[tier] && !SIGN[tier].test(command) && !args.slice(0, i).includes('--wrapper'))
        throw new Error(`${tier} means ${{ S1: 'a container', S2: 'an emulator or VM', S3: 'CI or a remote device' }[tier]}, but this command shows none, so it would run on the host. Use the pack's ${tier} command (gw doctor, docs/test-strategy.md), record it as S0, or, if the script itself starts the ${tier} environment, add --wrapper before --`);
      const c = projectCaps(hostProfile(), project());
      if ((tier === 'S1' || tier === 'S2') && !tierAvailable(pk, tier, c))
        throw new Error(`${tier} is not available for ${target} on this host (see gw doctor). Fix the warning, or run on CI and record it as S3.`);
      const { id, receipt } = recordRun({ target, tier, command });
      console.log(`\nGroundwork run receipt: .groundwork/runs/${id}/receipt.json (exit ${receipt.exit})`); return receipt.exit === 0 ? 0 : 1;
    }
    case 'task': return taskCmd(args);
    case 'review': return reviewCmd(args);
    case 'docs': {    // the documents this tier and these features need (the doc budget)
      const proj = project(), need = requiredDocs(proj);
      if (!proj.tier) { console.log('Tier not set yet (phases/P0.md decides it): gw set tier=<trivial|small|standard|large>'); return 0; }
      console.log(`Documents for tier ${proj.tier}${projectFeatures(proj).size ? ' · features ' + [...projectFeatures(proj)].join(',') : ''} (GATE 1 checks exactly these; write no others unless asked):`);
      if (!need.length) console.log('  none: a trivial change needs only its check (CHANGE.md).');
      for (const d of need) { const f = resolveDoc(d.doc, proj), t = readRel(f);
        console.log(`  ${t == null ? '✗ missing ' : MARKER.test(t) ? '! open    ' : '✓ ok      '} ${f.padEnd(28)} ${d.why}`); }
      if (!proj.features) console.log(`Features not set: gw set features=${FEATURES.join(',')} (only the ones that apply; they decide bsd.md and srd.md)`);
      return 0;
    }
    case 'trace': {   // REQ → task → test
      const r = trace();
      if (!r.prd) { console.log(`No requirement IDs found in ${docPath('prd.md')}.`); return 0; }
      console.log(`Traceability for ${r.prd}${r.change ? ' · change ' + r.change + ' (only the IDs it names are checked)' : ''} (REQ/SEC need a task and a test; NFR/JRN are shown only):`);
      for (const x of r.rows) console.log(`  ${x.id.padEnd(9)} tasks: ${(x.tasks.join(',') || '-').padEnd(12)} test: ${x.tested ? 'yes' : x.enforced ? 'NO' : '-'}${x.delivered ? '  (delivered)' : !x.enforced && /^(REQ|SEC)-/.test(x.id) ? '  (not in this change)' : ''}`);
      if (r.out_of_scope.length) console.log('  out of scope: ' + r.out_of_scope.join(', '));
      if (r.orphans.length) console.log('  tasks name IDs not in the PRD: ' + r.orphans.join(', '));
      return r.rows.some(x => x.enforced && (!x.tasks.length || !x.tested)) ? 1 : 0;
    }
    case 'lint': {    // requirement quality + delta structure
      const r = lint();
      for (const e of r.errors) console.log('✗ ' + e);
      for (const w of r.warnings) console.log('! ' + w);
      if (!r.errors.length && !r.warnings.length) console.log('Requirements look testable and well formed.');
      return r.errors.length ? 1 : 0;
    }
    case 'metrics': {
      const m = metrics();
      if (args.includes('--json')) { console.log(JSON.stringify(m, null, 2)); return 0; }
      if (!m.tasks) { console.log('No tasks recorded yet (gw task add).'); return 0; }
      console.log(`Tasks ${m.tasks} · done ${m.done} · first-pass ${m.first_pass} · reopened ${m.reopened} · rework rate ${m.rework_rate ?? '-'}\n` +
        `Failed checks ${m.failed_checks} · median task ${m.median_task_minutes ?? '-'} min · release runs ${m.release_runs} (${m.release_runs_failed} failed) · reverts ${m.reverts} · circuit breakers ${m.circuit_breakers} · stop blocks ${m.stop_blocks}`);
      return 0;
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
    case 'reuse': return reuseCmd(args);
    case 'ci': return ciCmd(args);
    case 'devcontainer': return devcontainerCmd(args);
    case 'research': {   // gw research "<reference>" ["goal"]: record a reference app and start its research doc
      const [name, goal] = args;
      if (!name) { const p = project(); console.log((p.references || []).length ? 'References: ' + p.references.join(', ') : 'No references yet: gw research "<app or site>" "<goal>"'); return 0; }
      const p = project(); p.references = [...new Set([...(p.references || []), name])]; writeJson(P('project.json'), p);
      const slug = name.toLowerCase().replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'reference';
      const doc = path.posix.join(p.docs_dir || 'docs', 'research', slug + '.md'), abs = path.join(ROOT, doc);
      if (!exists(abs)) { fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, fs.readFileSync(path.join(FW, 'templates', 'reference-research.md'), 'utf8').replace('<app / site / bot>', name)
          .replace('- Why: <what we want to learn, linked to REQ IDs if known>', '- Goal: ' + (goal || '[NEEDS CLARIFICATION: what must we learn, what for, and how do we know we are done?]'))); }
      console.log(`Reference recorded: ${name} · research doc: ${doc}` + (goal ? '' : '\nGoal not given: ask the user what they want to learn and why, then fill the Goal line.') +
        '\nNext: groundwork/phases/RESEARCH.md: pick the depth the goal needs, tell the user why, and escalate if the goal is not met.');
      const r = doctor(hostProfile(), p); const miss = r.checks.filter(c => ['rea', 'scrapling'].includes(c.id) && c.status !== 'ok');
      if (miss.length) console.log('Research tools not installed yet: ' + miss.map(c => c.id).join(', ') + ' (suggest only if the chosen depth needs them; gw plan-install shows the commands)');
      return 0;
    }
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
        const files = s.path ? walk(skillDir) : ['SKILL.md'], scripts = files.filter(f => /\.(sh|bash|ps1|js|mjs|cjs|ts|py|rb|exe|bat|cmd)$/i.test(f));
        if (sub === 'fetch') {
          console.log(`Fetched ${s.id} @ ${src.ref.slice(0, 12)} (${src.license}) to ${path.relative(ROOT, skillDir)}\nFiles: ${files.join(', ')}` +
            (scripts.length ? `\n⚠ contains executable files: ${scripts.join(', ')}. Read them before installing.` : '\nNo executable files.') +
            (s.note ? `\nNote: ${s.note}` : ''));
          const ins = inspectorStatus(), target = skillDir;
          console.log('\nNext: inspect before installing (required).');
          if (ins.skill) console.log(`  Run the ${INSPECTOR} skill on: ${target}` + (ins.cli ? '  (SkillSpector CLI found: static scan + semantic review)' : '  (SkillSpector CLI not found: semantic review only, lower confidence; gw plan-install lists it)'));
          else if (s.role !== 'inspector') console.log(`  ${INSPECTOR} is not installed. Groundwork uses it to vet skills, so install it first: ${INSPECTOR_INSTALL}\n  (or do the manual review in phases/P4.md step 4 on ${target}` + (ins.cli ? `, plus: skillspector scan "${target}" --no-llm --format json --output .groundwork/cache/${s.name}-skillspector.json` : '') + ')');
          if (s.role === 'inspector') { console.log(`  This is the inspector itself: install it directly with ${INSPECTOR_INSTALL}`); return 0; }
          console.log(`  Then record the result: gw skills verdict ${s.id} <APPROVE|CAUTION|REJECT> "<one-line reason>" --report docs/skill-reviews/${s.name}.md`);
          console.log(`  Then: gw skills install ${s.id}  (CAUTION: --accept-caution after user approval · REJECT: show the user why; install only on their decision with --override-reject "<their words>")`);
          return 0;
        }
        const review = reviews()[s.id], gate = installGate(review, src.ref, args, s);
        if (!gate.ok && gate.rejected) throw new Error(`${s.id}: ${gate.msg.replace('<id>', s.id)}`);
        if (gate.overridden) fb('reject-overridden', { id: s.id, decision: gate.msg });
        if (!gate.ok) throw new Error(`${s.id}: ${gate.msg}. ` + (inspectorStatus().skill ? `Fetch shows the inspection steps: gw skills fetch ${s.id}` : `Install the inspector first: ${INSPECTOR_INSTALL}`));
        if (gate.skipped) fb('inspection-skipped', { id: s.id, reason: gate.msg });
        const lic = src.license_file ? path.join(dir, src.license_file) : (fs.readdirSync(dir).filter(f => /^LICEN[CS]E/i.test(f)).map(f => path.join(dir, f))[0] || null);
        if (!lic && !args.includes('--force')) throw new Error(`${s.id} has no LICENSE in its repo, so you may not have the right to copy it. Read the repo terms; install anyway with --force.`);
        const dest = path.join(args.includes('--global') || (s.role === 'inspector' && !args.includes('--project')) ? os.homedir() : ROOT, '.claude', 'skills', s.name);
        if (exists(dest) && !args.includes('--force')) throw new Error(`${path.relative(ROOT, dest)} already exists (use --force to replace)`);
        fs.rmSync(dest, { recursive: true, force: true });
        fs.cpSync(skillDir, dest, { recursive: true });
        if (lic) fs.copyFileSync(lic, path.join(dest, 'LICENSE'));   // keep the licence notice (MIT requires it)
        const lock = readJson(P('skills.lock.json'), {});   // global installs are recorded too, so the project knows what it relied on
        lock[s.name] = { id: s.id, repo: src.repo, ref: src.ref, path: s.path, license: src.license, installed_at: now(),
          inspection: gate.bootstrap ? { bootstrap: gate.msg } : gate.skipped ? { skipped: gate.msg } : gate.overridden ? { verdict: 'REJECT', override: gate.msg, report: review.report || null, at: review.at } : { verdict: review.verdict, reviewer: review.reviewer, scanner: review.scanner, report: review.report || null, at: review.at }, files: Object.fromEntries(walk(dest).map(f => [f, sha(path.join(dest, f))])) };
        writeJson(P('skills.lock.json'), lock);
        console.log(`Installed ${s.id} → ${path.relative(ROOT, dest)} (${gate.msg}${lic ? ', with LICENSE' : ''}). Recorded in .groundwork/skills.lock.json. Add it to docs/skill-requirements.md.`);
        return 0;
      }
      if (sub === 'verdict') {   // gw skills verdict <id> <APPROVE|CAUTION|REJECT> "reason" [--report path] [--scanner skillspector|none]
        const [, id, verdict, ...rest] = args, s = cat.skills.find(x => x.id === id);
        if (!s) throw new Error('unknown skill id');
        if (!['APPROVE', 'CAUTION', 'REJECT'].includes(verdict)) throw new Error('verdict must be APPROVE, CAUTION or REJECT');
        const summary = rest.filter((a, i) => !a.startsWith('--') && !['--report', '--scanner'].includes(rest[i - 1])).join(' ').trim();
        if (!summary) throw new Error('give a one-line reason');
        const ins = inspectorStatus(), all = reviews();
        all[id] = { ref: skillRef(s), verdict, summary, reviewer: ins.skill ? INSPECTOR : 'manual (phases/P4.md)', scanner: flag(args, '--scanner') || (ins.cli ? 'skillspector' : 'none'), report: flag(args, '--report'), at: now() };
        writeJson(P('skills-reviews.json'), all);
        fb('skill-verdict', { id, verdict });
        if (verdict === 'REJECT') { const st = state(); st.skills_declined = [...(st.skills_declined || []).filter(d => d.id !== id), { id, at: now(), reason: 'REJECT: ' + summary }]; writeJson(P('state.json'), st); }
        console.log(`Recorded ${verdict} for ${id} @ ${String(skillRef(s)).slice(0, 12)}${verdict === 'REJECT' ? '. It will not be suggested again. Tell the user why; they decide whether to install anyway (--override-reject "<their words>")' : ''}.`);
        return 0;
      }
      if (sub === 'refresh') return refreshTrending({ quiet: args.includes('--quiet'), force: args.includes('--force') })
        .then(() => 0, e => { fb('refresh-failed', { message: e.message }); if (!args.includes('--quiet')) console.error('gw: trending refresh failed: ' + e.message); return args.includes('--quiet') ? 0 : 1; })
        .finally(() => { try { fs.rmSync(path.join(HOME_GW, 'refresh.lock'), { force: true }); } catch { } });
      if (sub === 'trending') { const on = args[1] !== 'off'; setGcfg('trending', on); console.log(`Weekly trending discovery ${on ? 'on' : 'off'} (all projects on this machine).`); return 0; }
      if (sub === 'refresh-day') {
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], d = (args[1] || '').slice(0, 3).toLowerCase();
        if (d === 'off') { setGcfg('refresh_weekday', null); console.log('Refresh every 7 days.'); return 0; }
        if (!days.includes(d)) throw new Error('usage: gw skills refresh-day <sun|mon|…|sat|off>');
        setGcfg('refresh_weekday', days.indexOf(d)); console.log(`Trending refresh runs at the first session on or after each ${args[1]} (your weekly reset day).`); return 0;
      }
      if (sub === 'decline') {
        const id = args[1]; if (!catalog().skills.some(x => x.id === id)) throw new Error('unknown skill id');
        const st = state(); st.skills_declined = (st.skills_declined || []).filter(d => d.id !== id);
        st.skills_declined.push({ id, at: now(), reason: args.slice(2).join(' ') || null }); writeJson(P('state.json'), st);
        fb('skill-declined', { id }); console.log(`${id} won't be suggested again (undo: remove it from skills_declined in .groundwork/state.json).`); return 0;
      }
      if (!args.includes('--all')) {
        const forText = flag(args, '--for'), phase = nextStep().phase, text = [forText, currentTaskText()].filter(Boolean).join(' ');
        const recs = recommendSkills(project(), phase, text, { limit: Number(flag(args, '--limit')) || 8, includeInstalled: true });
        const missing = recs.filter(r => !r.installed), have = recs.filter(r => r.installed);
        console.log(`Skill recommendations for phase ${phase}${project().stage ? ' · stage ' + project().stage : ''}${text ? ' · task: "' + text.trim().slice(0, 80) + '"' : ''}`);
        if (!missing.length) console.log('  No missing skills recommended for this context.');
        for (const r of missing) console.log(`  ${r.trending ? '★' : '+'} ${r.id.padEnd(44)} ${r.why}\n      why now: ${r.reasons.join('; ')}${r.note ? '\n      note: ' + r.note : ''}`);
        if (have.length) console.log(`  Already installed and relevant: ${have.map(r => r.name).join(', ')}`);
        if (missing.length) console.log('\nFetch for review: gw skills fetch <id> · install: gw skills install <id> · not wanted: gw skills decline <id> · full list: gw skills --all');
        return 0;
      }
      const proj = project(), phase = nextStep().phase, list = suggestSkills(proj, phase, true);
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
      console.log(HELP);
      return cmd && !['--help', '-h', 'help'].includes(cmd) ? 1 : 0;
  }
}

module.exports = { requiredDocs, prdRequirements, FEATURES, TEST_FILE, figmaCheck, figmaConfigured, mockupIntent, referenceIntent, docPath, changedPhases, chosenMethod, projectCaps, installGate, parseTrending, classifySkill, fitsProject, isLookalike, curatedCatalog, recommendSkills, suggestSkills, maintainInfo, catalog, buildManifest, integrity, changelogSince, capabilities, devMethod, feasibility, kvmCheck, dockerCheck, toolCheck, vcmp, installCommand, licenseClass, detectLicense, ciFragment, ciPlan, ciRender, devcontainerPlan, presets, presetsFor, packs };
if (require.main === module) {
  try { const r = main(process.argv.slice(2)); if (r && r.then) r.then(c => { process.exitCode = c; }, e => { fb('error', { cmd: process.argv[2] || '', message: e.message }); console.error('gw: ' + e.message); process.exitCode = 1; }); else process.exitCode = r; } catch (e) { fb('error', { cmd: process.argv[2] || '', message: e.message }); console.error('gw: ' + e.message); process.exitCode = 1; }
}
