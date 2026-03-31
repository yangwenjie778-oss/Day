const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onCloseRequested: (callback) => {
    const subscription = (event, ...args) => callback(...args);
    ipcRenderer.on('close-requested', subscription);
    return () => ipcRenderer.removeListener('close-requested', subscription);
  },
  backupComplete: () => ipcRenderer.send('backup-complete'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  writeTextFile: (filePath, content) => ipcRenderer.invoke('write-text-file', filePath, content),
  readDir: (dirPath) => ipcRenderer.invoke('read-dir', dirPath),
  removeFile: (filePath) => ipcRenderer.invoke('remove-file', filePath),
  createDir: (dirPath) => ipcRenderer.invoke('create-dir', dirPath),
  joinPath: (...args) => ipcRenderer.invoke('join-path', ...args)
});
