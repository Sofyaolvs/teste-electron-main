const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const AdmZip = require('adm-zip');

const isProduction = app.isPackaged;

// cria uma janela principal
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

  // arquivo html
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

// cria a janela qnd o app estiver pronto
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

// funcção p baixar jogo usando Puppeteer
ipcMain.handle('download-game', async (event, url) => {
  let browser = null;
  try {
    //caminho p pasta temporaria, gera o nome unico p diretorio
    const tempDir = path.join(app.getPath('temp'), 'game-download-' + Date.now());
    const downloadsDir = app.getPath('downloads'); //caminho da pasta 
    
    //ve seja existe 
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // puppeteer - sempre em modo headless (sem interface gráfica)
    browser = await puppeteer.launch({
      headless: 'new', // Use o novo modo headless sempre
      defaultViewport: null,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    // cria nova aba no nav
    const page = await browser.newPage();
    
    // Configurar onde os downloads serão salvos
    const client = await page.target().createCDPSession(); //sessão do prot devTools p ter controle sob o nav
    await client.send('Page.setDownloadBehavior', { //config o comportamento de download da pag
      behavior: 'allow', //download automatico sem interaão do usuário
      downloadPath: tempDir //pasta q os arq serão baixados
    });
    
    // Navegar p URL
    await page.goto(url, { waitUntil: 'networkidle2' });
    console.log(`Navegou para: ${url}`);
    
    // Seletores aprimorados para detecção automática de botões de download
    const seletor = 
  'a[href*=".exe"], ' + 
  'a[download], ' +
  '.download-button, ' + 
  '#download-button, ' +
  'a.btn-download, ' +
  'button.download, ' +
  'a[href*=".zip"], ' +
  'a[href*=".msi"], ' +
  'a[href*="download"]';
    
    console.log(`Procurando pelo botão de download usando seletor: ${seletor}`);
    
    // Tentar encontrar o elemento 
    try {
      await page.waitForSelector(seletor, { visible: true, timeout: 5000 });
      console.log('Botão de download encontrado pelo seletor!');
    } catch (error) {
      console.log('Seletor não encontrado, tentando avaliação de página...');
      
      // Se o seletor não for encontrado, tente encontrar links que pareçam ser de download
      const downloadLinks = await page.evaluate(() => { 
        const links = Array.from(document.querySelectorAll('a'));//acessa o dom da pagina p achar o botão
        return links
        //verifica se o link parece um link de download
          .filter(link => {
            const href = (link.href || '').toLowerCase();
            const text = (link.innerText || '').toLowerCase();
            return (href.includes('.exe') || 
                   href.includes('Download') || 
                   href.includes('.zip') || 
                  //  href.includes('.msi') ||
                  //  href.includes('.rar') ||
                  //  href.includes('get') ||
                   text.includes('download') ||
                  //  text.includes('get') ||
                   text.includes('install')) &&
                   link.offsetWidth > 0 && 
                   link.offsetHeight > 0;
          })
          //cria um array com + detalhes sobre os links
          .map((link, index) => ({
            index,
            href: link.href,
            text: link.innerText,
            position: link.getBoundingClientRect()
          }));
      });
      
      console.log('Possíveis links de download encontrados:', downloadLinks);
      
      if (downloadLinks.length > 0) {
        // Encontra o link que mais provavelmente é de download
        // Priorizando links com palavras-chave específicas
        let bestLinkIndex = 0;
        let bestScore = 0;
        
        downloadLinks.forEach((link, index) => {
          let score = 0;
          const href = link.href.toLowerCase();
          const text = link.text.toLowerCase();
          
          if (href.includes('.exe')) score += 5;
          if (href.includes('.zip')) score += 4;
          // if (href.includes('.msi')) score += 4;
          if (text.includes('download now')) score += 3;
          if (text.includes('Download')) score += 2;
          if(text.includes('Download Now')) score += 2
          // if (href.includes('download')) score += 2;
          if (link.position.y < 500) score += 1; // Links mais no topo têm prioridade
          
          if (score > bestScore) {
            bestScore = score;
            bestLinkIndex = index;
          }
        });
        
        // clica no melhor link encontrado
        const bestLink = downloadLinks[bestLinkIndex];
        console.log(`Selecionado melhor link: ${bestLink.text} (${bestLink.href})`);
        
        try {
          await page.click(`a[href="${bestLink.href}"]`);
          console.log('Clicou no link de download!');
        } catch (clickError) {
          console.log('Erro ao clicar no link, tentando via JavaScript:', clickError);
          // Se não conseguir clicar diretamente, tenta via JavaScript
          await page.evaluate((href) => {
            const links = Array.from(document.querySelectorAll('a'));
            const targetLink = links.find(link => link.href === href);
            if (targetLink) targetLink.click();
          }, bestLink.href);
        }
      } else {
        throw new Error('Não foi possível encontrar o botão de download');
      }
    }
    
    // clica no botão se o botão foi achado pelo seletor
    if (await page.$(seletor)) {
      await Promise.all([
        page.click(seletor),
        new Promise(resolve => setTimeout(resolve, 2000))
      ]);
      console.log('Clicou no botão de download via seletor');
    }
    
    console.log('Aguardando download...');
    
    // Esperar alguns segundos para garantir que o download foi iniciado
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Verificar quais arquivos foram baixados
    const files = fs.readdirSync(tempDir);
    console.log('Arquivos encontrados:', files);
    
    if (files.length === 0) {
      throw new Error('Nenhum arquivo foi baixado');
    }
    
    // Pega o arquivo baixado 
    const downloadedFile = files[0];
    const filePath = path.join(tempDir, downloadedFile);
    
    // Espera até que o arquivo esteja completamente baixado 
    let fileIsReady = !downloadedFile.endsWith('.crdownload') && !downloadedFile.endsWith('.part');
    let attempts = 0;
    const maxAttempts = 60; // 5 minutos (60 x 5s)
    
    while (!fileIsReady && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar 5 segundos
      const currentFiles = fs.readdirSync(tempDir);
      
      // Verificar se algum arquivo tem extensão .crdownload ou .part
      const pendingFiles = currentFiles.filter(f => f.endsWith('.crdownload') || f.endsWith('.part'));
      fileIsReady = pendingFiles.length === 0 && currentFiles.length > 0;
      //tentativas (60 de 5s)
      attempts++;
      console.log(`Verificando download... Tentativa ${attempts}/${maxAttempts}`);
    }
    
    if (!fileIsReady) {
      throw new Error('Tempo esgotado esperando o download completar');
    }
    
    // cria um zip qnd baixar
    const finalFiles = fs.readdirSync(tempDir);
    if (finalFiles.length === 0) {
      throw new Error('Nenhum arquivo foi baixado');
    }
    
    // Encontra arquivos exe
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