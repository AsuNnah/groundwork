const { app, BrowserWindow } = require('electron');
app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: true, width: 300, height: 200 });
  await w.loadURL('data:text/html,<h1 id=t>ok</h1>');
  const t = await w.webContents.executeJavaScript('document.getElementById("t").textContent');
  console.log('SMOKE ' + t); app.exit(t === 'ok' ? 0 : 1);
});
