module.exports = {
  getFeedbackManager() {
    return {
      verificarTodasFontes(pergunta, userId) {
        return {
          resposta: null,
          confianca: 0,
          fonte: null,
          metodo: 'feedback-check',
          metadata: {}
        };
      }
    };
  }
};