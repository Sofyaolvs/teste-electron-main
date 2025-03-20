const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
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

// Função para baixar jogo usando Puppeteer
ipcMain.handle('download-game', async (event, url, selectorDoButaoDeDownload) => {
  let browser = null;
  try {
    const tempDir = path.join(app.getPath('temp'), 'game-download-' + Date.now());
    const downloadsDir = app.getPath('downloads');
    
    // Criar diretório temporário se não existir
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Configuração do Puppeteer
    browser = await puppeteer.launch({
      headless: false, // false para visualizar o que está acontecendo, mude para true em produção
      defaultViewport: null,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    // Configurar o diretório de downloads
    const page = await browser.newPage();
    
    // Configurar onde os downloads serão salvos
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: tempDir
    });
    
    // Navegar para a URL
    await page.goto(url, { waitUntil: 'networkidle2' });
    console.log(`Navegou para: ${url}`);
    
    // Clicar no botão de download (este seletor deve ser ajustado conforme o site)
    // Se não for fornecido um seletor, tentaremos alguns seletores comuns
    const seletor = selectorDoButaoDeDownload || 'a[href*=".exe"], button:contains("Download"), .download-button, #download-button';
    
    console.log(`Procurando pelo botão de download usando seletor: ${seletor}`);
    await page.waitForSelector(seletor, { visible: true, timeout: 30000 });
    
    // Clicar no botão e esperar pelo download iniciar
    await Promise.all([
      page.click(seletor),
      // Esperar um pouco para o download começar
      new Promise(resolve => setTimeout(resolve, 5000))
    ]);
    
    console.log('Clicou no botão de download, aguardando download...');
    
    // Esperar alguns segundos para garantir que o download foi iniciado
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Verificar quais arquivos foram baixados
    const files = fs.readdirSync(tempDir);
    console.log('Arquivos encontrados:', files);
    
    if (files.length === 0) {
      throw new Error('Nenhum arquivo foi baixado');
    }
    
    // Pegar o arquivo baixado (presumindo que seja o primeiro da lista)
    const downloadedFile = files[0];
    const filePath = path.join(tempDir, downloadedFile);
    
    // Esperar até que o arquivo esteja completamente baixado (não tenha extensão .crdownload ou .part)
    let fileIsReady = !downloadedFile.endsWith('.crdownload') && !downloadedFile.endsWith('.part');
    let attempts = 0;
    const maxAttempts = 60; // 5 minutos (60 x 5s)
    
    while (!fileIsReady && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar 5 segundos
      const currentFiles = fs.readdirSync(tempDir);
      
      // Verificar se algum arquivo tem extensão .crdownload ou .part
      const pendingFiles = currentFiles.filter(f => f.endsWith('.crdownload') || f.endsWith('.part'));
      fileIsReady = pendingFiles.length === 0 && currentFiles.length > 0;
      
      attempts++;
      console.log(`Verificando download... Tentativa ${attempts}/${maxAttempts}`);
    }
    
    if (!fileIsReady) {
      throw new Error('Tempo esgotado esperando o download completar');
    }
    
    // Criar o ZIP com o arquivo baixado
    const finalFiles = fs.readdirSync(tempDir);
    if (finalFiles.length === 0) {
      throw new Error('Nenhum arquivo foi baixado');
    }
    
    // Encontrar arquivos executáveis
    const exeFiles = finalFiles.filter(f => f.endsWith('.exe'));
    const targetFile = exeFiles.length > 0 ? exeFiles[0] : finalFiles[0];
    const targetPath = path.join(tempDir, targetFile);
    
    // Caminho para o arquivo ZIP final
    const zipPath = path.join(downloadsDir, `${targetFile}.zip`);
    
    // Criar ZIP com o arquivo baixado
    const zip = new AdmZip();
    zip.addLocalFile(targetPath, '', targetFile);
    zip.writeZip(zipPath);
    
    // Fechar o navegador
    await browser.close();
    browser = null;
    
    // Limpar diretório temporário
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    return {
      success: true,
      message: 'Download concluído com sucesso',
      path: zipPath,
      fileName: targetFile
    };
  } catch (error) {
    console.error('Erro no download:', error);
    
    // Tentar fechar o navegador se ainda estiver aberto
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.error('Erro ao fechar o navegador:', e);
      }
    }
    
    return {
      success: false,
      message: `Erro: ${error.message}`
    };
  }
});