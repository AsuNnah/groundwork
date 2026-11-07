// HTTP handler for the team's file drop. createApp() returns a node:http request listener.
const fs = require('node:fs');
const path = require('node:path');

const UPLOADS = path.join(__dirname, '..', 'uploads');
const TYPES = { '.txt': 'text/plain', '.json': 'application/json' };

function createApp() {
  return (req, res) => {
    const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.method === 'GET' && req.url === '/files') {
      return fs.readdir(UPLOADS, (err, names) => (err ? send(500, { error: 'cannot list files' }) : send(200, names.filter(n => !n.startsWith('.')).sort())));
    }
    const m = req.method === 'GET' && /^\/files\/([^/]+)$/.exec(req.url);
    if (m) {
      let name;
      try { name = decodeURIComponent(m[1]); } catch { return send(400, { error: 'bad file name' }); }
      if (/[/\\\0]/.test(name) || name === '.' || name === '..') return send(400, { error: 'bad file name' });
      return fs.readFile(path.join(UPLOADS, name), (err, data) => {
        if (err) return ['ENOENT', 'EISDIR', 'ENOTDIR'].includes(err.code) ? send(404, { error: 'not found' }) : send(500, { error: 'cannot read file' });
        res.writeHead(200, { 'content-type': TYPES[path.extname(name).toLowerCase()] || 'application/octet-stream' });
        res.end(data);
      });
    }
    send(404, { error: 'not found' });
  };
}
module.exports = { createApp, UPLOADS };
