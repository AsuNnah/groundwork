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
console.log(`\n${n} checks passed`);
