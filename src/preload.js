const { contextBridge, ipcRenderer } = require('electron');

// Expõe funções seguras para o processo de renderização
contextBridge.exposeInMainWorld('electronAPI', {
  downloadGame: (url) => ipcRenderer.invoke('download-game', url)
});