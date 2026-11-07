// frontend check: the page the app window loads exists and has its heading
const fs = require('fs'), assert = require('assert');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'dist', 'index.html'), 'utf8');
assert.match(html, /<h1 id="greeting">Hello from Tauri<\/h1>/);
console.log('frontend ok');
