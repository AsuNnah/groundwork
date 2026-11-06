const test = require('node:test'), assert = require('node:assert'), m = require('./extension/manifest.json');
test('manifest is MV3', () => assert.equal(m.manifest_version, 3));
