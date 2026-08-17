module.exports = {
  getSpecialistDocument() {
    return {
      isDocumentReadRequest(pergunta) {
        const keywords = ['arquivo', 'documento', 'arquivo.pdf', 'documento.txt', 'ler arquivo'];
        return keywords.some(k => pergunta.toLowerCase().includes(k));
      },
      responder(pergunta) {
        return {
          resposta: 'Leitura de documento solicitada.',
          fonte: 'specialist-document',
          tipo: 'documento',
          sucesso: false,
          thumbnailUrl: null,
          downloadUrl: null,
          metadata: {}
        };
      }
    };
  }
};