module.exports = {
  getSpecialistDirectory() {
    return {
      isDirectoryQuery(pergunta) {
        const keywords = ['lista', 'diretório', 'todos', 'todos os', 'listar'];
        return keywords.some(k => pergunta.toLowerCase().includes(k));
      },
      responder(pergunta) {
        return 'Lista de Data Centers solicitada. Use a API /api/datacenters para obter todos os registros.';
      }
    };
  }
};