const http = require('node:http');
const { createApp } = require('./app');
const port = Number(process.env.PORT) || 3000;
http.createServer(createApp()).listen(port, () => console.log('file-drop on :' + port));
