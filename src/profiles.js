'use strict';

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const PROFILES_DIR = path.join(ROOT, 'profiles');
const DATA_DIR = path.join(ROOT, 'data');

function ensureDirs() {
  fs.mkdirSync(PROFILES_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function profilePath(name) {
  return path.join(PROFILES_DIR, `${name}.json`);
}

function userDataDir(name) {
  return path.join(DATA_DIR, name);
}

function exists(name) {
  return fs.existsSync(profilePath(name));
}

function load(name) {
  const p = profilePath(name);
  if (!fs.existsSync(p)) throw new Error(`Profile "${name}" does not exist.`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function save(profile) {
  ensureDirs();
  fs.writeFileSync(profilePath(profile.name), JSON.stringify(profile, null, 2));
}

function create({ name, preset, proxy = null, timezone = 'America/New_York', language = 'en-US', startupUrls = [], cookiesFile = null, geo = null, notes = '' }) {
  ensureDirs();
  if (exists(name)) throw new Error(`Profile "${name}" already exists.`);

  const profile = {
    id: randomUUID(),
    name,
    seed: randomUUID().replace(/-/g, '').slice(0, 16),
    preset,
    proxy,
    timezone,
    language,
    startupUrls,
    cookiesFile,
    geo,
    notes,
    created_at: new Date().toISOString(),
    last_used_at: null,
  };

  save(profile);
  fs.mkdirSync(userDataDir(name), { recursive: true });
  return profile;
}

function setProxy(name, proxy) {
  const profile = load(name);
  profile.proxy = proxy;
  save(profile);
  return profile;
}

function setCookiesFile(name, cookiesFile) {
  const profile = load(name);
  profile.cookiesFile = cookiesFile;
  save(profile);
  return profile;
}

function setStartupUrls(name, urls) {
  const profile = load(name);
  profile.startupUrls = urls;
  save(profile);
  return profile;
}

function setNotes(name, notes) {
  const profile = load(name);
  profile.notes = notes;
  save(profile);
  return profile;
}

// QoL 1: Duplicate a profile — copy all settings, fresh seed + new name
function duplicate(name, newName) {
  const src = load(name);
  if (exists(newName)) throw new Error(`Profile "${newName}" already exists.`);
  const copy = {
    ...src,
    id: randomUUID(),
    name: newName,
    seed: randomUUID().replace(/-/g, '').slice(0, 16), // fresh fingerprint
    created_at: new Date().toISOString(),
    last_used_at: null,
  };
  ensureDirs();
  fs.writeFileSync(profilePath(newName), JSON.stringify(copy, null, 2));
  fs.mkdirSync(userDataDir(newName), { recursive: true });
  return copy;
}

function touchLastUsed(name) {
  const profile = load(name);
  profile.last_used_at = new Date().toISOString();
  save(profile);
}

function remove(name) {
  const p = profilePath(name);
  if (!fs.existsSync(p)) throw new Error(`Profile "${name}" does not exist.`);
  fs.rmSync(p);
  const dataDir = userDataDir(name);
  if (fs.existsSync(dataDir)) fs.rmSync(dataDir, { recursive: true });
}

function listAll() {
  ensureDirs();
  return fs.readdirSync(PROFILES_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(PROFILES_DIR, f), 'utf8')))
    .sort((a, b) => (b.last_used_at || '').localeCompare(a.last_used_at || ''));
}

module.exports = { create, load, save, setProxy, setCookiesFile, setStartupUrls, setNotes, duplicate, touchLastUsed, remove, listAll, userDataDir };
