'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getPreset } = require('./presets');
const { userDataDir, touchLastUsed } = require('./profiles');

const ROOT = path.resolve(__dirname, '..');

const IS_WINDOWS = process.platform === 'win32';

// Resolve the patched Chromium binary. Checks (in order):
//   1. CHROME_BIN env var
//   2. ./bin/chrome.exe (Windows) or ./bin/chrome (Linux)
//   3. System Chrome/Chromium as fallback (unpatched — for testing only)
function resolveBinary() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;

  const localBin = path.join(ROOT, 'bin', IS_WINDOWS ? 'chrome.exe' : 'chrome');
  if (fs.existsSync(localBin)) return localBin;

  if (IS_WINDOWS) {
    const windowsCandidates = [
      path.join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env['LOCALAPPDATA'] || '', 'Google\\Chrome\\Application\\chrome.exe'),
    ];
    for (const candidate of windowsCandidates) {
      if (fs.existsSync(candidate)) {
        console.warn(`[warn] Using system Chrome — fingerprint patches NOT active. Drop your patched binary at bin\\chrome.exe`);
        return candidate;
      }
    }
    throw new Error(
      'No Chrome binary found.\n' +
      '  Option 1: Set CHROME_BIN=C:\\path\\to\\chrome.exe in a .env file or before running\n' +
      '  Option 2: Copy your patched chrome.exe to bin\\chrome.exe\n' +
      '  Option 3: Install Google Chrome for testing (no stealth patches)'
    );
  }

  for (const candidate of ['chromium-browser', 'chromium', 'google-chrome', 'google-chrome-stable']) {
    try {
      require('child_process').execSync(`which ${candidate}`, { stdio: 'ignore' });
      console.warn(`[warn] Using system ${candidate} — fingerprint patches NOT active.`);
      return candidate;
    } catch (_) {}
  }

  throw new Error(
    'No Chrome binary found.\n' +
    '  Option 1: Set CHROME_BIN=/path/to/chrome\n' +
    '  Option 2: Copy your patched binary to bin/chrome'
  );
}

// Write the fingerprint config that the patched binary reads on startup.
// The seed drives all noise functions — same seed = identical fingerprint every launch.
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

function buildFlags(profile, preset, fpConfigPath, dataDir) {
  const flags = [
    `--user-data-dir=${dataDir}`,

    // Fingerprint config path — read by our C++ patches at startup
    `--fp-config=${fpConfigPath}`,

    // Proxy
    ...(profile.proxy ? [
      `--proxy-server=${profile.proxy}`,
      // Force all WebRTC traffic through the proxy — prevents real IP leak
      '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
    ] : [
      '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
    ]),

    // Automation signal removal
    '--disable-blink-features=AutomationControlled',
    '--exclude-switches=enable-automation',

    // UA override at flag level (belt + suspenders alongside C++ patch)
    `--user-agent=${preset.userAgent}`,

    // Timezone
    `--timezone=${profile.timezone}`,

    // Clean launch — no "Chrome didn't shut down cleanly" banner
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-default-apps',

    // Performance
    '--disable-background-networking',
    '--disable-sync',
  ];

  return flags;
}

function launch(profile) {
  const preset = getPreset(profile.preset);
  const dataDir = userDataDir(profile.name);
  const fpConfigPath = writeFpConfig(profile, preset);
  const binary = resolveBinary();
  const flags = buildFlags(profile, preset, fpConfigPath, dataDir);

  console.log(`Launching profile: ${profile.name}`);
  console.log(`  Preset  : ${profile.preset}`);
  console.log(`  Proxy   : ${profile.proxy || 'none (direct)'}`);
  console.log(`  Timezone: ${profile.timezone}`);
  console.log(`  Seed    : ${profile.seed}`);
  console.log(`  Binary  : ${binary}`);

  touchLastUsed(profile.name);

  const child = spawn(binary, flags, {
    detached: false,
    stdio: 'ignore',
    env: {
      ...process.env,
      BROWSER_FP_CONFIG: fpConfigPath,
    },
  });

  child.on('exit', (code) => {
    // Clean up temp fingerprint config file on browser close
    try { fs.unlinkSync(fpConfigPath); } catch (_) {}
    console.log(`Profile "${profile.name}" closed (exit ${code ?? 0}).`);
  });

  child.on('error', (err) => {
    console.error(`Failed to launch browser: ${err.message}`);
    process.exit(1);
  });

  // Keep the launcher process alive while the browser is open
  child.unref();
}

module.exports = { launch, resolveBinary };
