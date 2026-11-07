// Request handler: in-memory note store. createApp() returns a node:http request listener.
function createApp() {
  const notes = [];
  let next = 1;
  return (req, res) => {
    const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.method === 'GET' && req.url === '/notes') return send(200, notes);
    if (req.method === 'POST' && req.url === '/notes') {
      let raw = '';
      req.on('data', c => (raw += c));
      req.on('end', () => {
        let body; try { body = JSON.parse(raw || '{}'); } catch { return send(400, { error: 'invalid JSON' }); }
        if (typeof body.title !== 'string' || !body.title.trim()) return send(400, { error: 'title required' });
        const note = { id: next++, title: body.title.trim(), created_at: new Date().toISOString() };
        notes.push(note);
        send(201, note);
      });
      return;
    }
    send(404, { error: 'not found' });
  };
}
module.exports = { createApp };
