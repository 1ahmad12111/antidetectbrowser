'use strict';

// Real-device fingerprint presets. Each preset defines the hardware story that
// the patched Chromium binary will present to websites. Values are sourced from
// actual device fingerprints so they pass statistical plausibility checks.
const PRESETS = {
  'windows-11-rtx3070-1080p': {
    os: 'Windows',
    osVersion: '10.0',
    platform: 'Win32',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    secChUa: '"Chromium";v="148", "Google Chrome";v="148", "Not-A.Brand";v="99"',
    secChUaPlatform: '"Windows"',
    secChUaPlatformVersion: '"15.0.0"',
    screen: { width: 1920, height: 1080, colorDepth: 24, pixelRatio: 1 },
    hardwareConcurrency: 8,
    deviceMemory: 16,
    webglVendor: 'Google Inc. (NVIDIA)',
    webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    fonts: ['Arial', 'Calibri', 'Cambria', 'Comic Sans MS', 'Courier New', 'Georgia',
            'Impact', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'],
  },

  'windows-10-gtx1060-1080p': {
    os: 'Windows',
    osVersion: '10.0',
    platform: 'Win32',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    secChUa: '"Chromium";v="148", "Google Chrome";v="148", "Not-A.Brand";v="99"',
    secChUaPlatform: '"Windows"',
    secChUaPlatformVersion: '"10.0.0"',
    screen: { width: 1920, height: 1080, colorDepth: 24, pixelRatio: 1 },
    hardwareConcurrency: 6,
    deviceMemory: 8,
    webglVendor: 'Google Inc. (NVIDIA)',
    webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB Direct3D11 vs_5_0 ps_5_0, D3D11)',
    fonts: ['Arial', 'Calibri', 'Cambria', 'Comic Sans MS', 'Courier New', 'Georgia',
            'Impact', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'],
  },

  'windows-11-intel-1080p': {
    os: 'Windows',
    osVersion: '10.0',
    platform: 'Win32',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    secChUa: '"Chromium";v="148", "Google Chrome";v="148", "Not-A.Brand";v="99"',
    secChUaPlatform: '"Windows"',
    secChUaPlatformVersion: '"15.0.0"',
    screen: { width: 1920, height: 1080, colorDepth: 24, pixelRatio: 1 },
    hardwareConcurrency: 4,
    deviceMemory: 8,
    webglVendor: 'Google Inc. (Intel)',
    webglRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics 730 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    fonts: ['Arial', 'Calibri', 'Cambria', 'Comic Sans MS', 'Courier New', 'Georgia',
            'Impact', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'],
  },

  'macos-14-m2-retina': {
    os: 'macOS',
    osVersion: '14.5',
    platform: 'MacIntel',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    secChUa: '"Chromium";v="148", "Google Chrome";v="148", "Not-A.Brand";v="99"',
    secChUaPlatform: '"macOS"',
    secChUaPlatformVersion: '"14.5.0"',
    screen: { width: 2560, height: 1600, colorDepth: 30, pixelRatio: 2 },
    hardwareConcurrency: 8,
    deviceMemory: 16,
    webglVendor: 'Apple Inc.',
    webglRenderer: 'Apple M2',
    fonts: ['Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia',
            'Helvetica Neue', 'Impact', 'Times New Roman', 'Trebuchet MS', 'Verdana',
            'Gill Sans', 'Optima', 'Futura'],
  },

  'ubuntu-22-amd-1080p': {
    os: 'Linux',
    osVersion: '',
    platform: 'Linux x86_64',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    secChUa: '"Chromium";v="148", "Google Chrome";v="148", "Not-A.Brand";v="99"',
    secChUaPlatform: '"Linux"',
    secChUaPlatformVersion: '"5.15.0"',
    screen: { width: 1920, height: 1080, colorDepth: 24, pixelRatio: 1 },
    hardwareConcurrency: 8,
    deviceMemory: 16,
    webglVendor: 'AMD',
    webglRenderer: 'AMD Radeon RX 580 Series (radeonsi, polaris10, LLVM 15.0.7, DRM 3.47, 5.15.0-97-generic)',
    fonts: ['Arial', 'Courier New', 'DejaVu Sans', 'DejaVu Serif', 'FreeMono',
            'FreeSans', 'FreeSerif', 'Georgia', 'Liberation Mono', 'Liberation Sans',
            'Times New Roman', 'Ubuntu', 'Verdana'],
  },
};

function getPreset(name) {
  const preset = PRESETS[name];
  if (!preset) {
    const available = Object.keys(PRESETS).join(', ');
    throw new Error(`Unknown preset "${name}". Available: ${available}`);
  }
  return preset;
}

function listPresets() {
  return Object.keys(PRESETS);
}

module.exports = { PRESETS, getPreset, listPresets };
