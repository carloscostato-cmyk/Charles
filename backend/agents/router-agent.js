const orchestrator = require('./orchestrator');

function getRouterAgent() {
  return {
    processar(pergunta, resultadosFAQ, respostaLLM, fonte) {
      return orchestrator.processar(pergunta, resultadosFAQ, respostaLLM, fonte);
    },
    getStatusAgentes() {
      return {
        agentes: ['router-agent'],
        status: 'online',
        routing: {
          intents: ['faq', 'llm', 'rag', 'knowledge-base'],
          confidence: 0.95
        }
      };
    },
    getStats() {
      return {
        totalRequests: 0,
        faqHits: 0,
        llmCalls: 0,
        agentesUsados: 1
      };
    }
  };
}

module.exports = { getRouterAgent };