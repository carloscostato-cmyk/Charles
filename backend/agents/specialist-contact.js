module.exports = {
  getSpecialistContact() {
    return {
      isContactQuery(pergunta) {
        const keywords = ['telefone', 'contato', 'ligar', 'telefonar', 'fale'];
        return keywords.some(k => pergunta.toLowerCase().includes(k));
      },
      responder(pergunta) {
        return 'Telefone do Data Center solicitado. Por favor, forneça o nome ou cidade do centro.';
      }
    };
  }
};