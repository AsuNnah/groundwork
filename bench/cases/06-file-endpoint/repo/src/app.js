// HTTP handler for the team's file drop. createApp() returns a node:http request listener.
const fs = require('node:fs');
const path = require('node:path');

const UPLOADS = path.join(__dirname, '..', 'uploads');

function createApp() {
  return (req, res) => {
    const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.method === 'GET' && req.url === '/files') {
      return fs.readdir(UPLOADS, (err, names) => (err ? send(500, { error: 'cannot list files' }) : send(200, names.filter(n => !n.startsWith('.')).sort())));
    }
    send(404, { error: 'not found' });
  };
}
module.exports = { createApp, UPLOADS };
