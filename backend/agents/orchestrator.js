const knowledgeGap = require('./knowledge-gap');

function processar(pergunta, resultadosFAQ, respostaLLM, fonte) {
  const routing = {
    intent: fonte === 'faq' ? 'faq_direto' : fonte === 'llm' ? 'llm' : 'rag',
    confidence: fonte === 'faq' ? 0.98 : 0.85,
    agentsUsed: ['router-agent'],
    reasoning: `Roteamento baseado em ${fonte}`,
    duration: 1
  };

  return {
    resposta: respostaLLM || 'Desculpe, não entendi sua pergunta.',
    fonte: fonte,
    qualidade: fonte === 'faq' ? 98 : 75,
    contexto: { ehDataCenter: false },
    routing
  };
}

function getStatusAgentes() {
  return {
    agentes: ['router-agent', 'knowledge-gap'],
    status: 'online',
    routing: {
      intents: ['faq', 'llm', 'rag', 'knowledge-base'],
      confidence: 0.95
    }
  };
}

function listarPerguntasPendentes(limite) {
  return knowledgeGap.listarPerguntasPendentes(limite);
}

module.exports = {
  processar,
  getStatusAgentes,
  knowledgeGap
};