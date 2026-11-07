const test = require('node:test'), assert = require('node:assert');
const { add, complete, render } = require('../src/todo');
test('add and render', () => assert.deepStrictEqual(render(add(add([], 'a'), 'b')), ['[ ] a', '[ ] b']));
test('complete', () => assert.deepStrictEqual(render(complete(add([], 'a'), 0)), ['[x] a']));
test('empty text rejected', () => assert.throws(() => add([], '  ')));
