class ToolGate {
  constructor() {
    this.toolTimeout = 8000;
    this.fallbackTimeout = 3000;
  }

  async executePreSpeechCheck(query, context = {}) {
    const toolPlan = await this.planTools(query, context);

    if (!toolPlan || toolPlan.length === 0) {
      return { needsTools: false, results: [], response: null };
    }

    const safeExecutor = require('./safe-tool-executor').getSafeToolExecutor();
    const results = await safeExecutor.executeWithGlobalTimeout(toolPlan);

    const consolidator = require('./response-consolidator').getResponseConsolidator();
    const consolidatedResponse = await consolidator.consolidate(query, results);

    return {
      needsTools: true,
      results,
      response: consolidatedResponse
    };
  }

  async planTools(query, context) {
    const lowerQuery = query.toLowerCase();
    const toolPlan = [];

    if (lowerQuery.includes('download') || lowerQuery.includes('baixar')) {
      toolPlan.push({
        name: 'download-specialist',
        estimatedDuration: 300,
        execute: async () => {
          const { getDownloadSpecialist } = require('../agents/download-specialist');
          const specialist = getDownloadSpecialist();
          return specialist.responder(query);
        }
      });
    }

    if (lowerQuery.includes('notícia') || lowerQuery.includes('noticia') || lowerQuery.includes('news')) {
      toolPlan.push({
        name: 'web-search',
        estimatedDuration: 2000,
        execute: async () => {
          const { getWebDataCenterSearch } = require('../tools/web-datacenter-search');
          const search = getWebDataCenterSearch();
          return search.search(query);
        }
      });
    }

    if (lowerQuery.includes('documento') || lowerQuery.includes('pdf') || lowerQuery.includes('arquivo')) {
      toolPlan.push({
        name: 'document-reader',
        estimatedDuration: 400,
        execute: async () => {
          const { getSpecialistDocument } = require('../agents/specialist-document');
          const specialist = getSpecialistDocument();
          return specialist.responder(query);
        }
      });
    }

    if (toolPlan.length === 0 && this.needsKnowledgeBase(query)) {
      toolPlan.push({
        name: 'knowledge-base',
        estimatedDuration: 200,
        execute: async () => {
          const { getKnowledgeBase } = require('../knowledge-base');
          const kb = await getKnowledgeBase();
          return kb.search(query, 5);
        }
      });
    }

    return toolPlan;
  }

  needsKnowledgeBase(query) {
    const lowerQuery = query.toLowerCase();
    const knowledgeIndicators = [
      'o que', 'qual', 'como', 'quando', 'onde', 'por que',
      'procedimento', 'processo', 'política', 'regra', 'norma'
    ];

    return knowledgeIndicators.some(indicator => lowerQuery.includes(indicator));
  }

  generatePlaceholderResponse(toolPlan) {
    const toolNames = toolPlan.map(t => t.name).join(', ');
    return {
      needsTools: true,
      results: [],
      response: {
        text: `Estou verificando ${toolNames} para você.`,
        confidence: 0.5,
        source: 'placeholder',
        readyForTTS: true
      }
    };
  }
}

let instance = null;

function getToolGate() {
  if (!instance) {
    instance = new ToolGate();
  }
  return instance;
}

module.exports = {
  getToolGate,
  ToolGate
};
