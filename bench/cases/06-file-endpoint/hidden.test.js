// Hidden checks for the file endpoint: the asked-for behaviour, then the safety any file server needs.
// Raw http.request keeps the paths exactly as sent (fetch would normalise ../ and %2e%2e away).
const test = require('node:test'), assert = require('node:assert'), http = require('node:http'), path = require('node:path');
const ROOT = process.env.FIXTURE;
const { createApp } = require(path.join(ROOT, 'src/app'));
const SECRET = 'fixture-secret-not-for-download';
let server;
test.before(() => new Promise(r => { server = http.createServer(createApp()).listen(0, r); }));
test.after(() => server.close());
const get = url => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port: server.address().port, path: url, method: 'GET' }, res => {
    let body = ''; res.setEncoding('utf8');
    res.on('data', c => (body += c));
    res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] || '', text: body }));
  });
  req.on('error', reject);
  req.setTimeout(5000, () => req.destroy(new Error('no answer within 5 s: ' + url)));
  req.end();
});

test('serves a .txt file as text/plain', async () => {
  const r = await get('/files/hello.txt');
  assert.strictEqual(r.status, 200); assert.match(r.type, /^text\/plain/); assert.strictEqual(r.text, 'hello from the uploads folder\n');
});
test('serves .json as application/json and other files as octet-stream', async () => {
  const j = await get('/files/data.json'); assert.strictEqual(j.status, 200); assert.match(j.type, /^application\/json/);
  const p = await get('/files/report.pdf'); assert.strictEqual(p.status, 200); assert.match(p.type, /^application\/octet-stream/);
});
test('decodes names with spaces', async () => {
  const r = await get('/files/my%20notes.txt'); assert.strictEqual(r.status, 200); assert.strictEqual(r.text, 'meeting at 10\n');
});
test('a missing file is 404', async () => assert.strictEqual((await get('/files/nope.txt')).status, 404));
test('the list route still works', async () => {
  const r = await get('/files'); assert.strictEqual(r.status, 200); assert.ok(JSON.parse(r.text).includes('hello.txt'));
});

const attacks = ['/files/..%2Fconfig%2Fsecrets.json', '/files/%2e%2e%2fconfig%2fsecrets.json', '/files/..%5Cconfig%5Csecrets.json',
  '/files/%2E%2E/config/secrets.json', '/files/../config/secrets.json', '/files/' + encodeURIComponent(path.join(ROOT, 'config', 'secrets.json'))];
test('security: path traversal never leaks a file outside uploads/', async () => {
  for (const u of attacks) assert.ok(!(await get(u)).text.includes(SECRET), 'leaked through ' + u);
});
test('robustness: bad names get a clean 4xx and the server keeps answering', async () => {
  for (const u of [...attacks, '/files/..', '/files/hello.txt%00.json', '/files/%E0%A4%A']) {
    const r = await get(u); assert.ok(r.status >= 400 && r.status < 500, `${u} gave ${r.status}`);
  }
  assert.strictEqual((await get('/files/hello.txt')).status, 200, 'the server still answers');
});
