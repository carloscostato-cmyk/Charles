module.exports = {
  getDownloadSpecialist() {
    return {
      isDownloadRequest(pergunta) {
        return pergunta.toLowerCase().includes('baixar') || pergunta.toLowerCase().includes('download');
      },
      responder(pergunta) {
        return {
          resposta: 'Funcionalidade de download em desenvolvimento.',
          fonte: 'download-specialist',
          tipo: 'download',
          sucesso: true,
          thumbnailUrl: null,
          downloadUrl: null,
          metadata: {}
        };
      }
    };
  }
};