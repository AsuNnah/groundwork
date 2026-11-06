const test = require('node:test'), assert = require('node:assert'), net = require('node:net'), { Client } = require('pg');
test('postgres service answers', async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL }); await c.connect();
  const r = await c.query('select 1 + 1 as two'); await c.end(); assert.equal(r.rows[0].two, 2);
});
test('redis service answers PING', async () => {
  const u = new URL(process.env.REDIS_URL);
  const reply = await new Promise((ok, bad) => { const s = net.connect(+u.port, u.hostname, () => s.write('PING\r\n')); s.on('data', d => { ok(String(d)); s.end(); }); s.on('error', bad); });
  assert.match(reply, /PONG/);
});
