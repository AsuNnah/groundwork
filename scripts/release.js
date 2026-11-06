// node scripts/release.js : regenerate groundwork/MANIFEST.json (run before every commit that changes groundwork/)
'use strict';
const fs = require('fs');
const path = require('path');
const gw = require('../groundwork/bin/gw.js');
const dir = path.join(__dirname, '..', 'groundwork');
const m = gw.buildManifest(dir);
fs.writeFileSync(path.join(dir, 'MANIFEST.json'), JSON.stringify(m, null, 2) + '\n');
console.log(`MANIFEST.json: groundwork ${m.version}, ${Object.keys(m.files).length} files`);
require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'fixture-workflows.js')], { stdio: 'inherit' });   // their headers carry the version
