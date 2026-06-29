# Antidetect Browser

Minimal personal antidetect browser — unlimited profiles, local sync, per-profile proxy.

## Requirements

- Node.js 18+
- Ubuntu 22.04 VM (target)
- A patched Chromium binary (see **Getting the Browser Binary** below)

## Install

```bash
git clone https://github.com/1ahmad12111/antidetectbrowser.git
cd antidetectbrowser
npm install
```

## Getting the Browser Binary

You need a Chromium binary with fingerprint patches applied. Two options:

### Option A — Download CloakBrowser (Fastest)
CloakBrowser is an open-source Chromium fork with 58 C++ fingerprint patches already applied.

```bash
# Check releases at: https://github.com/CloakHQ/CloakBrowser
# Download the Linux build, extract it, then:
mkdir -p bin
cp /path/to/extracted/chrome bin/chrome
chmod +x bin/chrome
```

### Option B — Build From Source
```bash
# Needs: 16GB RAM, 100GB disk, Ubuntu 22.04, ~8-30hrs first build
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git
export PATH="$PATH:$(pwd)/depot_tools"
mkdir chromium && cd chromium
fetch chromium
# Apply CloakBrowser patches, then:
gn gen out/Release --args='is_debug=false is_official_build=true'
autoninja -C out/Release chrome
cp out/Release/chrome ../antidetectbrowser/bin/chrome
```

### Option C — Use System Chromium (Testing Only, No Stealth)
If you just want to test the profile/proxy system without fingerprint patches:
```bash
sudo apt install chromium-browser
# The launcher will find it automatically — but fingerprints won't be spoofed
```

## Usage

### Create a profile
```bash
node src/launch.js create "fb-account-1" --preset=windows-11-rtx3070-1080p --proxy=socks5://127.0.0.1:1080
node src/launch.js create "ig-account-2" --preset=macos-14-m2-retina --timezone=Europe/London
node src/launch.js create "research"     --preset=windows-10-gtx1060-1080p
# No profile limit — create as many as you need
```

### Launch a profile
```bash
node src/launch.js launch "fb-account-1"
# Opens in its own isolated browser session
# All cookies/history/logins saved automatically on close
```

### List all profiles
```bash
node src/launch.js list
```

### Change a profile's proxy
```bash
node src/launch.js set-proxy "fb-account-1" socks5://new-proxy-ip:1080
node src/launch.js set-proxy "fb-account-1" none   # remove proxy (direct connection)
```

### Delete a profile
```bash
node src/launch.js delete "fb-account-1"
# Removes profile JSON and all browser data (cookies, history, etc.)
```

### List device presets
```bash
node src/launch.js presets
```

## Available Presets

| Preset | OS | GPU | Screen |
|---|---|---|---|
| `windows-11-rtx3070-1080p` | Windows 11 | NVIDIA RTX 3070 | 1920×1080 |
| `windows-10-gtx1060-1080p` | Windows 10 | NVIDIA GTX 1060 | 1920×1080 |
| `windows-11-intel-1080p` | Windows 11 | Intel UHD 730 | 1920×1080 |
| `macos-14-m2-retina` | macOS 14 | Apple M2 | 2560×1600 |
| `ubuntu-22-amd-1080p` | Ubuntu 22 | AMD RX 580 | 1920×1080 |

## Proxy Support

Each profile has its own proxy. Supported formats:

```
socks5://127.0.0.1:1080               # SOCKS5
socks5://user:pass@host:1080          # SOCKS5 with auth
http://host:8080                      # HTTP proxy
https://host:8080                     # HTTPS proxy
none                                  # Direct (no proxy)
```

WebRTC is forced through the proxy automatically — no IP leaks.

## Data & Privacy

All profile data is stored **locally only** in:
- `profiles/<name>.json` — fingerprint config, proxy, settings
- `data/<name>/` — Chromium user data (cookies, history, passwords, extensions)

Nothing is sent to any server. Data survives browser close and is restored on next launch.

## Setting a Custom Binary Path

```bash
export CHROME_BIN=/path/to/your/chrome
node src/launch.js launch "my-profile"
```

Or add `CHROME_BIN` to your `.env` / shell profile.

## Verify It's Working

After launching a profile, visit these sites to check fingerprint isolation:

- https://browserleaks.com — per-signal audit
- https://pixelscan.net — overall trust score
- https://abrahamjuliot.github.io/creepjs — comprehensive fingerprint analysis
- https://bot.sannysoft.com — automation detection check
