import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import windowStateKeeper from 'electron-window-state';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  // Load the previous state with default window bounds
  let mainWindowState = windowStateKeeper({
    defaultWidth: 1200,
    defaultHeight: 800,
    file: 'window-state.json' // Explicitly set filename for persistence
  });

  // Create the browser window using the state information
  mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    // Optional: hide menu bar
    autoHideMenuBar: true
  });

  // Let us register listeners on the window, so we can update the state
  // automatically (the listeners will be removed when the window is closed)
  // and restore the maximized state, if it was maximized.
  mainWindowState.manage(mainWindow);

  // In development, load from the dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    // Open DevTools
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built index.html
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // Intercept window close to trigger backup
  mainWindow.on('close', (e) => {
    if (mainWindow) {
      e.preventDefault();
      mainWindow.webContents.send('close-requested');
    }
  });
}

// IPC Handlers
ipcMain.on('backup-complete', () => {
  if (mainWindow) {
    mainWindow.destroy();
    mainWindow = null;
  }
});

ipcMain.handle('select-directory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (canceled) return null;
  return filePaths[0];
});

ipcMain.handle('write-text-file', async (event, filePath, content) => {
  await fs.writeFile(filePath, content, 'utf8');
  return true;
});

ipcMain.handle('read-dir', async (event, dirPath) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries.map(entry => ({
    name: entry.name,
    path: path.join(dirPath, entry.name),
    isDirectory: entry.isDirectory()
  }));
});

ipcMain.handle('remove-file', async (event, filePath) => {
  await fs.unlink(filePath);
  return true;
});

ipcMain.handle('create-dir', async (event, dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
  return true;
});

ipcMain.handle('join-path', async (event, ...args) => {
  return path.join(...args);
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
