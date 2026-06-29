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

// Send a single CDP command and wait for its response
function sendCDP(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Date.now();
    ws.send(JSON.stringify({ id, method, params }));
    ws.on('message', function handler(msg) {
      const data = JSON.parse(msg);
      if (data.id === id) {
        ws.off('message', handler);
        data.error ? reject(new Error(data.error.message)) : resolve(data.result);
      }
    });
  });
}

// Load cookies JSON — supports both Cookie-Editor format and Netscape/EditThisCookie format
function loadCookiesFile(cookiesPath) {
  const raw = fs.readFileSync(cookiesPath, 'utf8');
  const parsed = JSON.parse(raw);

  // Normalize to CDP Network.CookieParam format
  return parsed.map(c => {
    const cookie = {
      name: c.name,
      value: c.value || '',
      domain: c.domain,
      path: c.path || '/',
    };
    if (c.secure !== undefined) cookie.secure = Boolean(c.secure);
    if (c.httpOnly !== undefined) cookie.httpOnly = Boolean(c.httpOnly);
    if (c.sameSite) cookie.sameSite = c.sameSite; // Strict | Lax | None
    if (c.expirationDate) cookie.expires = Math.floor(c.expirationDate); // Unix timestamp
    if (c.expires && typeof c.expires === 'number') cookie.expires = Math.floor(c.expires);
    return cookie;
  });
}

// Inject geolocation override into all open pages via CDP
async function injectGeolocation(port, lat, lon) {
  const pages = await waitForChrome(port);
  const target = pages.find(p => p.type === 'page') || pages[0];
  if (!target || !target.webSocketDebuggerUrl) return;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.on('open', async () => {
      try {
        await sendCDP(ws, 'Emulation.setGeolocationOverride', {
          latitude: lat,
          longitude: lon,
          accuracy: 10,
        });
        ws.close();
        resolve();
      } catch (err) {
        ws.close();
        reject(err);
      }
    });
    ws.on('error', reject);
  });
}

// Inject cookies into a running Chrome instance via CDP
async function injectCookies(port, cookiesPath) {
  if (!fs.existsSync(cookiesPath)) {
    throw new Error(`Cookies file not found: ${cookiesPath}`);
  }

  const cookies = loadCookiesFile(cookiesPath);
  console.log(`  Injecting ${cookies.length} cookies from ${cookiesPath}...`);

  // Get the WebSocket debugger URL from Chrome
  const pages = await waitForChrome(port);
  const target = pages.find(p => p.type === 'page') || pages[0];
  if (!target || !target.webSocketDebuggerUrl) {
    throw new Error('No debuggable page found in Chrome');
  }

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.on('open', async () => {
      try {
        await sendCDP(ws, 'Network.enable');
        await sendCDP(ws, 'Network.setCookies', { cookies });
        console.log(`  Cookies injected successfully.`);
        ws.close();
        resolve();
      } catch (err) {
        ws.close();
        reject(err);
      }
    });
    ws.on('error', reject);
  });
}

module.exports = { injectCookies, injectGeolocation };
