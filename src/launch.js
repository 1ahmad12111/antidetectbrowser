#!/usr/bin/env node
'use strict';

const { create, load, setProxy, setCookiesFile, setStartupUrls, remove, listAll } = require('./profiles');
const { launch } = require('./browser');
const { listPresets } = require('./presets');

const [,, command, ...args] = process.argv;

function parseFlags(args) {
  const flags = {};
  for (const arg of args) {
    const m = arg.match(/^--([^=]+)=(.+)$/);
    if (m) flags[m[1]] = m[2];
  }
  return flags;
}

function printUsage() {
  console.log(`
Antidetect Browser — CLI

Commands:
  create <name> [options]              Create a new profile
  launch <name> [--cookies=file]       Launch a profile
  list                                 List all profiles
  set-proxy <name> <proxy|none>        Update proxy for a profile
  set-urls <name> <url1,url2,...>      Set startup URLs for a profile
  set-cookies <name> <file>            Set a cookies file for a profile
  delete <name>                        Delete a profile and all its data
  presets                              List available device presets

Create options:
  --preset=<name>                      Device preset (default: windows-11-rtx3070-1080p)
  --proxy=<url>                        Proxy, e.g. socks5://host:port or http://host:port
  --timezone=<tz>                      Timezone (default: America/New_York)
  --language=<lang>                    Language (default: en-US)
  --startup-urls=<url1,url2>           Comma-separated URLs to open on launch
  --cookies=<path>                     Path to cookies JSON file to inject on launch

Cookies file format (Cookie-Editor / EditThisCookie JSON export):
  [{ "name": "session", "value": "abc", "domain": ".paypal.com", "path": "/" }]

Examples:
  node src/launch.js create "Allen Wallace" --preset=macos-14-m2-retina --proxy=http://10.190.0.2:9001 --startup-urls=https://www.apple.com,https://www.paypal.com --cookies=C:\\cookies\\allen.json
  node src/launch.js launch "Allen Wallace"
  node src/launch.js launch "Allen Wallace" --cookies=C:\\cookies\\new.json
  node src/launch.js set-proxy "Allen Wallace" socks5://new-ip:1080
  node src/launch.js set-urls "Allen Wallace" https://www.apple.com,https://www.paypal.com
  node src/launch.js set-cookies "Allen Wallace" C:\\cookies\\allen.json
  node src/launch.js list
  node src/launch.js delete "Allen Wallace"
`);
}

function cmdCreate(args) {
  const name = args[0];
  if (!name) { console.error('Usage: create <name> [options]'); process.exit(1); }
  const flags = parseFlags(args.slice(1));

  const startupUrls = flags['startup-urls']
    ? flags['startup-urls'].split(',').map(u => u.trim()).filter(Boolean)
    : [];

  const profile = create({
    name,
    preset: flags.preset || 'windows-11-rtx3070-1080p',
    proxy: flags.proxy && flags.proxy !== 'none' ? flags.proxy : null,
    timezone: flags.timezone || 'America/New_York',
    language: flags.language || 'en-US',
    startupUrls,
    cookiesFile: flags.cookies || null,
  });

  console.log(`\nCreated profile "${profile.name}"`);
  console.log(`  ID           : ${profile.id}`);
  console.log(`  Seed         : ${profile.seed}`);
  console.log(`  Preset       : ${profile.preset}`);
  console.log(`  Proxy        : ${profile.proxy || 'none'}`);
  console.log(`  Startup URLs : ${profile.startupUrls.length ? profile.startupUrls.join(', ') : 'none'}`);
  console.log(`  Cookies file : ${profile.cookiesFile || 'none'}\n`);
}

async function cmdLaunch(args) {
  const name = args[0];
  if (!name) { console.error('Usage: launch <name> [--cookies=file]'); process.exit(1); }
  const flags = parseFlags(args.slice(1));
  const profile = load(name);
  await launch(profile, flags.cookies || null);
}

function cmdList() {
  const profiles = listAll();
  if (profiles.length === 0) {
    console.log('No profiles yet. Run: node src/launch.js create <name>');
    return;
  }
  console.log(`\n${'NAME'.padEnd(25)} ${'PRESET'.padEnd(28)} ${'PROXY'.padEnd(30)} ${'STARTUP URLS'.padEnd(35)} LAST USED`);
  console.log('─'.repeat(130));
  for (const p of profiles) {
    const proxy = p.proxy || 'none';
    const urls = (p.startupUrls || []).join(', ') || 'none';
    const lastUsed = p.last_used_at ? new Date(p.last_used_at).toLocaleString() : 'never';
    console.log(
      `${p.name.padEnd(25)} ${p.preset.padEnd(28)} ${proxy.padEnd(30)} ${urls.slice(0, 33).padEnd(35)} ${lastUsed}`
    );
  }
  console.log('');
}

function cmdSetProxy(args) {
  const name = args[0];
  const proxy = args[1];
  if (!name || !proxy) { console.error('Usage: set-proxy <name> <proxy|none>'); process.exit(1); }
  const updated = setProxy(name, proxy === 'none' ? null : proxy);
  console.log(`Updated proxy for "${name}": ${updated.proxy || 'none'}`);
}

function cmdSetUrls(args) {
  const name = args[0];
  const urlsArg = args[1];
  if (!name || !urlsArg) { console.error('Usage: set-urls <name> <url1,url2,...>'); process.exit(1); }
  const urls = urlsArg.split(',').map(u => u.trim()).filter(Boolean);
  setStartupUrls(name, urls);
  console.log(`Updated startup URLs for "${name}": ${urls.join(', ')}`);
}

function cmdSetCookies(args) {
  const name = args[0];
  const file = args[1];
  if (!name || !file) { console.error('Usage: set-cookies <name> <path-to-cookies.json>'); process.exit(1); }
  setCookiesFile(name, file === 'none' ? null : file);
  console.log(`Updated cookies file for "${name}": ${file}`);
}

function cmdDelete(args) {
  const name = args[0];
  if (!name) { console.error('Usage: delete <name>'); process.exit(1); }
  remove(name);
  console.log(`Deleted profile "${name}" and all its data.`);
}

function cmdPresets() {
  console.log('\nAvailable device presets:');
  for (const p of listPresets()) console.log(`  ${p}`);
  console.log('');
}

(async () => {
  switch (command) {
    case 'create':      cmdCreate(args); break;
    case 'launch':      await cmdLaunch(args); break;
    case 'list':        cmdList(); break;
    case 'set-proxy':   cmdSetProxy(args); break;
    case 'set-urls':    cmdSetUrls(args); break;
    case 'set-cookies': cmdSetCookies(args); break;
    case 'delete':      cmdDelete(args); break;
    case 'presets':     cmdPresets(); break;
    default:            printUsage(); break;
  }
})();
