const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  downloadGame: (url, selector) => ipcRenderer.invoke('download-game', url, selector)
});

//qnd chama no frontsolicite um download sem acessar o nodejs de forma direta