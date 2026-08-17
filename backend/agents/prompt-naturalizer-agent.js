module.exports = {
  gerarPromptNaturalizado({ sentimento }) {
    return `Você é um assistente virtual útil e cordial. 
Responda de forma clara e direta às perguntas do usuário.
${sentimento === 'alegria' ? 'Adapte sua resposta com entusiasmo.' : ''}
${sentimento === 'tristeza' ? 'Adapte sua resposta com empatia.' : ''}`;
  }
};