const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  version: process.versions.electron,
  onAppCloseAttempt: (callback) => ipcRenderer.on('app-close-attempt', callback),
  requestClose: () => ipcRenderer.send('app-close')
});
