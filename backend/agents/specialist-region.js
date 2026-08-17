module.exports = {
  getSpecialistRegion() {
    return {
      isRegionQuery(pergunta) {
        const keywords = ['região', 'estado', 'uf', 'sp', 'rj', 'mg', 'rs', 'ba'];
        return keywords.some(k => pergunta.toLowerCase().includes(k));
      },
      responder(pergunta) {
        return 'Data Centers por região/estado solicitados. Use a API /api/datacenters/by-uf/{uf} para obter por estado.';
      }
    };
  }
};