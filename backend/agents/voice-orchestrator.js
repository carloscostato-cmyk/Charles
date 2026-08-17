module.exports = {
  getVoiceOrchestrator() {
    return {
      processarRespostaComVoz(texto, pergunta, contexto) {
        return {
          resposta: texto,
          ssml: texto,
          ssmlCompleto: texto,
          cues: [],
          parametrosVoz: {},
          sentimento: 'neutro',
          intencao: 'chat',
          personalidade: 'charles-voice',
          metadados: {}
        };
      },
      diagnosticar() {
        return { vozesDisponiveis: 5, status: 'online' };
      },
      alterarPersonalidade(personalidade) {
        return true;
      },
      getPersonalidadeAtual() {
        return 'charles-voice';
      }
    };
  }
};