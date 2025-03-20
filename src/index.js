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
    
    // Extrair nome do jogo da URL
    const gameName = url.split('/').pop().split('?')[0] || 'game-download';
    
    // Caminho para o arquivo ZIP final
    const zipPath = path.join(downloadsDir, `${gameName}.zip`);
    
    console.log(`Iniciando download de: ${url}`);
    
    // Usar opção redirect: 'follow' para seguir redirecionamentos
    const response = await fetch(url, {
      redirect: 'follow', // Isso é importante para seguir redirecionamentos
      headers: {
        // Adicionar um user-agent para simular um navegador
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Falha no download: ${response.statusText}`);
    }
    
    // Verificar se o content-type é compatível com um arquivo executável
    const contentType = response.headers.get('content-type');
    console.log(`Content-Type recebido: ${contentType}`);
    
    // Se o content-type for text/html, provavelmente não é o executável
    if (contentType && contentType.includes('text/html')) {
      throw new Error('O URL fornecido não aponta para um arquivo executável, mas para uma página web');
    }
    
    // Pegar o nome do arquivo do header Content-Disposition, se disponível
    const contentDisposition = response.headers.get('content-disposition');
    let fileName = gameName;
    
    if (contentDisposition) {
      const fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (fileNameMatch && fileNameMatch[1]) {
        fileName = fileNameMatch[1].replace(/['"]/g, '');
        console.log(`Nome do arquivo detectado no header: ${fileName}`);
      }
    }
    
    // Caminho para o arquivo temporário
    const filePath = path.join(tempDir, fileName);
    
    // Converter a resposta em um buffer
    const buffer = await response.buffer();
    
    // Verificar se os primeiros bytes parecem ser de um arquivo executável Windows
    // "MZ" é a assinatura de arquivos .exe
    if (buffer.length > 2 && buffer[0] === 0x4D && buffer[1] === 0x5A) {
      console.log('Arquivo parece ser um executável Windows válido');
    } else {
      console.log('Aviso: Arquivo não parece ser um executável Windows');
    }
    
    // Salvar o buffer em um arquivo
    fs.writeFileSync(filePath, buffer);
    
    // Criar ZIP com o arquivo baixado
    const zip = new AdmZip();
    zip.addLocalFile(filePath, '', fileName);
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