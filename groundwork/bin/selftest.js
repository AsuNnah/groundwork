// node groundwork/bin/selftest.js : checks decision rules against synthetic hosts.
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
  const c = gw.curatedCatalog();
  assert.ok(c.skills.length > 30);
  for (const s of c.skills) { const src = c.sources[s.source]; assert.ok(src, s.id); assert.ok(['MIT', 'Apache-2.0'].includes(src.license), s.id); assert.match(src.ref, /^[0-9a-f]{40}$/); }
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
  for (const id of Object.keys(gw.packs())) {
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
t('trending: parse, classify, fit, lookalike', () => {
  const html = 'x\\"initialSkills\\":[{\\"source\\":\\"a/b\\",\\"skillId\\":\\"flutter-riverpod\\",\\"name\\":\\"flutter-riverpod\\",\\"installs\\":900},{\\"source\\":\\"c/d\\",\\"skillId\\":\\"twitter-automation\\",\\"name\\":\\"twitter-automation\\",\\"installs\\":800}]';
  const l = gw.parseTrending(html);
  assert.equal(l.length, 2); assert.equal(l[0].rank, 1); assert.equal(l[0].skillId, 'flutter-riverpod');
  const proj = { targets: ['android'], stacks: { android: 'flutter' } };
  assert.ok(gw.fitsProject(gw.classifySkill('flutter-riverpod state management for Flutter apps'), proj));
  assert.ok(!gw.fitsProject(gw.classifySkill('twitter-automation post tweets on a schedule'), proj), 'non-dev skill must not fit');
  assert.ok(!gw.fitsProject(gw.classifySkill('vue-patterns Vue 3 composition API'), proj), 'other platform must not fit');
  assert.ok(gw.fitsProject(gw.classifySkill('security-audit OWASP security audit checklist', 'security-audit'), proj), 'generic dev skill fits by phase');
  assert.ok(!gw.fitsProject(gw.classifySkill('prisma-cli Prisma ORM CLI reference', 'prisma-cli'), { targets: ['backend'], stacks: { backend: 'python' } }), 'prisma is node-only');
  assert.ok(!gw.fitsProject(gw.classifySkill('animation-performance Keep React animations fast', 'animation-performance'), proj), 'react skill for a flutter project');
  assert.ok(!gw.fitsProject(gw.classifySkill('azure-prepare Prepare Azure projects for deployment on Azure', 'azure-prepare'), proj), 'vendor skill without the service');
  assert.ok(gw.fitsProject(gw.classifySkill('azure-prepare Prepare Azure projects for deployment on Azure', 'azure-prepare'), { ...proj, services: ['azure'] }), 'vendor skill with the service');
  assert.ok(!gw.fitsProject(gw.classifySkill('ai-music Generate AI music via the runcomfy CLI and API', 'ai-music'), proj), 'content generation is not dev');
  assert.ok(!gw.fitsProject(gw.classifySkill('reddit-automation Find Reddit threads to review and reply', 'reddit-automation'), proj));
  assert.ok(!gw.fitsProject(gw.classifySkill('appinsights-instrumentation Guidance for instrumenting webapps with Azure Application Insights.', 'appinsights-instrumentation'), proj), 'azure alias');
  assert.ok(gw.fitsProject(gw.classifySkill('code-review Review pull requests for bugs.', 'code-review'), proj), 'dev word in name counts');
  assert.ok(!gw.fitsProject(gw.classifySkill('helper A tool that can review things and has an API.', 'helper'), proj), 'weak words in description alone do not count');
  assert.ok(!gw.fitsProject(gw.classifySkill('anti-detect-browser Drive Chromium with a real-device fingerprint to avoid bot detection using Python', 'anti-detect-browser'), { targets: ['backend'], stacks: { backend: 'python' } }), 'evasion skills never fit');
  assert.ok(!gw.classifySkill('agent-browser Browser automation CLI for AI agents; scraping and testing pages', 'agent-browser', 'vercel-labs/agent-browser').risky, 'legit browser automation is not risky');
  assert.ok(!gw.fitsProject(gw.classifySkill('schema Add structured data schema to pages', 'schema', 'coreyhaines31/marketingskills'), { targets: ['backend'], stacks: {} }), 'marketing repo');
  assert.ok(gw.classifySkill('docker-image-hardening Harden Docker image builds', 'docker-image-hardening').dev, 'docker image is dev');
  assert.ok(gw.isLookalike('skills-shell/superpowers'), 'impersonation of obra/superpowers');
  assert.ok(!gw.isLookalike('obra/superpowers'));
  assert.ok(!gw.isLookalike('vercel-labs/agent-skills'), 'generic repo name is not impersonation');
});
t('install gate: inspector bootstrap, verdicts, pinned ref', () => {
  const g = gw.installGate;
  assert.ok(g(null, 'r1', [], { role: 'inspector', source: 'skillspector' }).ok, 'inspector bootstraps');
  assert.ok(!g(null, 'r1', [], { role: 'inspector', source: 'someone-else' }).ok, 'only the official inspector source bootstraps');
  assert.ok(!g(null, 'r1').ok, 'no verdict');
  assert.ok(g({ ref: 'r1', verdict: 'APPROVE' }, 'r1').ok);
  assert.ok(!g({ ref: 'r0', verdict: 'APPROVE' }, 'r1').ok, 'verdict for another commit');
  assert.ok(!g({ ref: 'r1', verdict: 'CAUTION' }, 'r1').ok); assert.ok(g({ ref: 'r1', verdict: 'CAUTION' }, 'r1', ['--accept-caution']).ok);
  const rj = g({ ref: 'r1', verdict: 'REJECT', summary: 'sends tokens to a remote host', report: 'docs/skill-reviews/x.md' }, 'r1');
  assert.ok(!rj.ok && rj.rejected && /sends tokens/.test(rj.msg) && /x\.md/.test(rj.msg), 'REJECT explains why');
  assert.ok(!g({ ref: 'r1', verdict: 'REJECT' }, 'r1', ['--accept-caution', '--force']).ok, 'only an explicit user decision overrides REJECT');
  assert.ok(g({ ref: 'r1', verdict: 'REJECT' }, 'r1', ['--override-reject', 'I read it, install anyway']).overridden, 'user decides');
  assert.ok(!g({ ref: 'r0', verdict: 'REJECT' }, 'r1', ['--override-reject', 'yes']).ok, 'override is per inspected commit');
  assert.ok(g(null, 'r1', ['--skip-inspection', 'reviewed by hand']).ok);
  assert.ok(!g({ ref: 'r1', verdict: 'REJECT' }, 'r1', ['--skip-inspection', 'trust me']).ok, '--skip-inspection is not a REJECT override'); assert.ok(!g(null, 'r1', ['--skip-inspection', '--force']).ok, 'skip needs a reason');
});
t('template tables have consistent columns', () => {
  const fs = require('fs'), path = require('path'), dir = path.join(__dirname, '..', 'templates');
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.md'))) {
    let hdr = null;
    fs.readFileSync(path.join(dir, f), 'utf8').split('\n').forEach((l, i) => {
      if (!l.startsWith('|')) { hdr = null; return; }
      const n = (l.trim().match(/(?<!\\)\|/g) || []).length - 1;
      if (hdr === null) hdr = n; else assert.strictEqual(n, hdr, `${f}:${i + 1} has ${n} columns, header has ${hdr}`);
    });
  }
});
t('every template a phase names exists', () => {
  const fs = require('fs'), path = require('path');
  const dir = path.join(__dirname, '..');
  const docs = [...fs.readdirSync(path.join(dir, 'phases')).map(f => path.join('phases', f)), 'GROUNDWORK.md'];
  for (const d of docs) for (const m of fs.readFileSync(path.join(dir, d), 'utf8').matchAll(/templates\/([\w.-]+\.md)/g))
    assert.ok(fs.existsSync(path.join(dir, 'templates', m[1])), `${d} names missing templates/${m[1]}`);
});
t('feedback 0.4.0: docs location, dev method override, phase re-check', () => {
  assert.strictEqual(gw.docPath('prd.md', { docs: { prd: 'app/docs/PRD.md' } }), 'app/docs/PRD.md', 'explicit doc path');
  assert.strictEqual(gw.docPath('plan.md', { docs_dir: 'no-such-dir/docs' }), 'no-such-dir/docs/plan.md', 'docs_dir');
  assert.strictEqual(gw.docPath('test-strategy.md', { docs: { test_strategy: 'x/ts.md' } }), 'x/ts.md', 'key with underscore');
  const h = { os: { family: 'linux' }, machine: { kind: 'desktop' } }, c = { containers: true };
  assert.strictEqual(gw.chosenMethod(h, c, {}).id, 'devcontainer');
  const o = gw.chosenMethod(h, c, { dev_method: 'native-user-scope', dev_method_reason: 'no Docker in dev' });
  assert.ok(o.override && o.id === 'native-user-scope' && o.host_default === 'devcontainer' && /no Docker/.test(o.why));
  const oldM = { files: { 'phases/P2.md': 'a', 'phases/P3.md': 'b', 'phases/P4.md': 'c' } }, newM = { files: { 'phases/P2.md': 'A', 'phases/P3.md': 'b', 'phases/P4.md': 'C' } };
  assert.strictEqual(gw.installCommand({ os: { package_managers: 'apt' }, toolchains: { npm: '10.9' } }, 'rea').via, 'npm', 'npm install route');
  assert.deepStrictEqual(gw.changedPhases(oldM, newM, { phases: { P2: { status: 'done' }, P3: { status: 'done' }, P4: { status: 'in_progress' } } }), ['P2'], 'only done phases whose file changed');
});
t('reference-app intent (English + Indonesian)', () => {
  for (const s of ['pelajari aplikasi Splitwise', 'learn how Notion handles offline sync', 'learn Splitwise', 'i want app like Duolingo', 'use Linear for reference',
    'aku mau aplikasi seperti gojek', 'bikin bot kayak MEE6', 'pakai Mobbin sebagai acuan', 'reverse engineer this APK', 'make a clone of Wordle']) assert.ok(gw.referenceIntent(s), s);
  for (const s of ['fix the login bug', 'do it like this', 'I would like to add dark mode', 'it looks like a bug', 'sepertinya gagal', 'based on the PRD write the plan',
    'learn python basics first', 'the app crashes like before', 'perbaiki error di bot']) assert.ok(!gw.referenceIntent(s), s);
});
t('mockup intent', () => {
  for (const s of ['bikin mockup dulu', 'show me a wireframe', 'can we do it in Figma', 'gimana tampilan aplikasi nya', 'I want to see how it looks', 'UI/UX design first']) assert.ok(gw.mockupIntent(s), s);
  for (const s of ['fix the login bug', 'the prototype pollution advisory'.replace('prototype', 'proto'), 'deploy the bot']) assert.ok(!gw.mockupIntent(s), s);
});
t('figma detection: plugin config, UI targets only', () => {
  const fs = require('fs'), os = require('os'), path = require('path');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-figma-'));
  assert.ok(!gw.figmaConfigured(home), 'nothing configured');
  const plug = path.join(home, '.claude', 'plugins', 'cache', 'figma'); fs.mkdirSync(plug, { recursive: true });
  fs.writeFileSync(path.join(plug, '.mcp.json'), JSON.stringify({ mcpServers: { figma: { type: 'http', url: 'https://mcp.figma.com/mcp' } } }));
  assert.ok(gw.figmaConfigured(home), 'Figma plugin found');
  assert.strictEqual(gw.figmaCheck({ targets: ['backend'] }), null, 'no screens, no Figma check');
  const c = gw.figmaCheck({ targets: ['web'] }); assert.ok(c && /MANUAL ACTION/.test(c.fix), 'UI project gets a check that says what is manual');
});
// ---------- 0.5.0: tasks, Stop hook, trace, docs, lint, review, migration (CLI in a temp git project) ----------
const proj = (files = {}) => {
  const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-proj-'));
  const put = (f, c) => { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), typeof c === 'string' ? c : JSON.stringify(c, null, 2)); };
  put('.groundwork/project.json', { name: 'p', tier: 'standard', targets: [], stacks: {}, profile: 'standard', framework_version: require('fs').readFileSync(path.join(__dirname, '..', 'VERSION'), 'utf8').trim() });
  put('.groundwork/state.json', { phase: 'P7', phases: {}, waivers: [] });
  for (const [f, c] of Object.entries(files)) put(f, c);
  const env = { ...process.env, GW_PROJECT_DIR: d, GW_HOME: path.join(d, '.home') };
  cp.spawnSync('git', ['init', '-q'], { cwd: d }); cp.spawnSync('git', ['-c', 'user.email=t@t.t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'base'], { cwd: d });
  const gwc = (args, input) => { const r = cp.spawnSync(process.execPath, [path.join(__dirname, '..', 'bin', 'gw.js'), ...args], { cwd: d, env, input: input || '', encoding: 'utf8' }); return { code: r.status, out: r.stdout + r.stderr }; };
  const read = f => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'));
  return { d, gw: gwc, read, put };
};
t('task done only when its check passes; WIP 1; circuit breaker at 3', () => {
  const p = proj();
  assert.equal(p.gw(['task', 'add', 'T01', 'fix', '--verify', 'node -e "process.exit(1)"']).code, 0);
  assert.equal(p.gw(['task', 'add', 'T02', 'other', '--verify', 'node -e "0"']).code, 0);
  assert.equal(p.gw(['task', 'start', 'T01']).code, 0);
  assert.equal(p.gw(['task', 'start', 'T02']).code, 1, 'second task refused while T01 is in progress');
  for (let i = 1; i <= 3; i++) { const r = p.gw(['task', 'done', 'T01']); assert.equal(r.code, 1); if (i === 3) assert.match(r.out, /Circuit breaker/); }
  assert.equal(p.read('.groundwork/tasks.json')[0].status, 'in_progress', 'failed check never marks done');
  assert.equal(p.gw(['task', 'block', 'T01', 'needs a decision']).code, 0);
  assert.equal(p.gw(['task', 'done', 'T02']).code, 0);
  const t2 = p.read('.groundwork/tasks.json')[1]; assert.equal(t2.status, 'done'); assert.ok(t2.receipt);
  assert.equal(p.read(`.groundwork/runs/${t2.receipt}/receipt.json`).task, 'T02');
  const m = JSON.parse(p.gw(['metrics', '--json']).out);
  assert.equal(m.done, 1); assert.equal(m.failed_checks, 3); assert.equal(m.circuit_breakers, 1);
});
t('Stop hook: blocks an unverified task once per change, never when already continued', () => {
  const p = proj();
  p.gw(['task', 'add', 'T01', 'fix', '--verify', 'node -e "0"']); p.gw(['task', 'start', 'T01']);
  const r = p.gw(['hook', 'stop'], '{}'); assert.equal(r.code, 2); assert.match(r.out, /gw task done T01/);
  assert.equal(p.gw(['hook', 'stop'], '{"stop_hook_active":true}').code, 0, 'no loop');
  assert.equal(p.gw(['hook', 'stop'], '{}').code, 0, 'nothing changed since the last block');
  p.gw(['task', 'done', 'T01']);
  assert.equal(p.gw(['hook', 'stop'], '{}').code, 0, 'verified: turn may end');
  const q = proj({ '.groundwork/tasks.json': [{ id: 'T09', title: 'x', verify: 'true', status: 'done' }] });
  assert.equal(q.gw(['hook', 'stop'], '{}').code, 2, 'done by hand without a receipt is caught');
  q.put('.groundwork/project.json', { ...q.read('.groundwork/project.json'), stop_hook: 'off' });
  assert.equal(q.gw(['hook', 'stop'], '{}').code, 0, 'stop_hook=off');
});
t('reopened task needs a new passing check', () => {
  const p = proj();
  p.gw(['task', 'add', 'T01', 'fix', '--verify', 'node -e "0"']); p.gw(['task', 'start', 'T01']); p.gw(['task', 'done', 'T01']);
  p.gw(['task', 'reopen', 'T01', 'bug came back']); p.gw(['task', 'start', 'T01']);
  assert.equal(p.gw(['hook', 'stop'], '{}').code, 2, 'old receipt does not count');
  assert.equal(JSON.parse(p.gw(['metrics', '--json']).out).reopened, 1);
});
t('doc budget follows tier and features', () => {
  const docs = (tier, features, targets = []) => gw.requiredDocs({ tier, features, targets }, {}).map(d => d.doc);
  assert.deepEqual(docs('trivial', []), []);
  assert.deepEqual(docs('small', []), ['plan.md']);
  const std = docs('standard', []); assert.ok(std.includes('prd.md') && std.includes('test-strategy.md') && !std.includes('srd.md') && !std.includes('bsd.md'));
  assert.ok(docs('standard', ['auth']).includes('srd.md')); assert.ok(docs('standard', ['db']).includes('bsd.md'));
  assert.ok(docs('large', [], ['web']).includes('platform/web.md'));
  assert.ok(gw.requiredDocs({ tier: 'small', targets: ['web'] }, { web: { ui: true } }).some(d => d.doc === 'dbd.md'), 'UI pack adds the DBD');
});
t('PRD requirement parsing and out-of-scope rows', () => {
  const r = gw.prdRequirements('| ID | x |\n|---|---|\n| REQ-001 | a | must | WHEN x, the system SHALL y |\n| REQ-002 | b | out of scope |\n### SEC-001 Tokens\n- not REQ-009 in prose');
  assert.deepEqual(r.map(x => x.id), ['REQ-001', 'REQ-002', 'SEC-001']); assert.ok(r[1].out && !r[0].out);
  assert.ok(gw.TEST_FILE.test('test/a.js') && gw.TEST_FILE.test('src/a.test.ts') && gw.TEST_FILE.test('pkg/a_test.go') && !gw.TEST_FILE.test('src/latest.js'));
});
t('trace and gates: REQ needs a task (G1) and a naming test (G2); lint errors fail G1', () => {
  const prd = '| ID | R | P | AC |\n|---|---|---|---|\n| REQ-001 | csv | must | WHEN GET /notes.csv, the system SHALL return CSV |\n| REQ-002 | pdf | could | deferred |\n';
  const p = proj({ 'docs/prd.md': prd, 'docs/plan.md': 'x', 'docs/test-strategy.md': 'x', 'docs/intent.md': 'x', 'docs/fsd.md': 'x', 'docs/trd.md': 'x',
    '.groundwork/env-report.json': { ready: true }, '.groundwork/tasks.json': [{ id: 'T01', title: 'csv', verify: 'node -e "0"', status: 'todo' }] });
  let g = p.gw(['gate', 'G1']); assert.equal(g.code, 1); assert.match(g.out, /REQ-001 has no task/); assert.doesNotMatch(g.out, /REQ-002/);
  p.put('.groundwork/tasks.json', [{ id: 'T01', title: 'csv', req: ['REQ-001'], verify: 'node -e "0"', status: 'todo' }]);
  assert.equal(p.gw(['gate', 'G1']).code, 0, p.gw(['gate', 'G1']).out);
  p.put('docs/changes/x/delta.md', '## ADDED Requirements\n### Requirement: Export\nIt exports.\n');
  g = p.gw(['gate', 'G1']); assert.equal(g.code, 1); assert.match(g.out, /no SHALL\/MUST/); assert.match(g.out, /no #### Scenario/);
  p.put('docs/changes/x/delta.md', '## ADDED Requirements\n### Requirement: Export\nThe system SHALL export.\n#### Scenario: ok\n- WHEN asked\n- THEN it exports\n');
  p.put('.groundwork/gates/G1.json', { gate: 'G1' });
  p.gw(['task', 'done', 'T01']);
  g = p.gw(['gate', 'G2']); assert.match(g.out, /REQ-001 has no test/); assert.match(g.out, /no code review recorded/);
  p.put('test/notes.test.js', "test('REQ-001 exports csv', () => {})");
  p.gw(['review', 'add', 'HIGH', 'csv injection', '--verdict', 'open']);
  p.gw(['review', 'done', '--reviewer', 'fresh-context', 'one HIGH']);
  g = p.gw(['gate', 'G2']); assert.doesNotMatch(g.out, /REQ-001/); assert.match(g.out, /HIGH review finding still open/);
  p.gw(['review', 'add', 'HIGH', 'csv injection', '--verdict', 'fixed']);
  assert.equal(p.gw(['review', 'done', '--reviewer', 'me', 'x']).code, 1, 'self-review is not a reviewer type');
});
t('0.5.0 migration: done tasks become legacy, the Stop hook is added', () => {
  const p = proj({ '.claude/settings.json': { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/groundwork/bin/gw.js" hook session-start' }] }] } },
    '.groundwork/tasks.json': { tasks: [{ id: 'T01', status: 'done' }, { id: 'T02', status: 'todo' }] } });
  p.put('.groundwork/project.json', { ...p.read('.groundwork/project.json'), framework_version: '0.4.0' });
  p.gw(['status']);
  const tk = p.read('.groundwork/tasks.json').tasks; assert.equal(tk[0].legacy, true); assert.ok(!tk[1].legacy);
  assert.ok(JSON.stringify(p.read('.claude/settings.json').hooks.Stop).includes('hook stop'));
  assert.equal(p.gw(['hook', 'stop'], '{}').code, 0, 'legacy done task does not block');
});
// from the real runs (0.5.0): brownfield changes, a red baseline, --help
t('brownfield change: change-folder docs, trace scoped to the change, delivered rows', () => {
  const d = gw.requiredDocs({ tier: 'standard', stage: 'feature', features: ['api', 'public'], targets: ['backend'] }, {}).map(x => x.doc);
  assert.deepEqual(d, ['changes/<id>/proposal.md', 'changes/<id>/delta.md', 'srd.md'], 'no new PRD/FSD/TRD set for a change');
  assert.deepEqual(gw.requiredDocs({ tier: 'small', stage: 'bugfix', targets: [] }, {}).map(x => x.doc), ['changes/<id>/bugfix.md']);
  const prd = '| ID | R | P | AC |\n|---|---|---|---|\n| REQ-001 | list | must | WHEN GET /notes, the system SHALL list |\n| REQ-002 | add | must | delivered |\n| REQ-003 | csv | must | WHEN GET /notes.csv, the system SHALL return CSV |\n';
  const p = proj({ 'docs/prd.md': prd, 'docs/srd.md': 'x', '.groundwork/env-report.json': { ready: true }, '.groundwork/tasks.json': [{ id: 'T01', title: 'csv', req: ['REQ-003'], verify: 'node -e "0"', status: 'todo' }] });
  p.put('.groundwork/project.json', { ...p.read('.groundwork/project.json'), stage: 'feature', features: ['api', 'public'] });
  let g = p.gw(['gate', 'G1']); assert.match(g.out, /missing docs\/changes\/<YYYYMMDD-slug>\/proposal\.md/);
  assert.match(g.out, /REQ-001 has no task/, 'no change folder yet: all non-delivered REQs count'); assert.doesNotMatch(g.out, /REQ-002/, 'delivered row needs no task');
  p.put('docs/changes/20261105-csv/proposal.md', 'Adds REQ-003.'); p.put('docs/changes/20261105-csv/delta.md', '## ADDED Requirements\n### Requirement: CSV\nThe system SHALL export REQ-003.\n#### Scenario: ok\n- WHEN GET\n- THEN CSV\n');
  g = p.gw(['gate', 'G1']); assert.equal(g.code, 0, g.out);
  assert.match(p.gw(['trace']).out, /REQ-001.*not in this change/);
  p.put('docs/prd.md', prd.replace('| REQ-001 | list | must | WHEN GET /notes, the system SHALL list |', '| REQ-001 | list | must | WHEN GET /notes, the system SHALL list. delivered |'));
  p.put('docs/changes/20261105-csv/proposal.md', 'Adds REQ-003. Proven by the REQ-003 test; the REQ-001 and REQ-002 tests still pass.');
  g = p.gw(['gate', 'G1']); assert.equal(g.code, 0, 'a delivered REQ named only in the proposal needs no task: ' + g.out);
  p.put('docs/changes/20261105-csv/delta.md', '## ADDED Requirements\n### Requirement: CSV\nThe system SHALL export REQ-003.\n#### Scenario: ok\n- WHEN GET\n- THEN CSV\n## MODIFIED Requirements\n### Requirement: list (REQ-001)\nThe system SHALL list notes sorted.\n#### Scenario: s\n- WHEN GET\n- THEN sorted\n');
  assert.match(p.gw(['gate', 'G1']).out, /REQ-001 has no task.*delta or bugfix names it/, 'a delivered REQ the delta modifies needs a task');
});
t('task verify changes a check visibly; --help prints usage', () => {
  const p = proj();
  p.gw(['task', 'add', 'T01', 'x', '--verify', 'npm test']);
  assert.equal(p.gw(['task', 'verify', 'T01', 'node --test test/a.test.js']).code, 0);
  assert.equal(p.read('.groundwork/tasks.json')[0].verify, 'node --test test/a.test.js');
  assert.match(require('fs').readFileSync(require('path').join(p.d, '.groundwork/decisions.jsonl'), 'utf8'), /verify-changed/);
  for (const a of [['task', '--help'], ['task', 'add', '--help'], ['review', '--help'], ['--help']]) assert.equal(p.gw(a).code, 0, a.join(' '));
  const bad = p.gw(['set', 'targets=api']); assert.equal(bad.code, 1); assert.match(bad.out, /Known targets: .*backend/);
});
t('gw run: no S1 receipt for a host command; host target for projects without targets; brownfield skips P1/P5', () => {
  const p = proj();
  p.put('.groundwork/project.json', { ...p.read('.groundwork/project.json'), targets: ['backend'], stage: 'feature' });
  const r = p.gw(['run', 'backend', 'S1', '--', 'npm', 'test']); assert.equal(r.code, 1); assert.match(r.out, /S1 means a container/);
  assert.match(p.gw(['run', 'api', 'S0', '--', 'true']).out, /Known targets: .*backend/);
  const q = proj(); assert.equal(q.gw(['run', 'host', 'S0', '--', 'node', '-e', '0']).code, 0, 'no targets: host S0 works');
  assert.equal(q.gw(['run', 'host', 'S1', '--', 'docker', 'ps']).code, 1, 'host is S0 only');
  p.put('.groundwork/host-profile.json', { scanned_at: new Date().toISOString() });
  p.put('.groundwork/state.json', { phase: 'P1', phases: { H0: { status: 'done', at: 'x' }, P0: { status: 'done', at: 'x' } }, waivers: [] });
  assert.equal(JSON.parse(p.gw(['next']).out).phase, 'P2', 'a change skips P1 (the change folder replaces it)');
  assert.match(JSON.parse(p.gw(['next']).out).do, /only if the change adds a target, stack or dependency/, 'a change reads P2 only when the stack changes');
});
t('reuse: license classes, shallow clone with credit row, G2 checks docs/credits.md', () => {
  const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process'), url = require('url');
  for (const [id, cls] of [['MIT', 'permissive'], ['Apache-2.0', 'permissive'], ['LGPL-3.0', 'weak'], ['MPL-2.0', 'weak'], ['GPL-3.0-only', 'strong'], ['AGPL-3.0', 'strong'],
    ['MIT OR GPL-3.0', 'permissive'], ['', 'none'], ['BUSL-1.1', 'restricted'], ['Artistic-2.0', 'unknown']]) assert.equal(gw.licenseClass(id), cls, id);
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-src-'));
  fs.writeFileSync(path.join(src, 'LICENSE'), 'MIT License\n\nCopyright (c) 2024 x\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\n');
  fs.writeFileSync(path.join(src, 'slug.js'), 'module.exports = s => s;\n');
  for (const a of [['init', '-q'], ['add', '-A'], ['-c', 'user.email=t@t.t', '-c', 'user.name=t', 'commit', '-qm', 'x']]) cp.spawnSync('git', a, { cwd: src });
  assert.equal(gw.detectLicense(src).id, 'MIT');
  const p = proj({ 'package.json': { name: 'p', license: 'MIT' } });
  const r = p.gw(['reuse', url.pathToFileURL(src).href, 'slug']);
  assert.equal(r.code, 0, r.out); assert.match(r.out, /License: MIT/); assert.match(r.out, /\| slug \| file:/);
  assert.ok(fs.existsSync(path.join(p.d, '.groundwork/reuse/slug/slug.js')), 'cloned');
  assert.match(fs.readFileSync(path.join(p.d, '.gitignore'), 'utf8'), /\.groundwork\/reuse\//, 'clone is git-ignored');
  assert.equal(p.gw(['reuse', '--upload-pack=touch x']).code, 1, 'an option is not a URL');
  p.put('docs/credits.md', '| Project | Source | Version / commit | License | What |\n|---|---|---|---|---|\n| a | https://x/a | 1 | MIT | src/a.js |\n| b | https://x/b | 1 | GPL-3.0 | src/b.js |\n' +
    '| c |  | 1 |  | src/c.js |\n| e | https://x/e | 1 | none | permission: author, issue #4 |\n<!--\n| d | https://x/d | 1 | none | example |\n-->\n');
  const g2 = p.gw(['gate', 'G2']).out;
  assert.match(g2, /"b" is GPL-3.0 but this project is MIT/); assert.match(g2, /"c" has no source/); assert.match(g2, /"c" has no license/);
  assert.ok(!/"a"|"d"|"e"/.test(g2), 'permissive, commented-out and permitted rows pass');
});
t('every command answers --help with exit 0; a run keeps the --help after --', () => {
  const p = proj();
  for (const c of ['run', 'trace', 'gate', 'reuse', 'phase']) { const r = p.gw([c, '--help']); assert.equal(r.code, 0, c + ': ' + r.out); assert.match(r.out, new RegExp(c)); }
  assert.equal(p.gw(['no-such-command']).code, 1);
  assert.match(p.gw(['run', 'host', 'S0', '--', 'echo', 'real-run', '--help']).out, /real-run --help/);
});
t('every phase file a doc names exists', () => {
  const fs = require('fs'), path = require('path'), dir = path.join(__dirname, '..');
  const docs = [...fs.readdirSync(path.join(dir, 'phases')).map(f => path.join('phases', f)), 'GROUNDWORK.md'];
  for (const d of docs) for (const m of fs.readFileSync(path.join(dir, d), 'utf8').matchAll(/phases\/([A-Z0-9]+)\.md/g))
    assert.ok(fs.existsSync(path.join(dir, 'phases', m[1] + '.md')), `${d} names missing phases/${m[1]}.md`);
  for (const id of fs.readFileSync(path.join(dir, 'GROUNDWORK.md'), 'utf8').match(/Playbooks in `phases\/`:(.*)/)[1].match(/`([A-Z]+)`/g).map(x => x.slice(1, -1)))
    assert.ok(fs.existsSync(path.join(dir, 'phases', id + '.md')), 'playbook ' + id);
});
t('no framework file looks like a project test to a test runner', () => {
  const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..'), hits = [];
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name), rel = path.relative(root, f).split(path.sep).join('/');
    if (e.isDirectory()) { if (/^(tests?|__tests__|spec)$/.test(e.name)) hits.push(rel + '/'); walk(f); }
    else if (/\.[cm]?[jt]sx?$/.test(e.name) && /^test[-.]|[-_.]test\.|[-_.]spec\.|^test\.[cm]?js$/.test(e.name)) hits.push(rel); } };
  walk(root);   // node --test, jest, vitest and mocha would run these inside the user's suite
  assert.deepEqual(hits, []);
});
t('every pack stack with a CI fragment renders a pinned, complete workflow', () => {
  const fs = require('fs'), path = require('path'); let n = 0;
  for (const [id, pk] of Object.entries(gw.packs())) for (const [stack, st] of Object.entries(pk.stacks || {})) {
    if (!st.ci) continue;
    const [e] = gw.ciPlan({ targets: [id], stacks: { [id]: stack } }, [], null), y = gw.ciRender(e).yaml; n++;
    assert.ok(!/__[A-Za-z]\w*__/.test(y) && !/\t/.test(y), `${id}/${stack}: placeholder or tab left`);
    for (const u of y.match(/uses: .*/g)) assert.match(u, /^uses: [\w.-]+\/[\w./-]+@[0-9a-f]{40} # v\d/, `${id}/${stack}: unpinned ${u}`);
    assert.match(y, /^name: /m); assert.match(y, /runs-on: \$\{\{ matrix\.os \}\}/); assert.match(y, new RegExp(`os: \\[${(pk.ci.os || []).join(', ')}\\]`));
    if (pk.ci.services) assert.match(y, /services:\n      postgres:/);
  }
  assert.ok(n >= 30, 'stacks with CI: ' + n);
  const dir = path.join(__dirname, '..', 'templates', 'ci', 'steps');   // every fragment states whether a real runner has proven it
  for (const f of fs.readdirSync(dir)) assert.match(fs.readFileSync(path.join(dir, f), 'utf8'), /^# verified: (no|\d{4}-\d\d-\d\d .+)$/m, f);
});
t('gw ci writes one workflow per target, narrows runners, keeps edits', () => {
  const p = proj();
  p.gw(['set', 'targets=web,android,ios', 'stacks.web=vite-react', 'stacks.android=kotlin-compose']);
  const l = p.gw(['ci']).out;
  assert.match(l, /web \(vite-react\) → \.github\/workflows\/gw-web\.yml · ubuntu-latest, windows-latest, macos-latest/); assert.match(l, /ios: set the stack first/);
  assert.equal(p.gw(['ci', 'write', 'web', '--os', 'linux,windows']).code, 0);
  const y = require('fs').readFileSync(require('path').join(p.d, '.github/workflows/gw-web.yml'), 'utf8');
  assert.match(y, /os: \[ubuntu-latest, windows-latest\]/); assert.match(y, /npm test/);
  require('fs').appendFileSync(require('path').join(p.d, '.github/workflows/gw-web.yml'), '# mine\n');
  assert.match(p.gw(['ci', 'write', 'web']).out, /exists, kept/);
  assert.match(require('fs').readFileSync(require('path').join(p.d, '.github/workflows/gw-web.yml'), 'utf8'), /# mine/);
  const bad = p.gw(['ci', 'write', 'android', '--os', 'windows']); assert.equal(bad.code, 1); assert.match(bad.out, /runs on ubuntu-latest/);
  assert.match(p.gw(['ci', 'print', 'android']).out, /android-emulator-runner@/);
});
t('a project in a subfolder of the repo gets its workflow at the repo root, scoped to the folder', () => {
  const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
  const top = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-mono-')), app = path.join(top, 'apps', 'web');
  fs.mkdirSync(path.join(app, '.groundwork'), { recursive: true }); cp.spawnSync('git', ['init', '-q'], { cwd: top });
  fs.writeFileSync(path.join(app, '.groundwork', 'project.json'), JSON.stringify({ name: 'web', targets: ['web'], stacks: { web: 'svelte' }, ci_os: 'linux' }));
  const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'gw.js'), 'ci', 'write'], { cwd: app, env: { ...process.env, GW_PROJECT_DIR: app }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const y = fs.readFileSync(path.join(top, '.github', 'workflows', 'gw-apps-web-web.yml'), 'utf8');
  assert.match(y, /working-directory: "apps\/web"/); assert.match(y, /paths: \["apps\/web\/\*\*", "\.github\/workflows\/gw-apps-web-web\.yml"\]/);
  assert.match(y, /os: \[ubuntu-latest\]/, 'ci_os from project.json'); assert.match(y, /hashFiles\('apps\/web\/playwright\.config\.\*'\)/);
  assert.ok(!fs.existsSync(path.join(app, '.github')));
  // the same repo through another spelling of its path: a symlink here, an 8.3 short name (RUNNER~1) on Windows runners
  const alias = top + '-alias', via = path.join(alias, 'apps', 'web'); fs.symlinkSync(top, alias, process.platform === 'win32' ? 'junction' : 'dir');
  const r2 = cp.spawnSync(process.execPath, [path.join(__dirname, 'gw.js'), 'ci', 'list'], { cwd: via, env: { ...process.env, GW_PROJECT_DIR: via }, encoding: 'utf8' });
  assert.match(r2.stdout, /→ \.github\/workflows\/gw-apps-web-web\.yml \(repo root, runs in apps\/web\)/, r2.stdout + r2.stderr);
});
t('doctor points a CI-only release tier at gw ci write', () => {
  const h = base(); h.virtualization.kvm_usable = false;
  const p = proj({ '.groundwork/host-profile.json': { ...h, scanned_at: new Date().toISOString(), memory: { total_gb: Math.floor(require('os').totalmem() / 1073741824) }, cpu: { ...h.cpu, arch: { x64: 'x86_64', arm64: 'arm64' }[process.arch] || process.arch }, os: { ...h.os, family: { linux: 'linux', darwin: 'macos', win32: 'windows' }[process.platform] } } });
  p.gw(['set', 'targets=android', 'stacks.android=kotlin-compose']);
  const r = p.gw(['doctor', '--json']).out, c = JSON.parse(r.slice(r.indexOf('{'))).checks.find(x => x.id === 'ci:android');
  assert.ok(c && c.fix === 'gw ci write android', 'CI hint for android without local emulator');
  p.gw(['ci', 'write', 'android']);
  assert.ok(!JSON.parse((x => x.slice(x.indexOf('{')))(p.gw(['doctor', '--json']).out)).checks.some(x => x.id === 'ci:android'), 'hint gone once the workflow exists');
});
t('devcontainer merges the blocks of every target stack', () => {
  const B = require('../packs/devcontainers.json');
  for (const [id, pk] of Object.entries(gw.packs())) for (const [stack, st] of Object.entries(pk.stacks || {}))
    for (const b of st.devcontainer || []) assert.ok(B[b] && B[b].check, `${id}/${stack}: block ${b} missing or has no check`);
  let r = gw.devcontainerPlan({ name: 'x', targets: ['web', 'backend', 'ios'], stacks: { web: 'vite-react', backend: 'python', ios: 'swiftui' } });
  assert.equal(r.dc.image, B.base.image); assert.deepEqual(Object.keys(r.dc.features), ['ghcr.io/devcontainers/features/node:1', 'ghcr.io/devcontainers/features/python:1']);
  assert.ok(r.skipped.some(s => /ios \(swiftui\): develops on the host \(macos only\)/.test(s)));
  r = gw.devcontainerPlan({ targets: ['embedded'], stacks: { embedded: 'esp-idf' } }); assert.equal(r.dc.image, 'espressif/idf:v5.5');
  r = gw.devcontainerPlan({ targets: ['android'], stacks: { android: 'kotlin-compose' } });
  assert.match(r.dc.postCreateCommand, /commandlinetools-linux-\d+_latest\.zip/); assert.match(r.notes.join(' '), /licences are yours to accept/);
  const p = proj(); p.gw(['set', 'targets=cli', 'stacks.cli=go']);
  assert.equal(p.gw(['devcontainer']).code, 0);
  const txt = require('fs').readFileSync(require('path').join(p.d, '.devcontainer/devcontainer.json'), 'utf8');
  assert.equal(JSON.parse(txt.replace(/^\/\/.*\n/, '')).features['ghcr.io/devcontainers/features/go:1'].version, 'latest');
  assert.match(p.gw(['devcontainer']).out, /exists, kept/);
});
t('presets set several targets to one stack; packs ignore the data files', () => {
  const all = gw.packs(); assert.ok(!all.presets && !all.devcontainers && !all.tools && all.game && all['browser-extension']);
  for (const [id, pr] of Object.entries(gw.presets())) for (const [t, s] of Object.entries(pr.targets)) assert.ok(all[t] && all[t].stacks[s], `preset ${id}: ${t}/${s}`);
  const p = proj();
  assert.equal(p.gw(['set', 'preset=react-native']).code, 0);
  assert.deepEqual(p.read('.groundwork/project.json').targets, ['android', 'ios', 'web']);
  p.gw(['set', 'preset=tauri', 'targets=linux-desktop,windows']);
  const j = p.read('.groundwork/project.json'); assert.deepEqual(j.targets, ['linux-desktop', 'windows']); assert.equal(j.stacks.windows, 'tauri'); assert.equal(j.preset, 'tauri');
  assert.equal(p.gw(['set', 'preset=tauri', 'targets=android']).code, 1); assert.equal(p.gw(['set', 'preset=nope']).code, 1);
});
t('host profiles with a UTF-8 BOM (Windows PowerShell 5.1) still parse', () => {
  const h = base(), fam = { linux: 'linux', darwin: 'macos', win32: 'windows' }[process.platform];
  Object.assign(h, { scanned_at: new Date().toISOString(), gpu: { model: 'BOM-TEST-GPU' }, memory: { total_gb: Math.floor(require('os').totalmem() / 1073741824) } });
  h.os.family = fam; h.cpu.arch = { x64: 'x86_64', arm64: 'arm64' }[process.arch] || process.arch;
  const p = proj({ '.groundwork/host-profile.json': '﻿' + JSON.stringify(h) });
  assert.match(p.gw(['doctor', '--json']).out, /BOM-TEST-GPU/, 'profile read, not re-scanned');
  assert.match(require('fs').readFileSync(require('path').join(__dirname, '..', 'scan', 'scan.ps1'), 'utf8'), /UTF8Encoding\]::new\(\$false\)/, 'scan.ps1 writes UTF-8 without a BOM');
});
console.log(`\n${n} checks passed`);
