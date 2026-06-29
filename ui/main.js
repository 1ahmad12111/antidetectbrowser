'use strict';

const { app, BrowserWindow, ipcMain, clipboard } = require('electron');
const path = require('path');
const http = require('http');

const { create, load, setProxy, setCookiesFile, setStartupUrls, setNotes, duplicate, remove, listAll } = require('../src/profiles');
const { launch, setProcessRegistry } = require('../src/browser');
const { detectProxyGeo } = require('../src/geo');
const { listPresets } = require('../src/presets');
const { injectCookiesFromText } = require('../src/cookies');

// Fix 3: process registry — tracks which profiles are currently running
const runningProfiles = new Map(); // name → { child, debugPort, pid }
setProcessRegistry(runningProfiles);

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 720,
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

// Fix 3: return list of currently running profile names
ipcMain.handle('profiles:running', () => Array.from(runningProfiles.keys()));

ipcMain.handle('profiles:create', async (_, opts) => {
  let geo = null;
  let timezone = opts.timezone || 'America/New_York';
  let language = opts.language || 'en-US';
  if (opts.proxy) {
    try {
      geo = await Promise.race([
        detectProxyGeo(opts.proxy),
        new Promise((_, rej) => setTimeout(() => rej(new Error('geo timeout')), 8000)),
      ]);
      timezone = geo.timezone;
      language = geo.language;
    } catch (_) {}
  }
  return create({ ...opts, timezone, language, geo });
});

ipcMain.handle('profiles:launch', async (_, name, cookiesFile) => {
  if (runningProfiles.has(name)) return { ok: true, already: true };
  const profile = load(name);
  const result = await launch(profile, cookiesFile || null);
  return { ok: true, ...result };
});

// Fix 3: close a specific running profile
ipcMain.handle('profiles:close', (_, name) => {
  const entry = runningProfiles.get(name);
  if (entry) {
    try { entry.kill(); } catch (_) {}
    runningProfiles.delete(name);
  }
  return { ok: true };
});

// QoL 4: launch all profiles
ipcMain.handle('profiles:launch-all', async () => {
  const all = listAll();
  const results = [];
  for (const p of all) {
    if (runningProfiles.has(p.name)) { results.push({ name: p.name, skipped: true }); continue; }
    try {
      await launch(p);
      results.push({ name: p.name, ok: true });
    } catch (e) {
      results.push({ name: p.name, error: e.message });
    }
  }
  return results;
});

// QoL 4: close all running profiles
ipcMain.handle('profiles:close-all', () => {
  for (const [name, child] of runningProfiles.entries()) {
    try { child.kill(); } catch (_) {}
  }
  runningProfiles.clear();
  return { ok: true };
});

ipcMain.handle('profiles:delete', (_, name) => {
  const entry = runningProfiles.get(name);
  if (entry) { try { entry.kill(); } catch (_) {} runningProfiles.delete(name); }
  remove(name);
  return { ok: true };
});

ipcMain.handle('profiles:set-proxy', (_, name, proxy) => setProxy(name, proxy === 'none' ? null : proxy));
ipcMain.handle('profiles:set-urls',  (_, name, urls) => setStartupUrls(name, urls));
ipcMain.handle('profiles:set-cookies', (_, name, file) => setCookiesFile(name, file || null));
ipcMain.handle('profiles:set-notes', (_, name, notes) => setNotes(name, notes));        // QoL 3
ipcMain.handle('profiles:duplicate', (_, name, newName) => duplicate(name, newName));   // QoL 1

ipcMain.handle('profiles:detect-geo', async (_, proxyUrl) => detectProxyGeo(proxyUrl));

// QoL 2: test proxy — connect through it and return exit IP + latency
ipcMain.handle('profiles:test-proxy', async (_, proxyUrl) => {
  const start = Date.now();
  try {
    const geo = await detectProxyGeo(proxyUrl);
    return { ok: true, ip: geo.ip, city: geo.city, country: geo.country, ms: Date.now() - start };
  } catch (e) {
    return { ok: false, error: e.message, ms: Date.now() - start };
  }
});

// QoL 5: test all proxies in background — returns map of proxy → result
ipcMain.handle('profiles:health-check', async () => {
  const all = listAll();
  const proxies = [...new Set(all.map(p => p.proxy).filter(Boolean))];
  const results = {};
  await Promise.all(proxies.map(async proxy => {
    const start = Date.now();
    try {
      const geo = await detectProxyGeo(proxy);
      results[proxy] = { ok: true, ip: geo.ip, country: geo.countryCode, ms: Date.now() - start };
    } catch (e) {
      results[proxy] = { ok: false, ms: Date.now() - start };
    }
  }));
  return results;
});

// QoL 6: inject cookies from clipboard into a running profile
ipcMain.handle('profiles:inject-clipboard-cookies', async (_, name) => {
  const entry = runningProfiles.get(name);
  if (!entry) return { ok: false, error: 'Profile is not running' };
  const text = clipboard.readText();
  if (!text) return { ok: false, error: 'Clipboard is empty' };
  try {
    const count = await injectCookiesFromText(entry.debugPort, text);
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
