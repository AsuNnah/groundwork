const test = require('node:test'), assert = require('node:assert'), http = require('node:http'), path = require('path');
const { createApp } = require(path.join(process.env.FIXTURE, 'src/app'));
function start() { return new Promise(r => { const s = http.createServer(createApp()).listen(0, () => r(s)); }); }
async function call(s, method, url, body) {
  const res = await fetch('http://127.0.0.1:' + s.address().port + url, { method, body: body && JSON.stringify(body), headers: body ? { 'content-type': 'application/json' } : {} });
  return { status: res.status, type: res.headers.get('content-type') || '', text: await res.text() };
}
const rows = t => t.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
test('empty export has only the header', async () => { const s = await start(); const r = await call(s, 'GET', '/notes.csv'); s.close();
  assert.strictEqual(r.status, 200); assert.match(r.type, /text\/csv/); assert.deepStrictEqual(rows(r.text), ['id,title,created_at']); });
test('one row per note, RFC 4180 quoting', async () => { const s = await start();
  await call(s, 'POST', '/notes', { title: 'plain' }); await call(s, 'POST', '/notes', { title: 'a, "quoted" one' });
  const r = await call(s, 'GET', '/notes.csv'); s.close();
  const t = r.text.replace(/\r\n/g, '\n');
  assert.ok(t.startsWith('id,title,created_at\n'), 'header');
  assert.match(t, /\n1,plain,\d{4}-/); assert.match(t, /\n2,"a, ""quoted"" one",\d{4}-/); });
test('JSON routes unchanged', async () => { const s = await start(); const r = await call(s, 'GET', '/notes'); s.close(); assert.strictEqual(r.status, 200); assert.match(r.type, /json/); });
