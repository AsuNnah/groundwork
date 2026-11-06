// starts the real Electron app (needs a display: CI runs it under xvfb-run on Linux) and checks it rendered
const { spawnSync } = require('child_process'), fs = require('fs'), path = require('path');
// diagnostic: Electron's postinstall downloads the binary; say so loudly if the package manager skipped or broke it
const dir = path.dirname(require.resolve('electron/package.json'));
if (!fs.existsSync(path.join(dir, 'path.txt'))) {
  console.log(`::warning::electron's postinstall did not leave a binary (npm ${process.env.npm_config_user_agent || '?'}); running it now to show why`);
  const r = spawnSync(process.execPath, ['install.js'], { cwd: dir, stdio: 'inherit', env: { ...process.env, DEBUG: '@electron/get*' } });
  if (r.status !== 0) process.exit(1);
}
const electron = require('electron');
const r = spawnSync(electron, ['.', ...(process.platform === 'linux' ? ['--no-sandbox'] : [])], { encoding: 'utf8', timeout: 60000 });
process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || '');
if (r.status !== 0 || !/SMOKE ok/.test(r.stdout)) { console.error('electron smoke failed, exit ' + r.status); process.exit(1); }
console.log('electron smoke ok');
