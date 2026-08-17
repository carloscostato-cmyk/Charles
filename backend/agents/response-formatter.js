module.exports = {
  getResponseFormatter() {
    return {
      detectarTipo(pergunta, resposta) {
        const tipos = ['conversacao', 'informacao', 'documento', 'download'];
        const tipo = 'conversacao';
        
        return {
          tipo,
          deveSerFalado: true,
          deveSerExibido: false,
          descricao: 'Resposta padrao',
          formatacao: null
        };
      },
      _determinarFormatacao(tipo, resposta) {
        return null;
      },
      formatearResposta(resposta, tipo) {
        return resposta;
      }
    };
  },
  detectarTipo: () => ({ tipo: 'conversacao', deveSerFalado: true, deveSerExibido: false, descricao: 'Resposta padrao' })
};