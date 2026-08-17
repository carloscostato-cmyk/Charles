module.exports = {
  getSpecialistAvailability() {
    return {
      isAvailabilityQuery(pergunta) {
        const keywords = ['disponível', 'disponibilidade', 'online', 'ativo', 'ativa'];
        return keywords.some(k => pergunta.toLowerCase().includes(k));
      },
      responder(pergunta) {
        return 'Disponibilidade de Data Centers solicitada. Todos os centros estão operacionais.';
      }
    };
  }
};