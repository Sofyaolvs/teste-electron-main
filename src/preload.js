const { contextBridge, ipcRenderer } = require('electron');

// Expor API segura para o renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Função para baixar jogos que não necessita mais do seletor
  downloadGame: (url) => ipcRenderer.invoke('download-game', url)
});