const test = require('node:test'), assert = require('node:assert'), http = require('node:http');
const { createApp } = require('../src/app');

test('GET /files lists the uploads folder', async () => {
  const s = await new Promise(r => { const srv = http.createServer(createApp()).listen(0, () => r(srv)); });
  const res = await fetch(`http://127.0.0.1:${s.address().port}/files`);
  const names = await res.json();
  s.close();
  assert.strictEqual(res.status, 200);
  assert.ok(names.includes('hello.txt'));
});
