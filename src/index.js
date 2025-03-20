const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const AdmZip = require('adm-zip');

// Verificar se está em produção
const isProduction = app.isPackaged;

// Função para criar a janela principal
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Carregar o arquivo HTML
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Abrir DevTools em desenvolvimento
  if (!isProduction) {
    mainWindow.webContents.openDevTools();
  }
}

// Criar a janela quando o app estiver pronto
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Fechar o app quando todas as janelas forem fechadas 
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Lidar com o download do jogo
ipcMain.handle('download-game', async (event, url) => {
  try {
    const tempDir = path.join(app.getPath('temp'), 'game-download-' + Date.now());
    const downloadsDir = app.getPath('downloads');
    
    // Criar diretório temporário se não existir
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Extrair nome do jogo da URL (exemplo básico)
    const gameName = url.split('/').pop().split('?')[0] || 'game-download'
    
    // Caminho para o arquivo ZIP final
    const zipPath = path.join(downloadsDir, `${gameName}.zip`);
    
    // Baixar arquivo
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Falha no download: ${response.statusText}`);
    }
    
    // Caminho para o arquivo temporário
    const filePath = path.join(tempDir, gameName);
    
    // Salvar o conteúdo do download em um arquivo
    const fileStream = fs.createWriteStream(filePath);
    response.body.pipe(fileStream);
    
    // Aguardar o fim do download
    await new Promise((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });
    
    // Criar ZIP com o arquivo baixado
    const zip = new AdmZip();
    zip.addLocalFile(filePath, '', gameName);
    zip.writeZip(zipPath);
    
    // Limpar diretório temporário
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    return {
      success: true,
      message: 'Download concluído com sucesso',
      path: zipPath
    };
  } catch (error) {
    console.error('Erro no download:', error);
    return {
      success: false,
      message: `Erro: ${error.message}`
    };
  }
});