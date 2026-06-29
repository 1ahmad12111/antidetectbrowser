# Antidetect Browser — Market Research & Build Game Plan

---

## MINIMAL PERSONAL-USE PLAN (Revised — Read This First)

> This is for personal use by a small group of friends. No UI, no cloud, no enterprise features.
> Goal: fastest path to a working patched browser on a VM.

### What We're Building (Minimal Version)

```
patched-chrome  ←  node launch.js <profile-name>
                        ↓
               reads profiles/<name>.json
               spawns chrome with isolated user-data-dir + proxy + fingerprint seed
```

### 4-Week Timeline (Down From 15)

| Week | Task | Output |
|---|---|---|
| 1 | Set up Chromium build env on VM; clone CloakBrowser | Build env ready |
| 2 | Apply CloakBrowser's 58 C++ patches; `autoninja -C out/Release chrome` | Working patched binary |
| 3 | Write `launch.js` (~100 lines Node.js) — create/list/launch profiles with proxy | CLI working |
| 4 | Test against BrowserLeaks + Pixelscan; fix leaks; install on VM | Done |

**Shortcut**: If 30-hour build is a blocker, download CloakBrowser's pre-built binary release and skip directly to Week 3.

### Minimal Stack

| What | Choice |
|---|---|
| Browser engine | CloakBrowser patches on Chromium 148 (58 patches, pre-written) |
| Profile launcher | Single `launch.js` Node.js script (~100 lines) |
| Profile storage | JSON files in `profiles/` folder |
| Proxy | `--proxy-server=socks5://host:port` flag (built into Chromium) |
| UI | Terminal commands only |

### 3 Daily Commands

```bash
node launch.js create "account-1" --preset=windows-11-rtx3070 --proxy=socks5://127.0.0.1:1080
node launch.js list
node launch.js launch "account-1"
```

### 5 Starter Device Presets

| Preset | OS | GPU | Screen |
|---|---|---|---|
| `windows-11-rtx3070-1080p` | Windows 11 | NVIDIA RTX 3070 | 1920×1080 |
| `windows-10-gtx1060-1080p` | Windows 10 | NVIDIA GTX 1060 | 1920×1080 |
| `macos-14-m2-retina` | macOS 14 | Apple M2 | 2560×1600 |
| `windows-11-intel-1080p` | Windows 11 | Intel UHD 730 | 1920×1080 |
| `ubuntu-22-amd-1080p` | Ubuntu 22 | AMD RX 580 | 1920×1080 |

### VM Install (Week 4, Day 1)

```bash
sudo apt install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2
cd ~/browser && node launch.js launch "account-1"
```

### What We're Skipping (Not Needed for Personal Use)

- Electron/React UI (terminal is fine)
- SQLite (JSON files handle <50 profiles)
- TLS/JA4+ proxy layer (advanced; overkill)
- Firefox fork (Chromium-only is fine)
- .deb packaging (just copy the folder)
- Cloud sync (local only)

---

## 1. What is an Antidetect Browser?

An antidetect browser is a modified browser that replaces your real device fingerprint with a
synthetic one so that websites see each browser profile as a completely independent, unique
real-user device. Core use cases: multi-account management, affiliate marketing, ad verification,
web scraping, privacy, and penetration-testing research.

---

## 2. Market Landscape — Major Players

### 2.1 Multilogin (multilogin.com)
- **Engines**: Mimic (Chromium fork) + Stealthfox (Firefox fork) — two engines = more fingerprint diversity
- **Fingerprint coverage**: 50+ parameters — Canvas, WebGL, AudioContext, WebRTC, fonts, timezone, geolocation, screen, CPU cores, RAM, User-Agent, Client Hints, TLS JA3
- **Automation**: Selenium, Playwright, Puppeteer via CDP/WebDriver
- **Team features**: shared profiles, role-based access, cloud storage of profiles
- **Tech stack**: Custom C++ patches inside Blink/Gecko + Electron/Node.js desktop app
- **Pricing**: €99–€399/month (expensive)
- **Weakness**: Price; no free tier; profiles stored server-side (privacy concern)

### 2.2 GoLogin (gologin.com)
- **Engine**: Orbita — custom Chromium fork
- **Differentiator**: Only player with full Android app + web cloud version
- **Fingerprint coverage**: 50+ parameters
- **Automation**: Full Puppeteer/Playwright/Selenium API
- **Tech stack**: Electron + Node.js shell, custom Chromium binary (Orbita)
- **Pricing**: $49–$299/month; 7-day free trial
- **Weakness**: Cloud-dependent; profiles not local-first

### 2.3 AdsPower (adspower.com)
- **Engine**: SunBrowser (Chromium) + FlowerBird (Firefox)
- **Differentiator**: No-code RPA automation builder built in; fastest browser core update cycle (14 updates in 2025)
- **Team features**: strong; built for agencies
- **Pricing**: Free tier (2 profiles) → $9–$100+/month
- **Weakness**: RPA is limited vs. proper Playwright scripts

### 2.4 Dolphin Anty (dolphin.ru.com)
- **Engine**: Chromium-based
- **Differentiator**: Best for Facebook/Meta ads — per-profile timers, bulk operations
- **Automation**: Puppeteer/Playwright via local API on port 3001
- **Pricing**: Free (10 profiles) → $89–$299/month
- **Weakness**: Less polished for non-ad use cases

### 2.5 Incogniton (incogniton.com)
- **Engine**: Chromium
- **Differentiator**: Selenium/Playwright API, profile sync
- **Pricing**: Free (10 profiles) → $29–$149/month

### 2.6 Kameleo (kameleo.io)
- **Engine**: Chromium + Firefox + Mobile (Android WebView)
- **Differentiator**: Mobile profile support; Local API for automation; Chroma for desktop
- **Tech stack**: .NET backend + Electron shell
- **Pricing**: €59–€199/month

### 2.7 Octo Browser (octobrowser.net)
- **Engine**: Chromium
- **Differentiator**: Built for crypto/NFT traders; fast profile launch
- **Pricing**: €21–€105/month

### 2.8 Linken Sphere (ls.dev)
- **Engine**: Custom Chromium fork (TenantBrowser)
- **Differentiator**: Privacy-first; no accounts needed; pay in crypto; very aggressive fingerprinting
- **Pricing**: $100–$500/month

### 2.9 Ixbrowser (ixbrowser.com)
- **Pricing**: Free (10 profiles) — strong free tier
- **Engine**: Chromium

### 2.10 Open-Source Reference Projects
| Project | Engine | Notes |
|---|---|---|
| `itbrowser-net/undetectable-fingerprint-browser` | Chromium 148 | Engine-level C++ patches; 170+ device profiles; WebGL/WebGPU/fonts/TLS |
| `coderkhalide/Anti-Detect-Browser` | Electron + Puppeteer | JS-layer spoofing; simpler; good for learning |
| `puppeteer-extra-plugin-stealth` | Any Chromium | JS injection only; detectable by toString() checks |
| `Camoufox` | Firefox fork | Used in AI browser automation |
| `BotBrowser` | Chromium | Deep C++ patches; detected by GeeTest as of 2025 |

---

## 3. How Fingerprinting Works (What We Must Spoof)

### 3.1 Fingerprint Signals (in priority order)
| Signal | API | Spoofing Method |
|---|---|---|
| Canvas 2D | `HTMLCanvasElement.toDataURL` | Inject noise at C++ level in Blink |
| WebGL renderer/vendor | `WEBGL_debug_renderer_info` | Patch `getParameter()` in C++ |
| WebGL fingerprint | shader outputs | Deterministic noise injection |
| AudioContext | `OfflineAudioContext` | Add subtle noise to audio buffer |
| Fonts | `document.fonts`, CSS measurement | Limit font list per profile |
| Screen resolution | `screen.width/height/colorDepth` | Override via JS or C++ |
| Timezone | `Intl.DateTimeFormat` | Per-profile timezone override |
| Navigator properties | `navigator.userAgent`, `platform`, `languages`, `hardwareConcurrency`, `deviceMemory` | Patch in C++ or via JS |
| WebRTC | ICE candidate leaks | Block or spoof local IP |
| TLS/JA3 fingerprint | TLS handshake | Patch Chromium's BoringSSL |
| HTTP headers | `Accept`, `Accept-Language`, `Sec-CH-UA` | Patch at network layer |
| Client Hints | `Sec-CH-UA-*` | Must match UA string — patch together |
| CSS media queries | `prefers-color-scheme`, `pointer` | Override via profile settings |
| Battery API | `navigator.getBattery()` | Return fixed values or disable |
| Geolocation | `navigator.geolocation` | Spoof coordinates per profile |
| Plugins | `navigator.plugins` | Return realistic plugin list |
| Automation signals | `navigator.webdriver` | Patch to undefined/false |

### 3.2 Spoofing Levels (Best → Worst)
1. **C++ / engine-level patches** — Most undetectable; toString() checks pass; consistent across all JS contexts
2. **CDP (Chrome DevTools Protocol) overrides** — Page.addScriptToEvaluateOnNewDocument; detectable via CDP leak checks
3. **JS injection on page load** — Least robust; Object.defineProperty overrides can be detected

**We will use approach #1 (C++ patches) for our browser.**

---

## 4. Architecture Decision

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Desktop App (Electron)                  │
│  ┌───────────────────────┐  ┌──────────────────────────┐ │
│  │  React UI (Frontend)  │  │  Node.js Main Process    │ │
│  │  - Profile manager    │  │  - Profile CRUD          │ │
│  │  - Proxy config       │  │  - Browser launcher      │ │
│  │  - Settings           │  │  - Proxy manager         │ │
│  └───────────────────────┘  └──────────┬───────────────┘ │
└─────────────────────────────────────────┼───────────────┘
                                          │ spawn
                              ┌───────────▼───────────────┐
                              │  Custom Chromium Binary    │
                              │  (our patched fork)        │
                              │  - C++ fingerprint patches │
                              │  - Per-profile data dir    │
                              │  - Proxy via --proxy-server│
                              └────────────────────────────┘
```

### 4.2 Component Breakdown

**A. Patched Chromium Binary**
- Fork of stable Chromium (current: ~126+)
- Apply C++ patches to Blink, V8, and network stack
- Each profile gets `--user-data-dir=profiles/<id>`
- Proxy injected via `--proxy-server=socks5://...`
- Build target: Linux x64 (for our VM)

**B. Electron Desktop App**
- Main process: Node.js — manages profiles (JSON/SQLite), launches Chromium binary
- Renderer process: React — UI for profile creation, proxy config, fingerprint settings
- IPC: Electron ipcMain/ipcRenderer for UI ↔ backend

**C. Profile Storage**
- SQLite database (via `better-sqlite3`) — one row per profile
- Each profile stores: fingerprint config JSON, proxy config, user-data-dir path, tags, last-used
- Profile data dirs isolated on disk: `~/.our-browser/profiles/<uuid>/`

**D. Fingerprint Engine (C++ patches)**
- Patch files applied to Chromium source before build
- Reads fingerprint config from an environment variable or a local IPC socket at startup
- Generates deterministic noise seeded from profile UUID (same seed = same fingerprint every time)

---

## 5. Build Game Plan (Phased)

### Phase 1 — Environment Setup & Research (Week 1–2)
- [ ] Set up Chromium build environment on Linux VM (Ubuntu 22.04 recommended)
  - Install `depot_tools`, `gn`, `ninja`
  - `fetch chromium` — pulls ~30GB source
  - Verify clean build: `autoninja -C out/Default chrome`
- [ ] Study existing open-source patches:
  - Clone `itbrowser-net/undetectable-fingerprint-browser` — read every patch file
  - Study `puppeteer-extra-plugin-stealth` for the JS side (understand what C++ must replace)
- [ ] Set up fingerprint testing environment:
  - BrowserLeaks.com, CreepJS, Pixelscan.net, Fingerprint.com demo

### Phase 2 — Core Chromium Patches (Week 3–6)
Apply patches in this order (simplest to complex):

1. **`navigator.webdriver` removal** — 2 lines in `content/renderer/render_frame_impl.cc`
2. **User-Agent + platform + languages** — `third_party/blink/renderer/core/frame/navigator.cc`
3. **Screen resolution** — `third_party/blink/renderer/core/frame/screen.cc`
4. **hardwareConcurrency + deviceMemory** — `navigator_id.idl` + implementation files
5. **Canvas 2D noise** — `HTMLCanvasElement::toDataURL` in `html_canvas_element.cc`
6. **WebGL renderer/vendor** — `webgl_rendering_context_base.cc`
7. **AudioContext noise** — `audio_buffer.cc` or `offline_audio_context.cc`
8. **Timezone** — `platform/time.cc` + V8 Date override
9. **WebRTC IP leak** — `p2p/base/port_allocator.cc` — force relay only or spoof
10. **Font enumeration** — `platform/fonts/font_cache.cc` — return allowlisted subset
11. **TLS JA3** — BoringSSL cipher suite ordering in `net/ssl/ssl_client_socket_impl.cc`
12. **Client Hints (`Sec-CH-UA-*`)** — `net/http/http_request_headers.cc`
13. **Plugins list** — `navigator_plugins.cc`
14. **Battery API** — `modules/battery/battery_manager.cc`

**Config injection method**: Read a JSON config file path from env var `BROWSER_PROFILE_CONFIG=/path/to/profile.json` at Chromium startup, parse in the browser process, distribute values to each renderer via Mojo IPC.

### Phase 3 — Profile Management Backend (Week 5–7, overlaps Phase 2)
- [ ] Node.js module: `ProfileManager`
  - `createProfile(options)` → generates UUID, writes profile JSON, creates user-data-dir
  - `launchProfile(id)` → writes temp config JSON, spawns patched Chromium binary with right flags
  - `deleteProfile(id)` → removes user-data-dir and DB record
- [ ] SQLite schema:
  ```sql
  CREATE TABLE profiles (
    id TEXT PRIMARY KEY,
    name TEXT,
    fingerprint_config TEXT,  -- JSON blob
    proxy_config TEXT,        -- JSON blob
    user_data_dir TEXT,
    created_at INTEGER,
    last_used_at INTEGER,
    tags TEXT
  );
  ```
- [ ] Proxy integration: Parse proxy from profile → pass to Chromium as:
  `--proxy-server=socks5://host:port` + `--proxy-auth=user:pass` (for authenticated proxies)

### Phase 4 — Electron Desktop UI (Week 7–10)
- [ ] Bootstrap: `npx create-electron-app our-browser --template=webpack-typescript`
- [ ] React UI screens:
  - **Profile List** — table of all profiles; launch button, edit, delete, duplicate
  - **Profile Editor** — form for: name, OS, browser version, screen, timezone, language, proxy
  - **Fingerprint Preview** — shows what each signal will report
  - **Settings** — Chromium binary path, default proxy, theme
- [ ] Launch flow:
  1. User clicks "Launch" on a profile
  2. Main process writes `profile-<id>.json` to temp dir
  3. Spawns patched Chromium: `chromiumBin --user-data-dir=... --proxy-server=... BROWSER_PROFILE_CONFIG=...`
  4. Multiple profiles = multiple Chromium processes, each isolated

### Phase 5 — Device Profile Database (Week 9–11)
- Build a database of real-device fingerprint combinations:
  - OS: Windows 10/11, macOS 13/14, Ubuntu 22
  - GPU: NVIDIA GTX 1060, RTX 3070, Intel UHD 620, Apple M1, AMD RX 580
  - Screen: 1920×1080, 2560×1440, 1440×900, 2560×1600
  - RAM: 4GB, 8GB, 16GB, 32GB
  - CPU cores: 2, 4, 6, 8, 12
- Source real fingerprints from BrowserLeaks, then build realistic combinations
- Ship 50–200 built-in device presets; user picks one per profile

### Phase 6 — Testing & Hardening (Week 11–13)
- [ ] Test against detection services:
  - Pixelscan.net — checks 40+ signals
  - CreepJS (abrahamjuliot.github.io/creepjs) — comprehensive trust score
  - BrowserLeaks.com — per-signal audit
  - Fingerprint.com/demo — commercial fingerprinting
  - bot.sannysoft.com — automation detection
- [ ] Fix any leaks found
- [ ] Test proxy: verify WebRTC doesn't leak real IP
- [ ] Test automation: verify Puppeteer/Playwright can connect via CDP (`--remote-debugging-port`)

### Phase 7 — VM Packaging & Installation (Week 13–14)
- [ ] Build Chromium: `autoninja -C out/Release chrome` → produces `chrome` binary
- [ ] Package Electron app: `electron-builder --linux deb` → produces `.deb` or AppImage
- [ ] Install on VM:
  ```bash
  # Install dependencies
  sudo apt install libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2
  
  # Install our browser
  sudo dpkg -i our-antidetect-browser_1.0.0_amd64.deb
  
  # Launch
  our-antidetect-browser
  ```

---

## 6. Tech Stack Summary

| Layer | Technology |
|---|---|
| Browser engine | Custom Chromium fork (C++ patches) |
| Desktop shell | Electron |
| UI framework | React + TypeScript |
| Build tool | Vite (renderer) + Webpack (main) |
| Profile storage | SQLite (`better-sqlite3`) |
| IPC | Electron ipcMain/ipcRenderer |
| Chromium build | `depot_tools` + `gn` + `ninja` |
| Fingerprint config | JSON files passed via env var |
| Proxy | SOCKS5/HTTP via Chromium `--proxy-server` flag |
| Packaging | `electron-builder` → .deb / AppImage |
| Target OS (VM) | Ubuntu 22.04 LTS x64 |

---

## 7. Key Technical Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Chromium build takes 8–30hrs first time | Use `sccache` for caching; incremental rebuilds are fast |
| C++ patches break on Chromium updates | Pin to a specific Chromium stable tag; update quarterly |
| Inconsistent fingerprint (signals contradict each other) | Build a "fingerprint coherence validator" — e.g., macOS UA must not claim Windows screen size |
| Proxy leaks via WebRTC | Force `TURN only` ICE policy or disable WebRTC entirely per profile |
| Detection via CDP automation signals | Patch `navigator.webdriver`; disable `--enable-automation` flag |
| TLS fingerprint (JA3/JA3S) detection | Randomize cipher suite order or use uTLS approach |
| Font list mismatch with claimed OS | Ship per-OS font allowlists matching real system fonts |

---

## 8. Minimum Viable Product (MVP) Feature Set

For the first working version on our VM:

1. Patched Chromium binary with 5 core patches (webdriver, UA, Canvas, WebGL, WebRTC)
2. Profile manager CLI (Node.js script — no UI yet) to create/launch profiles
3. Per-profile isolated user-data-dir
4. SOCKS5 proxy support per profile
5. 10 built-in device presets to pick from
6. Passes basic checks: bot.sannysoft.com, BrowserLeaks.com

UI and advanced features come after the engine works.

---

## 9. Estimated Timeline to VM Installation

| Phase | Duration | Output |
|---|---|---|
| Environment + research | 2 weeks | Chromium builds; patches understood |
| Core C++ patches | 4 weeks | Patched binary passing basic tests |
| Profile backend | 2 weeks | CLI profile launcher |
| Electron UI | 3 weeks | Desktop app |
| Device profiles DB | 1 week | 50 presets |
| Testing + hardening | 2 weeks | Passes Pixelscan, CreepJS |
| VM packaging | 1 week | .deb installer |
| **Total** | **~15 weeks** | **Working antidetect browser on VM** |

---

## 10. Advanced Technical Gaps We Can Exploit

Research revealed that every commercial antidetect browser has the same blind spots.
These are our competitive advantages if we address them:

### 10.1 TLS / JA4+ Fingerprinting (CRITICAL GAP — no one fixes this)
Every commercial tool uses the OS TLS stack, which means Cloudflare/DataDome/Kasada can
fingerprint the TLS ClientHello regardless of what the browser JS claims. Fix:
- Run a local SOCKS5-to-HTTPS proxy (e.g., using `utls` Go library or `tlsfuzzer`) that
  rewrites the TLS ClientHello cipher suite order + extensions to match real Chrome's JA4+
- Each profile gets a proxy that presents the correct JA4+ for its claimed browser version
- This single feature would make us technically superior to every existing tool

### 10.2 WebGPU Spoofing (2026 gap)
WebGL is addressed by all tools. WebGPU (shipping in all major browsers by 2026) exposes GPU
model and driver at a new granularity. Add WebGPU patches alongside WebGL.
Files: `third_party/blink/renderer/modules/webgpu/`

### 10.3 Cross-Signal Consistency Validator
Profiles that have mismatched signals (Canvas GPU ≠ WebGL GPU, timezone ≠ proxy IP, font
set ≠ claimed OS) are trivially detected. Before launching, validate:
- GPU claimed in WebGL matches GPU in canvas noise seed
- Timezone matches proxy IP geolocation (auto-set from proxy)
- Font allowlist matches claimed OS (Windows/macOS/Linux font sets differ)
- `hardwareConcurrency` / `deviceMemory` ratio is plausible for claimed device tier
- `Sec-CH-UA` Client Hints match `userAgent` string exactly

### 10.4 Behavioral Noise Injection (emerging detection layer)
Cloudflare, DataDome, Akamai now score mouse movement trajectories, keystroke timing,
and scroll patterns. A Gaussian noise overlay on mouse events injected at the Chromium
input handling level (`content/browser/renderer_host/input/`) would bypass this.

### 10.5 Real Device Fingerprint Library
Synthetic fingerprints fail statistical analysis. Use real-device fingerprint sourcing:
- Crowdsource from opt-in users or mine public browser telemetry
- Store as a library of (OS, GPU, screen, language, fonts) tuples
- Each profile draws from the library, not from random generation

---

## 11. Open-Source Projects (Updated List)

| Project | Engine | Key Feature |
|---|---|---|
| `CloakHQ/CloakBrowser` | Chromium 148 | 58 C++ patches; passes 30/30 detection tests as of 2026; best reference |
| `jo-inc/camofox-browser` | Firefox fork | Engine-level patches; drop-in Playwright replacement |
| `itbrowser-net/undetectable-fingerprint-browser` | Chromium | 170+ device profiles; WebGL/WebGPU/fonts/TLS |
| `coderkhalide/Anti-Detect-Browser` | Electron+Puppeteer | JS-layer only; good for learning Electron shell design |
| `niespodd/browser-fingerprinting` | N/A (research) | Documents all detection systems and countermeasures |
| `puppeteer-extra-plugin-stealth` | Any | JS only; NOT suitable for multi-account; good API reference |

**Start with CloakBrowser as our patch reference** — 58 patches already written for Chromium 148,
passes current detection tests. We build on top, add our UI + proxy + profile management.

---

## 12. Resources & References

- Chromium source: https://chromium.googlesource.com/chromium/src
- depot_tools: https://chromium.googlesource.com/chromium/tools/depot_tools
- **Best open-source reference**: https://github.com/CloakHQ/CloakBrowser (58 patches, current)
- Firefox fork reference: https://github.com/jo-inc/camofox-browser
- Detection system analysis: https://github.com/niespodd/browser-fingerprinting
- Open-source Electron shell: https://github.com/coderkhalide/Anti-Detect-Browser
- Fingerprint testing: https://browserleaks.com / https://pixelscan.net / https://abrahamjuliot.github.io/creepjs
- Chromium build guide: https://chromium.googlesource.com/chromium/src/+/main/docs/linux/build_instructions.md
- puppeteer-extra-plugin-stealth (JS reference): https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth
