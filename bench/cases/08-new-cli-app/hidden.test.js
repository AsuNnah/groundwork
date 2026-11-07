// Hidden checks for the bookmark CLI, run the way a user runs it.
const test = require('node:test'), assert = require('node:assert'), cp = require('node:child_process'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const BM = path.join(process.env.FIXTURE, 'bm.js');
const norm = l => l.trimEnd().replace(/^(\d+ \S+?)\/( \[)/, '$1$2');   // a url normalised to end in "/" is fine
function session() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-hidden-')), file = path.join(dir, 'store.json');
  const run = (...args) => { const r = cp.spawnSync(process.execPath, [BM, ...args], { cwd: dir, env: { ...process.env, BM_FILE: file }, encoding: 'utf8', timeout: 20000 }); return { code: r.status, out: r.stdout || '', err: r.stderr || '' }; };
  return { run, list: (...a) => run('list', ...a).out.split('\n').map(norm).filter(Boolean) };
}

test('add and list', () => { const s = session(); assert.strictEqual(s.run('add', 'https://a.example').code, 0); assert.deepStrictEqual(s.list(), ['1 https://a.example []']); });
test('tags print in the order given', () => { const s = session(); s.run('add', 'https://a.example', '--tag', 'news', '--tag', 'tech'); assert.deepStrictEqual(s.list(), ['1 https://a.example [news, tech]']); });
test('oldest first with increasing ids', () => { const s = session(); s.run('add', 'https://a.example'); s.run('add', 'http://b.example'); assert.deepStrictEqual(s.list(), ['1 https://a.example []', '2 http://b.example []']); });
test('adding a saved url merges new tags instead of duplicating', () => {
  const s = session(); s.run('add', 'https://a.example', '--tag', 'x'); s.run('add', 'https://a.example', '--tag', 'y'); s.run('add', 'https://a.example', '--tag', 'x');
  assert.deepStrictEqual(s.list(), ['1 https://a.example [x, y]']);
});
test('ids are never reused', () => {
  const s = session(); s.run('add', 'https://a.example'); s.run('add', 'https://b.example');
  assert.strictEqual(s.run('rm', '2').code, 0); s.run('add', 'https://c.example');
  assert.deepStrictEqual(s.list(), ['1 https://a.example []', '3 https://c.example []']);
});
test('list --tag filters', () => { const s = session(); s.run('add', 'https://a.example', '--tag', 'x'); s.run('add', 'https://b.example', '--tag', 'y'); assert.deepStrictEqual(s.list('--tag', 'y'), ['2 https://b.example [y]']); });
test('an empty list prints nothing', () => { const r = session().run('list'); assert.strictEqual(r.code, 0); assert.strictEqual(r.out.trim(), ''); });
test('only http and https; errors go to stderr with exit code 1', () => {
  const s = session();
  for (const bad of [['add', 'ftp://a.example'], ['add', 'not a url'], ['add'], ['rm', '9'], ['frobnicate']]) {
    const r = s.run(...bad); assert.strictEqual(r.code, 1, bad.join(' ')); assert.ok(r.err.trim(), 'stderr message for: ' + bad.join(' '));
  }
  assert.deepStrictEqual(s.list(), [], 'nothing saved by the failed commands');
});
test('without BM_FILE it writes bookmarks.json in the current folder, as valid JSON', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-hidden-')), env = { ...process.env }; delete env.BM_FILE;
  const r = cp.spawnSync(process.execPath, [BM, 'add', 'https://a.example'], { cwd: dir, env, encoding: 'utf8', timeout: 20000 });
  assert.strictEqual(r.status, 0, r.stderr); JSON.parse(fs.readFileSync(path.join(dir, 'bookmarks.json'), 'utf8'));
});
