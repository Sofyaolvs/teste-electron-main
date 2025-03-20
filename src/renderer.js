document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('gameUrl');
    const downloadBtn = document.getElementById('downloadBtn');
    const statusDiv = document.getElementById('status');
    
    downloadBtn.addEventListener('click', async () => {
      const url = urlInput.value.trim();
      
      if (!url) {
        alert('Por favor, insira uma URL válida');
        return;
      }
      
      // Alterar estado do botão e mostrar status
      downloadBtn.disabled = true;
      statusDiv.textContent = 'Baixando...';
      
      try {
        // Chamar a função de download exposta pelo preload
        const result = await window.electronAPI.downloadGame(url);
        
        if (result.success) {
          statusDiv.textContent = `Download concluído! Arquivo salvo em: ${result.path}`;
        } else {
          statusDiv.textContent = result.message;
        }
      } catch (error) {
        statusDiv.textContent = `Erro: ${error.message}`;
      } finally {
        downloadBtn.disabled = false;
      }
    });
  });