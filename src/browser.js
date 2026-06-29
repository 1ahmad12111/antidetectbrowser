'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getPreset } = require('./presets');
const { userDataDir, touchLastUsed } = require('./profiles');

const ROOT = path.resolve(__dirname, '..');
const IS_WINDOWS = process.platform === 'win32';

// Returns the path to the CloakBrowser patched binary.
// Downloads it automatically on first run (~200MB, cached in ~/.cloakbrowser/).
async function resolveBinary() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;

  // cloakbrowser is an ESM package — use dynamic import from our CommonJS code
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

  // Manual drop-in fallback: place binary at bin/chrome.exe (Windows) or bin/chrome (Linux)
  const localBin = path.join(ROOT, 'bin', IS_WINDOWS ? 'chrome.exe' : 'chrome');
  if (fs.existsSync(localBin)) return localBin;

  // System Chrome fallback — no fingerprint patches, but proxy + isolation still work
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

  throw new Error('No browser binary found. Run: npm install  (cloakbrowser will auto-download the patched binary)');
}

// Writes a temp JSON config the patched binary reads at startup.
// Same seed = identical fingerprint on every launch.
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
  return [
    `--user-data-dir=${dataDir}`,
    `--fp-config=${fpConfigPath}`,

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
  ];
}

async function launch(profile) {
  const preset = getPreset(profile.preset);
  const dataDir = userDataDir(profile.name);
  const fpConfigPath = writeFpConfig(profile, preset);
  const binary = await resolveBinary();
  const flags = buildFlags(profile, preset, fpConfigPath, dataDir);

  console.log(`\nLaunching profile: ${profile.name}`);
  console.log(`  Preset  : ${profile.preset}`);
  console.log(`  Proxy   : ${profile.proxy || 'none (direct)'}`);
  console.log(`  Timezone: ${profile.timezone}`);
  console.log(`  Binary  : ${binary}\n`);

  touchLastUsed(profile.name);

  const child = spawn(binary, flags, {
    detached: false,
    stdio: 'ignore',
    env: { ...process.env, BROWSER_FP_CONFIG: fpConfigPath },
  });

  child.on('exit', (code) => {
    try { fs.unlinkSync(fpConfigPath); } catch (_) {}
    console.log(`Profile "${profile.name}" closed (exit ${code ?? 0}).`);
  });

  child.on('error', (err) => {
    console.error(`Failed to launch browser: ${err.message}`);
    process.exit(1);
  });

  child.unref();
}

module.exports = { launch, resolveBinary };
