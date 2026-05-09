const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.disableHardwareAcceleration();

function getAllDisplayBounds() {
  const displays = screen.getAllDisplays();
  const left = Math.min(...displays.map((display) => display.bounds.x));
  const top = Math.min(...displays.map((display) => display.bounds.y));
  const right = Math.max(...displays.map((display) => display.bounds.x + display.bounds.width));
  const bottom = Math.max(...displays.map((display) => display.bounds.y + display.bounds.height));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}

function getRendererDisplayBounds() {
  const allDisplayBounds = getAllDisplayBounds();
  return screen.getAllDisplays().map((display) => ({
    x: display.bounds.x - allDisplayBounds.x,
    y: display.bounds.y - allDisplayBounds.y,
    width: display.bounds.width,
    height: display.bounds.height
  }));
}

function createWindow() {
  const displayBounds = getAllDisplayBounds();
  const mainWindow = new BrowserWindow({
    x: displayBounds.x,
    y: displayBounds.y,
    width: displayBounds.width,
    height: displayBounds.height,
    frame: false,
    fullscreen: false,
    fullscreenable: false,
    movable: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  let allowClose = false;
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.focus();

  mainWindow.on('close', (event) => {
    if (!allowClose) {
      event.preventDefault();
      mainWindow.webContents.send('app-close-attempt');
    }
  });

  mainWindow.on('blur', () => {
    if (!allowClose && !mainWindow.isDestroyed()) {
      setTimeout(() => {
        if (!allowClose && !mainWindow.isDestroyed()) {
          mainWindow.focus();
        }
      }, 80);
    }
  });

  ipcMain.on('app-close', () => {
    allowClose = true;
    if (!mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.setBounds(displayBounds);
}

app.whenReady().then(() => {
  ipcMain.handle('get-display-bounds', () => getRendererDisplayBounds());
  createWindow();
});

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
