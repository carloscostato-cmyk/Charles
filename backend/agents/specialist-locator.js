module.exports = {
  getSpecialistLocator() {
    return {
      isLocationQuery(pergunta) {
        const keywords = ['onde', 'localização', 'endereco', 'endereço', 'procuro'];
        return keywords.some(k => pergunta.toLowerCase().includes(k));
      },
      responder(pergunta) {
        return 'Endereço do Data Center solicitado. Por favor, forneça a cidade ou região desejada.';
      }
    };
  }
};