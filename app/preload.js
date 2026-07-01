// preload.js – IPC bridge for server events
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startServer: () => ipcRenderer.send('start-server'),
  onServerEvent: (callback) => ipcRenderer.on('server-event', (event, msg) => callback(msg)),
  onServerExit: (callback) => ipcRenderer.on('server-exit', (event) => callback()),
  stopServer: () => ipcRenderer.send('stop-server')
});