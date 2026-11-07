const test = require('node:test'), assert = require('node:assert'), path = require('path');
const { add, complete, render } = require(path.join(process.env.FIXTURE, 'src/todo'));
test('default priority is normal and old behaviour holds', () => assert.deepStrictEqual(render(add(add([], 'a'), 'b')), ['[ ] a', '[ ] b']));
test('high first, then normal, then low; stable inside a priority', () => {
  let l = add([], 'n1'); l = add(l, 'l1', { priority: 'low' }); l = add(l, 'h1', { priority: 'high' }); l = add(l, 'n2'); l = add(l, 'h2', { priority: 'high' });
  const r = render(l).map(s => s.replace(/^\[.\] /, ''));
  assert.deepStrictEqual(r.map(s => s.replace(/^!\s*/, '')), ['h1', 'h2', 'n1', 'n2', 'l1']);
  assert.ok(r[0].startsWith('!') && r[1].startsWith('!') && !r[2].startsWith('!'), 'high items are prefixed with !');
});
test('unknown priority rejected', () => assert.throws(() => add([], 'x', { priority: 'urgent' })));
test('complete still works with priorities', () => assert.ok(render(complete(add([], 'x', { priority: 'high' }), 0))[0].startsWith('[x]')));
test('input not mutated', () => { const l = add([], 'a'); add(l, 'b', { priority: 'high' }); assert.strictEqual(l.length, 1); });
