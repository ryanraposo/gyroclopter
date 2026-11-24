// preload.js – IPC bridge for server events
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  illustrated: process.argv.includes('--illustrated-window'),
  isStore: process.argv.includes('--store-edition'),
  copyPairingUrl: (url) => ipcRenderer.invoke('copy-pairing-url', url),
  startServer: () => ipcRenderer.send('start-server'),
  onServerEvent: (callback) => ipcRenderer.on('server-event', (event, msg) => callback(msg)),
  onServerExit: (callback) => ipcRenderer.on('server-exit', (event) => callback()),
  stopServer: () => ipcRenderer.send('stop-server'),
  openAccessibilitySettings: () => ipcRenderer.send('open-accessibility-settings')
});
