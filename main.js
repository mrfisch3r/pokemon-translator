const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 760,
    minWidth: 940,
    minHeight: 700,
    center: true,
    frame: false,
    fullscreen: true,
    fullscreenable: true,
    autoHideMenuBar: true,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  let allowClose = false;

  mainWindow.on('close', (event) => {
    if (!allowClose) {
      event.preventDefault();
      mainWindow.webContents.send('app-close-attempt');
    }
  });

  ipcMain.on('app-close', () => {
    allowClose = true;
    if (!mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
