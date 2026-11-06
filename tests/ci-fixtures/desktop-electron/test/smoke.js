// starts the real Electron app (needs a display: CI runs it under xvfb-run on Linux) and checks it rendered
const { spawnSync } = require('child_process'), electron = require('electron');
const r = spawnSync(electron, ['.', ...(process.platform === 'linux' ? ['--no-sandbox'] : [])], { encoding: 'utf8', timeout: 60000 });
process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || '');
if (r.status !== 0 || !/SMOKE ok/.test(r.stdout)) { console.error('electron smoke failed, exit ' + r.status); process.exit(1); }
console.log('electron smoke ok');
