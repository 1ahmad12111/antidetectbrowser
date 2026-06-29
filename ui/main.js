'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { create, load, setProxy, setCookiesFile, setStartupUrls, remove, listAll } = require('../src/profiles');
const { launch } = require('../src/browser');
const { detectProxyGeo } = require('../src/geo');
const { listPresets } = require('../src/presets');

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 900,
    minHeight: 500,
    title: 'Antidetect Browser',
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'index.html'));
  win.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── IPC Handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('profiles:list', () => listAll());
ipcMain.handle('profiles:presets', () => listPresets());

ipcMain.handle('profiles:create', async (_, opts) => {
  let geo = null;
  let timezone = opts.timezone || 'America/New_York';
  let language = opts.language || 'en-US';

  if (opts.proxy) {
    try {
      geo = await detectProxyGeo(opts.proxy);
      timezone = geo.timezone;
      language = geo.language;
    } catch (_) {}
  }

  return create({ ...opts, timezone, language, geo });
});

ipcMain.handle('profiles:launch', async (_, name, cookiesFile) => {
  const profile = load(name);
  await launch(profile, cookiesFile || null);
  return { ok: true };
});

ipcMain.handle('profiles:delete', (_, name) => {
  remove(name);
  return { ok: true };
});

ipcMain.handle('profiles:set-proxy', (_, name, proxy) => {
  return setProxy(name, proxy === 'none' ? null : proxy);
});

ipcMain.handle('profiles:set-urls', (_, name, urls) => {
  return setStartupUrls(name, urls);
});

ipcMain.handle('profiles:set-cookies', (_, name, file) => {
  return setCookiesFile(name, file || null);
});

ipcMain.handle('profiles:detect-geo', async (_, proxyUrl) => {
  return detectProxyGeo(proxyUrl);
});
