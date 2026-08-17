module.exports = {
  gerarRelatorio(config) {
    return {
      servidorOnline: config.servidorOnline || true,
      faq: { total: config.faq?.length || 0 },
      llmDisponivel: config.llmDisponivel || false,
      providerNome: config.providerNome || 'Groq',
      deployOnline: config.deployOnline || true,
      ultimaDeploy: config.ultimaDeploy || 'Nunca',
      status: 'online'
    };
  }
};