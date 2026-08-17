module.exports = {
  gerarRelatorio(config) {
    return {
      servidorOnline: config.servidorOnline || true,
      faq: { total: config.faq?.length || 0 },
      llmDisponivel: config.llmDisponivel || false,
      providerNome: config.providerNome || 'Groq',
      status: 'online'
    };
  }
};