// Obter referências aos elementos da UI
const gameUrlInput = document.getElementById('gameUrl');
const downloadButton = document.getElementById('downloadBtn');
const statusElement = document.getElementById('status');
const progressElement = document.querySelector('.progress');
const progressBar = document.getElementById('progressBar');
const resultBox = document.getElementById('resultBox');

// Verificar se a API está disponível via preload
if (window.electronAPI) {
  // Adicionar event listener ao botão de download
  downloadButton.addEventListener('click', async () => {
    // Obter URL do jogo
    const gameUrl = gameUrlInput.value.trim();
    
    // Validar URL
    if (!gameUrl) {
      showError('Por favor, insira uma URL válida.');
      return;
    }

    try {
      // Desabilitar o botão durante o download
      downloadButton.disabled = true;
      
      // Atualizar status
      statusElement.textContent = 'Iniciando download...';
      
      // Mostrar barra de progresso
      progressElement.style.display = 'block';
      updateProgress(10);

      // Iniciar download (sem passar o seletor, usando detecção automática)
      const result = await window.electronAPI.downloadGame(gameUrl);
      
      // Processar resultado
      if (result.success) {
        updateProgress(100);
        statusElement.textContent = 'Download finalizado!';
        showSuccess(`Jogo baixado com sucesso: ${result.fileName}
                     Salvo em: ${result.path}`);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      updateProgress(0);
      statusElement.textContent = 'Erro no download.';
      showError(`Falha ao baixar o jogo: ${error.message}`);
    } finally {
      // Reabilitar o botão
      downloadButton.disabled = false;
    }
  });
} else {
  // API não disponível
  statusElement.textContent = 'Erro: API Electron não disponível.';
  downloadButton.disabled = true;
}

// Função para atualizar a barra de progresso
function updateProgress(percent) {
  progressBar.style.width = `${percent}%`;
}

// Função para mostrar mensagem de sucesso
function showSuccess(message) {
  resultBox.className = 'result success';
  resultBox.textContent = message;
  resultBox.style.display = 'block';
}

// Função para mostrar mensagem de erro
function showError(message) {
  resultBox.className = 'result error';
  resultBox.textContent = message;
  resultBox.style.display = 'block';
}