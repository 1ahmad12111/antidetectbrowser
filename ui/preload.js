'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  listProfiles:    ()              => ipcRenderer.invoke('profiles:list'),
  listPresets:     ()              => ipcRenderer.invoke('profiles:presets'),
  runningProfiles: ()              => ipcRenderer.invoke('profiles:running'),
  createProfile:   (opts)          => ipcRenderer.invoke('profiles:create', opts),
  launchProfile:   (name, cookies) => ipcRenderer.invoke('profiles:launch', name, cookies),
  closeProfile:    (name)          => ipcRenderer.invoke('profiles:close', name),
  launchAll:       ()              => ipcRenderer.invoke('profiles:launch-all'),
  closeAll:        ()              => ipcRenderer.invoke('profiles:close-all'),
  deleteProfile:   (name)          => ipcRenderer.invoke('profiles:delete', name),
  duplicateProfile:(name, newName) => ipcRenderer.invoke('profiles:duplicate', name, newName),
  setProxy:        (name, p)       => ipcRenderer.invoke('profiles:set-proxy', name, p),
  setUrls:         (name, urls)    => ipcRenderer.invoke('profiles:set-urls', name, urls),
  setCookies:      (name, file)    => ipcRenderer.invoke('profiles:set-cookies', name, file),
  setNotes:        (name, notes)   => ipcRenderer.invoke('profiles:set-notes', name, notes),
  detectGeo:       (proxy)         => ipcRenderer.invoke('profiles:detect-geo', proxy),
  testProxy:       (proxy)         => ipcRenderer.invoke('profiles:test-proxy', proxy),
  healthCheck:     ()              => ipcRenderer.invoke('profiles:health-check'),
  pasteClipboardCookies: (name)    => ipcRenderer.invoke('profiles:inject-clipboard-cookies', name),
});
