const test = require('node:test'), assert = require('node:assert'), http = require('node:http');
const { createApp } = require('../src/app');
function start() { return new Promise(r => { const s = http.createServer(createApp()).listen(0, () => r(s)); }); }
async function call(s, method, url, body) {
  const res = await fetch('http://127.0.0.1:' + s.address().port + url, { method, body: body && JSON.stringify(body), headers: body ? { 'content-type': 'application/json' } : {} });
  return { status: res.status, type: res.headers.get('content-type'), text: await res.text() };
}
test('REQ-001 list notes', async () => { const s = await start(); const r = await call(s, 'GET', '/notes'); assert.strictEqual(r.status, 200); assert.deepStrictEqual(JSON.parse(r.text), []); s.close(); });
test('REQ-002 create a note', async () => { const s = await start(); const r = await call(s, 'POST', '/notes', { title: 'hi' }); assert.strictEqual(r.status, 201); assert.strictEqual(JSON.parse(r.text).title, 'hi'); s.close(); });
