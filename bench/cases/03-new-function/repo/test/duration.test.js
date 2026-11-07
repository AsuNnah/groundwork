const test = require('node:test'), assert = require('node:assert');
const { parseDuration } = require('../src/duration');
test('seconds', () => assert.strictEqual(parseDuration('90s'), 90));
