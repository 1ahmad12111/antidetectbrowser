'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getPreset } = require('./presets');
const { userDataDir, touchLastUsed } = require('./profiles');
const { injectAll } = require('./cookies');

const ROOT = path.resolve(__dirname, '..');
const IS_WINDOWS = process.platform === 'win32';

// Returns the path to the CloakBrowser patched binary.
// Downloads automatically on first run (~200MB, cached in ~/.cloakbrowser/).
async function resolveBinary() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;

  try {
    const { binaryInfo, ensureBinary } = await import('cloakbrowser');
    const info = binaryInfo();
    if (!info.installed) {
      console.log(`Downloading patched Chromium ${info.version} (~200MB, one-time)...`);
      await ensureBinary();
      console.log('Download complete.\n');
    }
    return info.binaryPath;
  } catch (err) {
    console.warn(`[warn] cloakbrowser package error: ${err.message}`);
  }

  const localBin = path.join(ROOT, 'bin', IS_WINDOWS ? 'chrome.exe' : 'chrome');
  if (fs.existsSync(localBin)) return localBin;

  if (IS_WINDOWS) {
    const candidates = [
      path.join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env['LOCALAPPDATA'] || '', 'Google\\Chrome\\Application\\chrome.exe'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        console.warn('[warn] Using system Chrome — fingerprint patches NOT active.');
        return c;
      }
    }
  } else {
    for (const c of ['chromium-browser', 'chromium', 'google-chrome']) {
      try {
        require('child_process').execSync(`which ${c}`, { stdio: 'ignore' });
        console.warn(`[warn] Using system ${c} — fingerprint patches NOT active.`);
        return c;
      } catch (_) {}
    }
  }

  throw new Error('No browser binary found. Run: npm install');
}

function writeFpConfig(profile, preset) {
  const config = {
    seed: profile.seed,
    userAgent: preset.userAgent,
    platform: preset.platform,
    hardwareConcurrency: preset.hardwareConcurrency,
    deviceMemory: preset.deviceMemory,
    screen: preset.screen,
    webglVendor: preset.webglVendor,
    webglRenderer: preset.webglRenderer,
    fonts: preset.fonts,
    timezone: profile.timezone,
    language: profile.language,
    secChUa: preset.secChUa,
    secChUaPlatform: preset.secChUaPlatform,
    secChUaPlatformVersion: preset.secChUaPlatformVersion,
  };
  const tmpFile = path.join(os.tmpdir(), `adb-fp-${profile.id}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify(config));
  return tmpFile;
}

function buildFlags(profile, preset, fpConfigPath, dataDir, debugPort) {
  // Fix 2: --restore-last-session tells Chromium to reopen whatever tabs
  // were open when the profile was last closed. Only skip it on very first launch
  // (when there's no session yet) so startup URLs open instead.
  const dataDefault = path.join(dataDir, 'Default');
  const hasSession = fs.existsSync(path.join(dataDefault, 'Current Session')) ||
                     fs.existsSync(path.join(dataDefault, 'Last Session'));

  const startupUrls = hasSession
    ? [] // let --restore-last-session handle it
    : (profile.startupUrls || []).map(u => u.startsWith('http') ? u : `https://${u}`);

  return [
    `--user-data-dir=${dataDir}`,
    `--fp-config=${fpConfigPath}`,
    `--remote-debugging-port=${debugPort}`,

    // Fix 2: restore last session on every launch after the first
    ...(hasSession ? ['--restore-last-session'] : []),

    ...(IS_WINDOWS ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),

    ...(profile.proxy
      ? [`--proxy-server=${profile.proxy}`, '--force-webrtc-ip-handling-policy=disable_non_proxied_udp']
      : ['--force-webrtc-ip-handling-policy=disable_non_proxied_udp']
    ),

    '--disable-blink-features=AutomationControlled',
    '--exclude-switches=enable-automation',
    `--user-agent=${preset.userAgent}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-default-apps',
    '--disable-background-networking',
    '--disable-sync',

    ...startupUrls,
  ];
}

function randomDebugPort() {
  return 9222 + Math.floor(Math.random() * 1000);
}

// processRegistry is injected by ui/main.js so the UI can track running profiles.
// When running from CLI it stays null and we just unref the child.
let processRegistry = null;
function setProcessRegistry(reg) { processRegistry = reg; }

// Patch Default/Preferences before launch so Chrome doesn't show
// "Restore pages?" on next open. Chrome marks exit_type="Crashed" on startup
// and only resets it to "Normal" on clean exit. We pre-set it to "Normal"
// so the crash-restore bubble never appears, while --restore-last-session
// still restores tabs normally.
function patchChromePreferences(dataDir) {
  const prefsPath = path.join(dataDir, 'Default', 'Preferences');
  if (!fs.existsSync(prefsPath)) return; // first run — no prefs yet
  try {
    const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
    if (!prefs.profile) prefs.profile = {};
    prefs.profile.exit_type      = 'Normal';
    prefs.profile.exited_cleanly = true;
    fs.writeFileSync(prefsPath, JSON.stringify(prefs));
  } catch (_) {}
}

async function launch(profile, overrideCookiesFile = null) {
  const preset   = getPreset(profile.preset);
  const dataDir  = userDataDir(profile.name);
  const fpConfigPath = writeFpConfig(profile, preset);
  const binary   = await resolveBinary();
  const debugPort = randomDebugPort();
  const flags    = buildFlags(profile, preset, fpConfigPath, dataDir, debugPort);
  const cookiesFile = overrideCookiesFile || profile.cookiesFile || null;

  // Patch prefs BEFORE launch so Chrome skips the crash-restore dialog
  patchChromePreferences(dataDir);

  console.log(`\nLaunching profile: ${profile.name}`);
  console.log(`  Preset    : ${profile.preset}`);
  console.log(`  Proxy     : ${profile.proxy || 'none (direct)'}`);
  console.log(`  Timezone  : ${profile.timezone}  (CDP override)`);
  console.log(`  Binary    : ${binary}\n`);

  touchLastUsed(profile.name);

  const child = spawn(binary, flags, {
    detached: true,
    stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, BROWSER_FP_CONFIG: fpConfigPath },
  });

  let stderrBuf = '';
  child.stderr.on('data', d => { stderrBuf += d.toString(); });

  child.on('exit', (code) => {
    try { fs.unlinkSync(fpConfigPath); } catch (_) {}
    if (processRegistry) processRegistry.delete(profile.name);
    if (code !== 0 && code !== null) {
      console.error(`\n[error] Browser exited with code ${code}`);
      if (stderrBuf) console.error(stderrBuf.slice(0, 1000));
    } else {
      console.log(`Profile "${profile.name}" closed.`);
    }
  });

  child.on('error', (err) => {
    console.error(`Failed to launch browser: ${err.message}`);
    if (processRegistry) processRegistry.delete(profile.name);
  });

  // Register process so UI can track live status + graceful close
  if (processRegistry) processRegistry.set(profile.name, { child, debugPort });

  // Inject timezone/geo/cookies — poll until Chrome is ready instead of fixed 3s delay
  (async () => {
    try {
      await injectAll(debugPort, {
        timezone: profile.timezone,
        lat: profile.geo?.lat ?? null,
        lon: profile.geo?.lon ?? null,
        cookiesPath: cookiesFile,
      });
    } catch (err) {
      console.error(`[cdp] ${err.message}`);
    }
  })();

  child.unref();
  return { debugPort, pid: child.pid };
}

module.exports = { launch, resolveBinary, setProcessRegistry };
