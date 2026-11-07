// The question case: the answer names both exports, and no project file changed.
const test = require('node:test'), assert = require('node:assert'), fs = require('node:fs'), cp = require('node:child_process');
const final = fs.readFileSync(process.env.FINAL, 'utf8');
test('the answer names both exports', () => { assert.match(final, /applyDiscount/); assert.match(final, /formatPrice/); });
test('no project file changed', () => {
  const st = cp.execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: process.env.FIXTURE, encoding: 'utf8' });
  const changed = st.split('\n').filter(Boolean).map(l => l.slice(3)).filter(f => !/^(\.groundwork\/|groundwork\/|\.claude\/|CLAUDE\.md$)/.test(f));
  assert.deepStrictEqual(changed, []);
});
