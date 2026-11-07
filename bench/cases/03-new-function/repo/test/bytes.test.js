const test = require('node:test'), assert = require('node:assert');
const { formatBytes } = require('../src/bytes');
test('bytes', () => assert.strictEqual(formatBytes(512), '512 B'));
test('exactly one KB', () => assert.strictEqual(formatBytes(1024), '1.0 KB'));
test('megabytes', () => assert.strictEqual(formatBytes(5 * 1024 * 1024), '5.0 MB'));
