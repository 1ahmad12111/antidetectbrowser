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

// Open a CDP WebSocket to a specific debugger URL
function connectWS(debuggerUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(debuggerUrl);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

// Open a CDP WebSocket to the first available page target
async function openCDPSession(port) {
  const pages = await waitForChrome(port);
  const target = pages.find(p => p.type === 'page') || pages[0];
  if (!target?.webSocketDebuggerUrl) throw new Error('No debuggable page found in Chrome');
  return connectWS(target.webSocketDebuggerUrl);
}

// Open a CDP WebSocket to the browser endpoint (for Browser.close)
async function openBrowserSession(port) {
  // /json/version returns the browser-level websocket URL
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const { webSocketDebuggerUrl } = JSON.parse(data);
          if (!webSocketDebuggerUrl) return reject(new Error('No browser WS URL'));
          resolve(connectWS(webSocketDebuggerUrl));
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
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

// Build a script that overrides all JS timezone APIs so pages always report
// the spoofed timezone regardless of when our CDP override arrives.
function buildTimezoneScript(timezone) {
  return `(function() {
  const _tz = ${JSON.stringify(timezone)};
  // Override Intl.DateTimeFormat to always inject our timezone
  const _OrigDTF = Intl.DateTimeFormat;
  function PatchedDTF(locales, options) {
    options = Object.assign({}, options || {});
    if (!options.timeZone) options.timeZone = _tz;
    return new _OrigDTF(locales, options);
  }
  PatchedDTF.prototype = _OrigDTF.prototype;
  PatchedDTF.supportedLocalesOf = _OrigDTF.supportedLocalesOf.bind(_OrigDTF);
  Object.defineProperty(Intl, 'DateTimeFormat', { value: PatchedDTF, writable: true, configurable: true });

  // Patch Date.prototype methods that leak local timezone offset
  const _getTimezoneOffset = Date.prototype.getTimezoneOffset;
  const _tzOffset = (() => {
    try { return -new _OrigDTF('en', { timeZone: _tz, timeZoneName: 'short' })
      .formatToParts(new Date()).reduce((acc, p) => {
        if (p.type === 'timeZoneName') {
          const m = p.value.match(/GMT([+-])(\\d{1,2})(?::(\\d{2}))?/);
          if (m) return (m[1] === '+' ? -1 : 1) * (parseInt(m[2]) * 60 + parseInt(m[3] || 0));
        }
        return acc;
      }, 0); } catch(e) { return 0; }
  })();
  Date.prototype.getTimezoneOffset = function() { return _tzOffset; };
})();`;
}

// Apply timezone + geolocation overrides to every open page target
async function injectEmulationToAllTabs(port, { timezone, lat, lon }) {
  const pages = await waitForChrome(port);
  const pageTargets = pages.filter(p => p.type === 'page' && p.webSocketDebuggerUrl);
  const tzScript = timezone ? buildTimezoneScript(timezone) : null;
  await Promise.all(pageTargets.map(async (target) => {
    let ws;
    try {
      ws = await connectWS(target.webSocketDebuggerUrl);
      if (timezone) {
        await sendCDP(ws, 'Emulation.setTimezoneOverride', { timezoneId: timezone });
        // Inject script so ALL future navigations in this tab also get the override
        await sendCDP(ws, 'Page.addScriptToEvaluateOnNewDocument', { source: tzScript });
      }
      if (lat != null && lon != null) {
        await sendCDP(ws, 'Emulation.setGeolocationOverride', { latitude: lat, longitude: lon, accuracy: 10 });
      }
    } catch (_) {
      // tab may have closed between listing and connecting — skip it
    } finally {
      ws?.close();
    }
  }));
  console.log(`  Timezone/geo applied to ${pageTargets.length} tab(s): ${timezone}`);
}

// Run all CDP injections: timezone + geo to ALL tabs, cookies to first tab
async function injectAll(port, { timezone, lat, lon, cookiesPath }) {
  // Apply timezone + geolocation to every open tab
  if (timezone || (lat != null && lon != null)) {
    await injectEmulationToAllTabs(port, { timezone, lat, lon });
  }

  // Cookies go to the browser-wide storage (first tab CDP session is enough)
  if (cookiesPath) {
    const ws = await openCDPSession(port);
    try {
      if (fs.existsSync(cookiesPath)) {
        const cookies = loadCookiesFile(cookiesPath);
        await sendCDP(ws, 'Network.enable');
        await sendCDP(ws, 'Network.setCookies', { cookies });
        console.log(`  Injected ${cookies.length} cookies`);
      } else {
        console.warn(`  [warn] Cookies file not found: ${cookiesPath}`);
      }
    } finally {
      ws.close();
    }
  }
}

// Gracefully close Chrome via CDP so it saves session state cleanly.
// Falls back to SIGKILL if CDP close doesn't work within the timeout.
async function gracefulClose(port, childProcess) {
  try {
    const ws = await openBrowserSession(port);
    await new Promise((resolve) => {
      // Browser.close makes Chrome exit cleanly — session is flushed to disk
      ws.send(JSON.stringify({ id: 1, method: 'Browser.close', params: {} }));
      // Give it 3s to exit on its own before we force-kill
      const timer = setTimeout(() => {
        ws.close();
        try { childProcess.kill(); } catch (_) {}
        resolve();
      }, 3000);
      childProcess.once('exit', () => { clearTimeout(timer); ws.close(); resolve(); });
    });
  } catch (_) {
    // CDP not reachable (browser already closed or never started) — just kill
    try { childProcess.kill(); } catch (_) {}
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

module.exports = { injectAll, injectCookiesFromText, gracefulClose, waitForChrome };
