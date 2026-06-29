'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getPreset } = require('./presets');
const { userDataDir, touchLastUsed } = require('./profiles');

const ROOT = path.resolve(__dirname, '..');

// Resolve the patched Chromium binary. Checks (in order):
//   1. CHROME_BIN env var (set this to point at your CloakBrowser binary)
//   2. ./bin/chrome (drop the binary here after building)
//   3. System chromium / google-chrome as fallback (unpatched — for testing only)
function resolveBinary() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;

  const localBin = path.join(ROOT, 'bin', 'chrome');
  if (fs.existsSync(localBin)) return localBin;

  for (const candidate of ['chromium-browser', 'chromium', 'google-chrome', 'google-chrome-stable']) {
    try {
      require('child_process').execSync(`which ${candidate}`, { stdio: 'ignore' });
      console.warn(`[warn] Using system ${candidate} — fingerprint patches NOT active. Set CHROME_BIN to your patched binary.`);
      return candidate;
    } catch (_) {}
  }

  throw new Error(
    'No Chrome binary found.\n' +
    '  Option 1: Set CHROME_BIN=/path/to/cloakbrowser/chrome\n' +
    '  Option 2: Copy your patched binary to ./bin/chrome\n' +
    '  Option 3: Install chromium-browser for testing (no stealth)'
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
