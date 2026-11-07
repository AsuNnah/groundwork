#!/usr/bin/env node
// Reference solution for the benchmark's bookmark CLI case (used only to check the hidden tests).
const fs = require('node:fs'), path = require('node:path');
const FILE = process.env.BM_FILE || path.join(process.cwd(), 'bookmarks.json');
const fail = msg => { process.stderr.write('error: ' + msg + '\n'); process.exit(1); };
const load = () => {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return { next: 1, items: [] }; return fail('cannot read ' + FILE); }
};
const save = db => fs.writeFileSync(FILE, JSON.stringify(db, null, 2) + '\n');
function tags(args) {
  const t = [];
  for (let i = 0; i < args.length; i++) { if (args[i] === '--tag' && args[i + 1]) t.push(args[++i]); else fail('unexpected argument: ' + args[i]); }
  return t;
}
const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'add') {
  const url = rest[0];
  if (!url || url.startsWith('--')) fail('usage: bm.js add <url> [--tag <tag>]...');
  let u; try { u = new URL(url); } catch { fail('not a url: ' + url); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') fail('only http and https urls: ' + url);
  const t = tags(rest.slice(1)), db = load(), found = db.items.find(b => b.url === url);
  if (found) { for (const x of t) if (!found.tags.includes(x)) found.tags.push(x); } else db.items.push({ id: db.next++, url, tags: [...new Set(t)], added: new Date().toISOString() });
  save(db);
} else if (cmd === 'list') {
  const t = tags(rest), db = load();
  for (const b of db.items) if (t.every(x => b.tags.includes(x))) console.log(`${b.id} ${b.url} [${b.tags.join(', ')}]`);
} else if (cmd === 'rm') {
  const db = load(), i = db.items.findIndex(b => String(b.id) === rest[0]);
  if (i < 0) fail('no bookmark with id ' + rest[0]);
  db.items.splice(i, 1); save(db);
} else fail(cmd ? 'unknown command: ' + cmd : 'usage: bm.js add|list|rm');
