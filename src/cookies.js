'use strict';

const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

// Wait for Chrome's remote debugging port to be ready
function waitForChrome(port, retries = 20) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    function attempt() {
      http.get(`http://127.0.0.1:${port}/json`, (res) => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Could not parse Chrome debug JSON')); }
        });
      }).on('error', () => {
        if (++attempts >= retries) return reject(new Error('Chrome did not start in time'));
        setTimeout(attempt, 500);
      });
    }
    attempt();
  });
}

// Open a CDP WebSocket to the first available page target
async function openCDPSession(port) {
  const pages = await waitForChrome(port);
  const target = pages.find(p => p.type === 'page') || pages[0];
  if (!target?.webSocketDebuggerUrl) throw new Error('No debuggable page found in Chrome');

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

// Send a single CDP command and wait for its response
function sendCDP(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Date.now() + Math.random(); // unique per call
    ws.send(JSON.stringify({ id, method, params }));
    const handler = (msg) => {
      const data = JSON.parse(msg);
      if (data.id === id) {
        ws.off('message', handler);
        data.error ? reject(new Error(data.error.message)) : resolve(data.result);
      }
    };
    ws.on('message', handler);
  });
}

// Load cookies JSON — supports Cookie-Editor / EditThisCookie JSON export format
function loadCookiesFile(cookiesPath) {
  const raw = fs.readFileSync(cookiesPath, 'utf8');
  const parsed = JSON.parse(raw);
  return parsed.map(c => {
    const cookie = { name: c.name, value: c.value || '', domain: c.domain, path: c.path || '/' };
    if (c.secure !== undefined)      cookie.secure   = Boolean(c.secure);
    if (c.httpOnly !== undefined)    cookie.httpOnly = Boolean(c.httpOnly);
    if (c.sameSite)                  cookie.sameSite = c.sameSite;
    if (c.expirationDate)            cookie.expires  = Math.floor(c.expirationDate);
    if (typeof c.expires === 'number') cookie.expires = Math.floor(c.expires);
    return cookie;
  });
}

// Run all CDP injections in a single session: timezone, geolocation, cookies
async function injectAll(port, { timezone, lat, lon, cookiesPath }) {
  const ws = await openCDPSession(port);
  try {
    // Fix 1 — Timezone via CDP (replaces the fake --timezone flag)
    if (timezone) {
      await sendCDP(ws, 'Emulation.setTimezoneOverride', { timezoneId: timezone });
      console.log(`  Timezone locked: ${timezone}`);
    }

    // Geolocation
    if (lat != null && lon != null) {
      await sendCDP(ws, 'Emulation.setGeolocationOverride', { latitude: lat, longitude: lon, accuracy: 10 });
      console.log(`  Geolocation locked: ${lat}, ${lon}`);
    }

    // Cookies
    if (cookiesPath && fs.existsSync(cookiesPath)) {
      const cookies = loadCookiesFile(cookiesPath);
      await sendCDP(ws, 'Network.enable');
      await sendCDP(ws, 'Network.setCookies', { cookies });
      console.log(`  Injected ${cookies.length} cookies`);
    } else if (cookiesPath) {
      console.warn(`  [warn] Cookies file not found: ${cookiesPath}`);
    }
  } finally {
    ws.close();
  }
}

// Inject cookies from a raw JSON string (clipboard paste — QoL 6)
async function injectCookiesFromText(port, jsonText) {
  const ws = await openCDPSession(port);
  try {
    const cookies = JSON.parse(jsonText).map(c => ({
      name: c.name, value: c.value || '', domain: c.domain, path: c.path || '/',
      ...(c.secure !== undefined    ? { secure: Boolean(c.secure) }   : {}),
      ...(c.httpOnly !== undefined  ? { httpOnly: Boolean(c.httpOnly) } : {}),
      ...(c.sameSite                ? { sameSite: c.sameSite }         : {}),
      ...(c.expirationDate          ? { expires: Math.floor(c.expirationDate) } : {}),
    }));
    await sendCDP(ws, 'Network.enable');
    await sendCDP(ws, 'Network.setCookies', { cookies });
    console.log(`  Injected ${cookies.length} cookies from clipboard`);
    return cookies.length;
  } finally {
    ws.close();
  }
}

module.exports = { injectAll, injectCookiesFromText, waitForChrome };
