const test = require('node:test'), assert = require('node:assert'), path = require('path');
const { parseDuration } = require(path.join(process.env.FIXTURE, 'src/duration'));
const ok = { '1h30m': 5400, '2h': 7200, '45m': 2700, '90s': 90, '1h2m3s': 3723, '30': 30, '  10m ': 600 };
for (const [k, v] of Object.entries(ok)) test('parses ' + JSON.stringify(k), () => assert.strictEqual(parseDuration(k), v));
for (const bad of ['', '1x', 'h', '-5', 'abc', '1h-2m']) test('rejects ' + JSON.stringify(bad), () => assert.throws(() => parseDuration(bad)));
