const { contextBridge, ipcRenderer } = require('electron');

// Expõe funções seguras para o processo de renderização
contextBridge.exposeInMainWorld('electronAPI', {
  // Adicionando suporte ao seletor como parâmetro opcional
  downloadGame: (url, selector) => ipcRenderer.invoke('download-game', url, selector)
});