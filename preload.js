const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  version: process.versions.electron,
  getDisplayBounds: () => ipcRenderer.invoke('get-display-bounds'),
  onAppCloseAttempt: (callback) => ipcRenderer.on('app-close-attempt', callback),
  requestClose: () => ipcRenderer.send('app-close')
});
