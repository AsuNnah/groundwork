#!/usr/bin/env node
// Summarises benchmark rows into markdown tables: node bench/report.js bench/results/<dir> [...more dirs]
// Prints the tables and writes <first dir>/summary.md. Medians per case and arm; totals add up every run.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const dirs = process.argv.slice(2);
if (!dirs.length) { console.error('usage: node bench/report.js bench/results/<dir> [...]'); process.exit(2); }
const rows = dirs.flatMap(d => fs.readFileSync(path.join(d, 'rows.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)));
const ARMS = ['plain', 'groundwork'], NAME = { plain: 'Plain', groundwork: 'Groundwork' };
const med = a => { const s = a.filter(x => x != null).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const sum = a => a.reduce((x, y) => x + (y || 0), 0);
const delta = (g, p) => (p ? `${g >= p ? '+' : '−'}${Math.abs(Math.round(100 * (g - p) / p))}%` : 'n/a');
const usd = x => (x == null ? '–' : '$' + (x < 1 ? x.toFixed(3) : x.toFixed(2)));
const tok = x => (x == null ? '–' : x >= 1e6 ? (x / 1e6).toFixed(2) + 'M' : x >= 1e4 ? Math.round(x / 1e3) + 'k' : x >= 1e3 ? (x / 1e3).toFixed(1) + 'k' : String(Math.round(x)));
const secs = x => (x == null ? '–' : x >= 90 ? (x / 60).toFixed(1) + ' min' : Math.round(x) + ' s');
const range = (a, f) => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? `${f(s[0])}–${f(s[s.length - 1])}` : '–'; };
const out = [];
const p = s => out.push(s);

for (const model of [...new Set(rows.map(r => r.model))]) {
  const R = rows.filter(r => r.model === model), cases = [...new Set(R.map(r => r.case))].sort();
  const title = c => JSON.parse(fs.readFileSync(path.join(__dirname, 'cases', c, 'case.json'), 'utf8')).title;
  const cell = (c, a) => R.filter(r => r.case === c && r.arm === a);
  const tests = c => Math.max(...R.filter(r => r.case === c).map(r => r.hidden.pass + r.hidden.fail));
  const passed = rs => `${rs.filter(r => r.hidden.all).length}/${rs.length}`;
  const share = (rs, c) => Math.round(100 * sum(rs.map(r => r.hidden.pass)) / (rs.length * tests(c)));
  const reps = Math.max(...R.map(r => r.rep)), version = (R.find(r => r.groundwork) || {}).groundwork;
  p(`### ${model}: ${R.length} runs, ${cases.length} cases × 2 arms × up to ${reps} runs (Groundwork ${version})\n`);

  p('**Correctness, cost and time per case** (medians; hidden tests are tests the agent never saw)\n');
  p('| Case | All hidden tests passed: plain | Groundwork | Cost: plain | Groundwork | Δ | Time: plain | Groundwork | Δ |');
  p('|---|---|---|---|---|---|---|---|---|');
  for (const c of cases) {
    const [a, b] = ARMS.map(x => cell(c, x)), ca = med(a.map(r => r.cost_usd)), cb = med(b.map(r => r.cost_usd)), ta = med(a.map(r => r.seconds)), tb = med(b.map(r => r.seconds));
    const pf = (rs) => `${passed(rs)}` + (rs.every(r => r.hidden.all) ? '' : ` (${share(rs, c)}% of tests)`);
    p(`| ${title(c)} | ${pf(a)} | ${pf(b)} | ${usd(ca)} | ${usd(cb)} | ${delta(cb, ca)} | ${secs(ta)} | ${secs(tb)} | ${delta(tb, ta)} |`);
  }
  const all = a => R.filter(r => r.arm === a);
  const [A, B] = ARMS.map(all);
  p(`| **All runs** | **${passed(A)}** | **${passed(B)}** | **${usd(sum(A.map(r => r.cost_usd)))}** total | **${usd(sum(B.map(r => r.cost_usd)))}** total | **${delta(sum(B.map(r => r.cost_usd)), sum(A.map(r => r.cost_usd)))}** | **${secs(sum(A.map(r => r.seconds)))}** total | **${secs(sum(B.map(r => r.seconds)))}** total | **${delta(sum(B.map(r => r.seconds)), sum(A.map(r => r.seconds)))}** |\n`);

  p('**Tokens per case** (medians; total = fresh input + cache writes + cache reads + output)\n');
  p('| Case | Total: plain | Groundwork | Δ | Cache writes: plain | Groundwork | Output: plain | Groundwork | Turns: plain | Groundwork |');
  p('|---|---|---|---|---|---|---|---|---|---|');
  for (const c of cases) {
    const [a, b] = ARMS.map(x => cell(c, x)), m = (rs, f) => med(rs.map(f));
    p(`| ${title(c)} | ${tok(m(a, r => r.tokens.total))} | ${tok(m(b, r => r.tokens.total))} | ${delta(m(b, r => r.tokens.total), m(a, r => r.tokens.total))} | ${tok(m(a, r => r.tokens.cache_write))} | ${tok(m(b, r => r.tokens.cache_write))} | ${tok(m(a, r => r.tokens.output))} | ${tok(m(b, r => r.tokens.output))} | ${m(a, r => r.turns)} | ${m(b, r => r.turns)} |`);
  }
  p(`| **All runs (sum)** | **${tok(sum(A.map(r => r.tokens.total)))}** | **${tok(sum(B.map(r => r.tokens.total)))}** | **${delta(sum(B.map(r => r.tokens.total)), sum(A.map(r => r.tokens.total)))}** | ${tok(sum(A.map(r => r.tokens.cache_write)))} | ${tok(sum(B.map(r => r.tokens.cache_write)))} | ${tok(sum(A.map(r => r.tokens.output)))} | ${tok(sum(B.map(r => r.tokens.output)))} | ${sum(A.map(r => r.turns))} | ${sum(B.map(r => r.turns))} |\n`);

  p('**What the agent left behind** (medians per run, lines added; tests and docs written by the agent)\n');
  p('| Case | Code lines: plain | Groundwork | Test lines: plain | Groundwork | Doc files: plain | Groundwork | Ran tests: plain | Groundwork | Subagents: plain | Groundwork | Permission prompts: plain | Groundwork |');
  p('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of cases) {
    const [a, b] = ARMS.map(x => cell(c, x)), m = (rs, f) => med(rs.map(f)), ran = rs => `${rs.filter(r => r.test_runs > 0).length}/${rs.length}`;
    p(`| ${title(c)} | ${m(a, r => r.code.source_added)} | ${m(b, r => r.code.source_added)} | ${m(a, r => r.code.test_added)} | ${m(b, r => r.code.test_added)} | ${m(a, r => r.code.docs_files)} | ${m(b, r => r.code.docs_files)} | ${ran(a)} | ${ran(b)} | ${m(a, r => r.subagents)} | ${m(b, r => r.subagents)} | ${m(a, r => r.denials)} | ${m(b, r => r.denials)} |`);
  }
  p(`| **All runs (sum)** | ${sum(A.map(r => r.code.source_added))} | ${sum(B.map(r => r.code.source_added))} | ${sum(A.map(r => r.code.test_added))} | ${sum(B.map(r => r.code.test_added))} | ${sum(A.map(r => r.code.docs_files))} | ${sum(B.map(r => r.code.docs_files))} | ${A.filter(r => r.test_runs > 0).length}/${A.length} | ${B.filter(r => r.test_runs > 0).length}/${B.length} | ${sum(A.map(r => r.subagents))} | ${sum(B.map(r => r.subagents))} | ${sum(A.map(r => r.denials))} | ${sum(B.map(r => r.denials))} |`);
  const data = rs => { const d = rs.filter(r => (r.code.test_data_added || 0) > 0); return d.length ? `${sum(d.map(r => r.code.test_data_added))} lines in ${d.length} of ${rs.length} runs` : 'none'; };
  p(`\nTest lines are test code. Recorded test data (fixtures, golden files, snapshots) is counted apart: plain ${data(A)}, Groundwork ${data(B)}.`);
  p('\nPermission prompts are tool calls that this run\'s allowlist refused (mostly compound shell commands). In an interactive session each one asks you first.\n');
  p('**Spread** (cost and time, lowest–highest run)\n');
  p('| Case | Cost: plain | Groundwork | Time: plain | Groundwork |');
  p('|---|---|---|---|---|');
  for (const c of cases) { const [a, b] = ARMS.map(x => cell(c, x)); p(`| ${title(c)} | ${range(a.map(r => r.cost_usd), usd)} | ${range(b.map(r => r.cost_usd), usd)} | ${range(a.map(r => r.seconds), secs)} | ${range(b.map(r => r.seconds), secs)} |`); }
  const redOk = c => !!JSON.parse(fs.readFileSync(path.join(__dirname, 'cases', c, 'case.json'), 'utf8')).visible_fails_at_start;   // a fixture with a known unrelated red test
  const odd = R.filter(r => r.timed_out || r.result !== 'success' || r.peeked || (r.visible === false && !redOk(r.case)));
  p(`\n**Runs to look at** (${odd.length}): ` + (odd.map(r => `${r.case} ${r.arm} r${r.rep}: ${[r.timed_out && 'timed out', r.result !== 'success' && 'ended ' + r.result, r.peeked && 'touched the hidden tests', r.visible === false && 'visible tests fail'].filter(Boolean).join(', ')}`).join('; ') || 'none') + '\n');
}
const md = out.join('\n');
console.log(md);
fs.writeFileSync(path.join(dirs[0], 'summary.md'), `# Benchmark summary\n\nGenerated by \`node bench/report.js\` from rows.jsonl.\n\n${md}\n`);
