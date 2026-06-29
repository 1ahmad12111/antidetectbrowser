'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  listProfiles:  ()           => ipcRenderer.invoke('profiles:list'),
  listPresets:   ()           => ipcRenderer.invoke('profiles:presets'),
  createProfile: (opts)       => ipcRenderer.invoke('profiles:create', opts),
  launchProfile: (name, cookies) => ipcRenderer.invoke('profiles:launch', name, cookies),
  deleteProfile: (name)       => ipcRenderer.invoke('profiles:delete', name),
  setProxy:      (name, p)    => ipcRenderer.invoke('profiles:set-proxy', name, p),
  setUrls:       (name, urls) => ipcRenderer.invoke('profiles:set-urls', name, urls),
  setCookies:    (name, file) => ipcRenderer.invoke('profiles:set-cookies', name, file),
  detectGeo:     (proxy)      => ipcRenderer.invoke('profiles:detect-geo', proxy),
});
