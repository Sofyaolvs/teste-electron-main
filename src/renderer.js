document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('gameUrl');
  const selectorInput = document.getElementById('downloadSelector'); 
  const downloadBtn = document.getElementById('downloadBtn');
  const statusDiv = document.getElementById('status');
  
  downloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim(); //pega a url
    const selector = selectorInput ? selectorInput.value.trim() : ''; // Opcional
    
    if (!url) {
      alert('Por favor, insira uma URL válida');
      return;
    }
    
    // Alterar estado do botão e mostrar status
    downloadBtn.disabled = true;
    statusDiv.textContent = 'Baixando... (Isso pode levar alguns minutos)';
    
    try {
      // Chamar a função de download exposta pelo preload com o seletor opcional
      const result = await window.electronAPI.downloadGame(url, selector);
      
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