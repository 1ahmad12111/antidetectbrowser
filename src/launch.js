#!/usr/bin/env node
'use strict';

const { create, load, setProxy, remove, listAll } = require('./profiles');
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
  create <name> [options]    Create a new profile
  launch <name>              Launch a profile
  list                       List all profiles
  set-proxy <name> <proxy>   Update proxy for a profile (use "none" to remove)
  delete <name>              Delete a profile and all its data
  presets                    List available device presets

Create options:
  --preset=<name>            Device preset (default: windows-11-rtx3070-1080p)
  --proxy=<url>              Proxy URL, e.g. socks5://127.0.0.1:1080
  --timezone=<tz>            Timezone (default: America/New_York)
  --language=<lang>          Language (default: en-US)

Examples:
  node src/launch.js create "fb-account-1" --preset=windows-11-rtx3070-1080p --proxy=socks5://127.0.0.1:1080
  node src/launch.js create "ig-account-2" --preset=macos-14-m2-retina --timezone=Europe/London
  node src/launch.js launch "fb-account-1"
  node src/launch.js set-proxy "fb-account-1" socks5://new-ip:1080
  node src/launch.js set-proxy "fb-account-1" none
  node src/launch.js list
  node src/launch.js delete "fb-account-1"
`);
}

function cmdCreate(args) {
  const name = args[0];
  if (!name) { console.error('Usage: create <name> [--preset=...] [--proxy=...] [--timezone=...] [--language=...]'); process.exit(1); }
  const flags = parseFlags(args.slice(1));
  const profile = create({
    name,
    preset: flags.preset || 'windows-11-rtx3070-1080p',
    proxy: flags.proxy && flags.proxy !== 'none' ? flags.proxy : null,
    timezone: flags.timezone || 'America/New_York',
    language: flags.language || 'en-US',
  });
  console.log(`Created profile "${profile.name}"`);
  console.log(`  ID    : ${profile.id}`);
  console.log(`  Seed  : ${profile.seed}`);
  console.log(`  Preset: ${profile.preset}`);
  console.log(`  Proxy : ${profile.proxy || 'none'}`);
}

function cmdLaunch(args) {
  const name = args[0];
  if (!name) { console.error('Usage: launch <name>'); process.exit(1); }
  const profile = load(name);
  launch(profile);
}

function cmdList() {
  const profiles = listAll();
  if (profiles.length === 0) {
    console.log('No profiles yet. Run: node src/launch.js create <name>');
    return;
  }
  console.log(`\n${'NAME'.padEnd(30)} ${'PRESET'.padEnd(30)} ${'PROXY'.padEnd(35)} LAST USED`);
  console.log('─'.repeat(110));
  for (const p of profiles) {
    const proxy = p.proxy || 'none';
    const lastUsed = p.last_used_at ? new Date(p.last_used_at).toLocaleString() : 'never';
    console.log(`${p.name.padEnd(30)} ${p.preset.padEnd(30)} ${proxy.padEnd(35)} ${lastUsed}`);
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

switch (command) {
  case 'create':   cmdCreate(args); break;
  case 'launch':   cmdLaunch(args); break;
  case 'list':     cmdList(); break;
  case 'set-proxy': cmdSetProxy(args); break;
  case 'delete':   cmdDelete(args); break;
  case 'presets':  cmdPresets(); break;
  default:         printUsage(); break;
}
