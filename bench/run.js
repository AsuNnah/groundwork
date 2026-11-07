#!/usr/bin/env node
// Groundwork benchmark: the same tasks done by plain Claude Code and by Claude Code with Groundwork installed.
//   node bench/run.js --check        checks the cases themselves (no agent runs, costs nothing)
//   node bench/run.js --regrade --out DIR   recomputes the transcript fields of rows already there
//   node bench/run.js [--cases all|01,04] [--arms plain,groundwork] [--reps 3] [--jobs 4] [--model claude-sonnet-5-5] [--out DIR]
// Every run starts from a fresh git repo in the system temp folder, and hidden tests the agent never sees grade it.
// One JSON row per run goes to <out>/rows.jsonl, and a re-run skips rows already there. Transcripts go to <out>/raw/ (git-ignored).
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..'), CASES = path.join(__dirname, 'cases'), FW = path.join(ROOT, 'groundwork');
const VERSION = fs.readFileSync(path.join(FW, 'VERSION'), 'utf8').trim();
const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const MODEL = opt('model', 'claude-sonnet-5-5'), REPS = Number(opt('reps', 3)), JOBS = Number(opt('jobs', 4));
const ARMS = opt('arms', 'plain,groundwork').split(',');
const ALL = fs.readdirSync(CASES).filter(d => fs.existsSync(path.join(CASES, d, 'case.json'))).sort();
const pick = opt('cases', 'all'), CASE_IDS = pick === 'all' ? ALL : ALL.filter(c => pick.split(',').some(p => c.startsWith(p)));
const OUT = path.resolve(opt('out', path.join(__dirname, 'results', `${new Date().toISOString().slice(0, 10)}-${MODEL}`)));
// The same words go to both arms. Tasks get this note because a headless run has nobody to answer questions or approve a gate.
const SUFFIX = '\n\nI am not available during this session, so don\'t wait for answers: make reasonable assumptions and write them down. '
  + 'If a plan or a gate needs my approval, my approval is: "Approved, go ahead." At the end, tell me what you did and whether it works.';
const TOOLS = ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'TodoWrite', 'Task', 'Agent', 'Bash(pwd)', ...['node', 'npm', 'python3', 'git', 'ls', 'cat', 'grep',
  'mkdir', 'find', 'head', 'tail', 'wc', 'diff', 'echo', 'printf', 'sed', 'cp', 'mv', 'touch', 'curl', 'cd', 'sort', 'test'].map(c => `Bash(${c}:*)`)];
const TESTRUN = /\b(npm (run )?test|npm t\b|node --test|python3? -m (unittest|pytest)|pytest)\b/;
const caseCfg = c => JSON.parse(fs.readFileSync(path.join(CASES, c, 'case.json'), 'utf8'));

// Every child gets a clean environment: no variables from the session that started this script, and a throwaway git identity.
function env(extra = {}) {
  const e = { ...process.env, ...extra, PYTHONDONTWRITEBYTECODE: '1', GIT_AUTHOR_NAME: 'bench', GIT_AUTHOR_EMAIL: 'bench@example.invalid',
    GIT_COMMITTER_NAME: 'bench', GIT_COMMITTER_EMAIL: 'bench@example.invalid' };
  for (const k of Object.keys(e)) if (/^CLAUDE/.test(k)) delete e[k];
  return e;
}
const sh = (cmd, args, cwd, extra) => { const r = cp.spawnSync(cmd, args, { cwd, env: env(extra), encoding: 'utf8', timeout: 300e3 }); return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }; };

function makeRepo(c, cfg, arm, root, gwHome) {
  const work = fs.mkdtempSync(path.join(root, `${c}-${arm}-`));
  fs.cpSync(path.join(CASES, cfg.repo || c, 'repo'), work, { recursive: true });
  const git = (...a) => cp.execFileSync('git', ['-c', 'commit.gpgsign=false', ...a], { cwd: work, env: env(), stdio: 'pipe', maxBuffer: 64e6 }).toString().trim();
  git('init', '-q'); git('add', '-A'); git('commit', '-qm', 'baseline');
  if (arm === 'groundwork') {
    fs.cpSync(FW, path.join(work, 'groundwork'), { recursive: true });
    const r = sh(process.execPath, ['groundwork/bin/gw.js', 'init'], work, { GW_HOME: gwHome });
    if (r.code !== 0) throw new Error('gw init failed: ' + r.out.slice(-500));
    git('add', '-A'); git('commit', '-qm', 'add groundwork');
  }
  return { work, git, base: git('rev-parse', 'HEAD') };
}

function hiddenTests(c, cfg, work, finalFile) {
  const file = path.join(CASES, c, cfg.hidden), extra = { FIXTURE: work, FINAL: finalFile || '' };
  const py = file.endsWith('.py');
  const r = py ? sh('python3', [file], path.dirname(file), extra) : sh(process.execPath, ['--test', '--test-reporter=spec', file], path.dirname(file), extra);
  let pass, fail;
  if (py) {
    const ran = +(r.out.match(/Ran (\d+) test/) || [0, 0])[1];
    fail = (r.out.match(/(?:failures|errors)=(\d+)/g) || []).reduce((a, m) => a + +m.split('=')[1], 0); pass = ran - fail;
  } else { pass = +(r.out.match(/ℹ pass (\d+)/) || [0, 0])[1]; fail = +(r.out.match(/ℹ fail (\d+)/) || [0, 0])[1]; }
  return { all: r.code === 0, pass, fail, out: r.out };
}

const FRAMEWORK = /^(groundwork|\.groundwork|\.claude)\/|^(CLAUDE|AGENTS)\.md$/;
const TESTS = /(^|\/)(test|tests|__tests__)\/|\.test\.[cm]?[jt]s$|(^|\/)test_[^/]*\.py$|_test\.py$/;
const TEST_DATA = /(^|\/)(fixtures?|__snapshots__|golden|snapshots?)\/|\.(snap|golden)$/;   // recorded inputs and outputs: test data, not test code
const kindOf = f => FRAMEWORK.test(f) ? 'framework'
  : TEST_DATA.test(f) || (TESTS.test(f) && !/\.(md|[cm]?[jt]sx?|py|sh)$/.test(f)) ? 'test_data'
  : TESTS.test(f) ? 'tests' : /\.md$/i.test(f) || /^docs\//.test(f) ? 'docs' : /\.([cm]?js|ts|py|sh)$/.test(f) ? 'source' : 'other';
function tally(entries) {   // [added, removed, file] per changed file
  const s = { source_files: 0, source_added: 0, source_removed: 0, test_files: 0, test_added: 0, test_data_files: 0, test_data_added: 0, docs_files: 0, docs_added: 0, other_files: 0, framework_files: 0 };
  for (const [add, del, f] of entries) {
    const k = kindOf(f);
    if (k === 'source') { s.source_files++; s.source_added += add; s.source_removed += del; }
    else if (k === 'tests') { s.test_files++; s.test_added += add; }
    else if (k === 'test_data') { s.test_data_files++; s.test_data_added += add; }
    else if (k === 'docs') { s.docs_files++; s.docs_added += add; }
    else s[k + '_files']++;
  }
  return s;
}
function codeStats(git, base) {
  git('add', '-A');
  return tally(git('diff', '--cached', '--numstat', base).split('\n').filter(Boolean).map(l => { const [a, d, f] = l.split('\t'); return [+a || 0, +d || 0, f]; }));
}
function patchEntries(patch) {   // the same [added, removed, file] list, from a saved diff.patch
  return patch.split(/^diff --git /m).slice(1).map(sec => {
    const f = (sec.match(/^\+\+\+ b\/(.*)$/m) || sec.match(/^a\/\S+ b\/(.*)$/m) || [])[1];
    let add = 0, del = 0;
    for (const l of sec.split('\n')) { if (l.startsWith('+') && !l.startsWith('+++')) add++; else if (l.startsWith('-') && !l.startsWith('---')) del++; }
    return [add, del, f];
  }).filter(e => e[2]);
}

function readTranscript(file) {
  const lines = (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '').split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const results = lines.filter(j => j.type === 'result');
  const last = results.reduce((a, r) => ((r.total_cost_usd || 0) >= (a.total_cost_usd || 0) ? r : a), {});   // the session total is the largest
  const uses = lines.filter(j => j.type === 'assistant').flatMap(j => ((j.message || {}).content || []).filter(x => x.type === 'tool_use'));
  const usage = Object.values(last.modelUsage || {}).reduce((a, m) => ({ input: a.input + (m.inputTokens || 0), cache_read: a.cache_read + (m.cacheReadInputTokens || 0),
    cache_write: a.cache_write + (m.cacheCreationInputTokens || 0), output: a.output + (m.outputTokens || 0) }), { input: 0, cache_read: 0, cache_write: 0, output: 0 });
  // a background subagent that finishes wakes the session again: each wake-up adds a result line. Cost, usage and API time
  // are running totals; turns and the answer belong to each line, so they are summed and joined.
  const denied = new Set(results.flatMap(r => (r.permission_denials || []).map(d => d.tool_use_id || JSON.stringify(d))));
  return { last, final: results.map(r => String(r.result || '')).join('\n\n'), uses, usage, turns: results.reduce((a, r) => a + (r.num_turns || 0), 0), denials: denied.size,
    bash: uses.filter(u => u.name === 'Bash').map(u => String((u.input || {}).command || '')),
    peeked: /bench\/cases|hidden(_test\.py|\.test\.js)/.test(JSON.stringify(uses.map(u => u.input))) };   // did the agent find the hidden tests?
}
const fromTranscript = t => ({
  result: t.last.subtype || 'none', api_seconds: Math.round((t.last.duration_api_ms || 0) / 1000), turns: t.turns,
  cost_usd: t.last.total_cost_usd != null ? +t.last.total_cost_usd.toFixed(4) : null, tokens: { ...t.usage, total: t.usage.input + t.usage.cache_read + t.usage.cache_write + t.usage.output },
  tool_calls: t.uses.length, subagents: t.uses.filter(x => x.name === 'Agent' || x.name === 'Task').length, denials: t.denials,
  test_runs: t.bash.filter(b => TESTRUN.test(b)).length, gw_calls: t.bash.filter(b => /groundwork\/bin\/gw\.js|(^|[\s;&|])(\.\/)?gw\s/.test(b)).length, peeked: t.peeked,
});

function spawnTo(cmd, args, { cwd, env: e, out, err, timeoutMs }) {
  return new Promise(resolve => {
    const o = fs.openSync(out, 'w'), x = fs.openSync(err, 'w');
    let timedOut = false, finished = false;
    const p = cp.spawn(cmd, args, { cwd, env: e, stdio: ['ignore', o, x], detached: true });
    const timer = setTimeout(() => { timedOut = true; try { process.kill(-p.pid, 'SIGKILL'); } catch { } }, timeoutMs);
    const end = code => { if (finished) return; finished = true; clearTimeout(timer); fs.closeSync(o); fs.closeSync(x); resolve({ code, timedOut }); };
    p.on('close', end); p.on('error', () => end(-1));
  });
}

async function runOne({ c, arm, rep }, root, gwHome) {
  const cfg = caseCfg(c), raw = path.join(OUT, 'raw', `${c}-${arm}-r${rep}`);
  fs.rmSync(raw, { recursive: true, force: true }); fs.mkdirSync(raw, { recursive: true });
  const { work, git, base } = makeRepo(c, cfg, arm, root, gwHome);
  const prompt = fs.readFileSync(path.join(CASES, c, 'prompt.txt'), 'utf8').trim() + (cfg.suffix === false ? '' : SUFFIX);
  const args = ['-p', prompt, '--model', MODEL, '--output-format', 'stream-json', '--verbose', '--setting-sources', 'project,local', '--strict-mcp-config',
    '--no-session-persistence', '--disable-slash-commands', '--permission-mode', 'acceptEdits', '--max-budget-usd', String(cfg.budget_usd || 5), '--allowedTools', ...TOOLS];
  const t0 = Date.now();
  const run = await spawnTo('claude', args, { cwd: work, env: env({ GW_HOME: gwHome }), out: path.join(raw, 'transcript.jsonl'), err: path.join(raw, 'stderr.txt'), timeoutMs: 45 * 60e3 });
  const seconds = Math.round((Date.now() - t0) / 1000), t = readTranscript(path.join(raw, 'transcript.jsonl'));
  const finalFile = path.join(raw, 'final.txt'); fs.writeFileSync(finalFile, t.final);
  const hidden = hiddenTests(c, cfg, work, finalFile); fs.writeFileSync(path.join(raw, 'hidden.txt'), hidden.out);
  const visible = cfg.visible ? sh(cfg.visible[0], cfg.visible.slice(1), work) : null;
  if (visible) fs.writeFileSync(path.join(raw, 'visible.txt'), visible.out);
  const code = codeStats(git, base);
  fs.writeFileSync(path.join(raw, 'diff.patch'), git('diff', '--cached', base, '--', '.', ':(exclude)groundwork'));
  fs.rmSync(work, { recursive: true, force: true });
  return {
    case: c, arm, rep, model: MODEL, groundwork: arm === 'groundwork' ? VERSION : null, at: new Date(t0).toISOString(), exit: run.code, timed_out: run.timedOut, seconds,
    ...fromTranscript(t), hidden: { all: hidden.all, pass: hidden.pass, fail: hidden.fail }, visible: visible ? visible.code === 0 : null, code,
  };
}

// --regrade: recompute the transcript fields and the diff counts of rows already in <out>/rows.jsonl (the tests can't be redone: the work folders are gone)
function regrade() {
  const file = path.join(OUT, 'rows.jsonl');
  const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).map(r => {
    const raw = path.join(OUT, 'raw', `${r.case}-${r.arm}-r${r.rep}`), patch = path.join(raw, 'diff.patch');
    const code = fs.existsSync(patch) ? { ...tally(patchEntries(fs.readFileSync(patch, 'utf8'))), framework_files: r.code.framework_files } : r.code;   // the patch leaves out groundwork/
    return { ...r, ...fromTranscript(readTranscript(path.join(raw, 'transcript.jsonl'))), code };
  });
  fs.writeFileSync(file, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  console.log(`regraded ${rows.length} rows in ${path.relative(ROOT, file)}`);
}

// --check: the visible tests pass at the start (a stub case may start red), the hidden tests fail before the work (pass for a refactor or a question),
// and a reference solution, where there is one, passes them. Also builds one Groundwork repo to prove the setup works.
function check() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-bench-check-')), gwHome = path.join(root, 'gwhome');
  fs.mkdirSync(gwHome); let bad = 0;
  for (const c of CASE_IDS) {
    const cfg = caseCfg(c), { work } = makeRepo(c, cfg, 'plain', root), fin = path.join(root, c + '-final.txt');
    fs.writeFileSync(fin, 'It exports applyDiscount and formatPrice.');
    const vis = cfg.visible ? sh(cfg.visible[0], cfg.visible.slice(1), work).code === 0 : null;
    const start = hiddenTests(c, cfg, work, fin), sol = path.join(CASES, c, 'solution');
    let withSol = null;
    if (fs.existsSync(sol)) { fs.cpSync(sol, work, { recursive: true }); withSol = hiddenTests(c, cfg, work, fin); }
    const ok = (vis === null || vis === !cfg.visible_fails_at_start) && start.all === !!cfg.hidden_passes_at_start && (!withSol || withSol.all);
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'BAD '} ${c.padEnd(22)} visible at start: ${vis ?? 'n/a'}  hidden at start: ${start.pass}/${start.pass + start.fail}`
      + (withSol ? `  with solution: ${withSol.pass}/${withSol.pass + withSol.fail}` : ''));
  }
  const { work } = makeRepo(CASE_IDS[0], caseCfg(CASE_IDS[0]), 'groundwork', root, gwHome);
  const gwOk = fs.existsSync(path.join(work, 'CLAUDE.md')) && fs.existsSync(path.join(work, '.claude', 'settings.json'));
  console.log(`${gwOk ? 'ok  ' : 'BAD '} groundwork arm: gw init wrote CLAUDE.md and .claude/settings.json`);
  fs.rmSync(root, { recursive: true, force: true });
  process.exit(bad || !gwOk ? 1 : 0);
}

async function main() {
  if (process.argv.includes('--check')) return check();
  if (process.argv.includes('--regrade')) return regrade();
  fs.mkdirSync(path.join(OUT, 'raw'), { recursive: true });
  const rowsFile = path.join(OUT, 'rows.jsonl');
  const have = new Set((fs.existsSync(rowsFile) ? fs.readFileSync(rowsFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : []).map(r => `${r.case}|${r.arm}|${r.rep}`));
  const todo = [];   // both arms of a case run side by side, so they meet the same API load
  for (let rep = 1; rep <= REPS; rep++) for (const c of CASE_IDS) for (const arm of ARMS) if (!have.has(`${c}|${arm}|${rep}`)) todo.push({ c, arm, rep });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-bench-')), gwHome = path.join(root, 'gwhome');
  fs.mkdirSync(gwHome); fs.writeFileSync(path.join(gwHome, 'config.json'), JSON.stringify({ trending: false }));
  // warm the host-scan cache once, like a machine that already uses Groundwork
  const warm = makeRepo(CASE_IDS[0], caseCfg(CASE_IDS[0]), 'groundwork', root, gwHome);
  sh(process.execPath, ['groundwork/bin/gw.js', 'doctor'], warm.work, { GW_HOME: gwHome });
  console.log(`${todo.length} runs: ${CASE_IDS.length} cases × ${ARMS.join(' and ')} × ${REPS} on ${MODEL}, ${JOBS} at a time → ${path.relative(ROOT, OUT)}`);
  let next = 0, done = 0;
  await Promise.all(Array.from({ length: Math.min(JOBS, todo.length) }, async () => {
    while (next < todo.length) {
      const job = todo[next++];
      try {
        const row = await runOne(job, root, gwHome);
        fs.appendFileSync(rowsFile, JSON.stringify(row) + '\n');
        console.log(`[${++done}/${todo.length}] ${job.c} ${job.arm} r${job.rep}: hidden ${row.hidden.pass}/${row.hidden.pass + row.hidden.fail}${row.hidden.all ? '' : ' FAIL'}`
          + `  $${row.cost_usd}  ${row.seconds}s  ${row.turns} turns  ${row.result}`);
      } catch (e) { console.log(`[${++done}/${todo.length}] ${job.c} ${job.arm} r${job.rep}: harness error: ${e.message}`); }
    }
  }));
  fs.rmSync(root, { recursive: true, force: true });
}
main();
