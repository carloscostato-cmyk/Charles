module.exports = {
  getVoiceSpecialist() {
    const vozAtual = 'default';
    const vozes = ['default', 'male', 'female', 'alex', 'samantha'];
    
    return {
      listVozes() {
        return vozes;
      },
      getVozAtual() {
        return vozAtual;
      },
      setVoz(voz) {
        return vozes.includes(voz);
      },
      getVozInfo(voz) {
        return { nome: voz, genero: 'neutro', idade: 30 };
      },
      detectarVozIdeal(pergunta) {
        return vozAtual;
      },
      aplicarVoz(texto) {
        return texto;
      }
    };
  }
};