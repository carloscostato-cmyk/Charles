class ResponseConsolidator {
  constructor() {
    this.fallbackNotices = {
      WEB_SEARCH: '',
      LOCAL_KB: ' segundo nossa base de conhecimento',
      LLM_ONLY: '',
      TIMEOUT: '',
      FALLBACK: ''
    };
  }

  async consolidate(query, toolResults) {
    const hasErrors = toolResults.some(r => r.error);
    const hasFallbacks = toolResults.some(r => r.fallback);

    let responseText;
    let confidence = 0.9;
    let source = 'direct';

    if (hasErrors && hasFallbacks) {
      responseText = await this.buildPartialResponse(query, toolResults);
      confidence = 0.7;
      source = 'partial-fallback';
    } else if (hasErrors) {
      responseText = await this.buildErrorResponse(query, toolResults);
      confidence = 0.6;
      source = 'error-fallback';
    } else if (toolResults.length > 0) {
      responseText = await this.buildFullResponse(query, toolResults);
      confidence = 0.95;
      source = 'tool-result';
    } else {
      responseText = await this.buildDirectResponse(query);
      confidence = 0.85;
      source = 'direct';
    }

    return {
      text: responseText,
      confidence,
      source,
      readyForTTS: true,
      toolResults,
      query
    };
  }

  async buildFullResponse(query, toolResults) {
    const successfulResults = toolResults.filter(r => r.success && !r.fallback);

    if (successfulResults.length === 0) {
      return await this.buildPartialResponse(query, toolResults);
    }

    const primaryResult = successfulResults[0];
    const data = primaryResult.data || {};

    if (typeof data === 'string') {
      return data;
    }

    if (data && typeof data.resposta === 'string') {
      return data.resposta;
    }

    if (data && typeof data.message === 'string') {
      return data.message;
    }

    if (Array.isArray(data)) {
      return data.map(item => typeof item === 'string' ? item : JSON.stringify(item)).join('\n');
    }

    return JSON.stringify(data);
  }

  async buildPartialResponse(query, toolResults) {
    const fallbackResults = toolResults.filter(r => r.fallback);
    const errorResults = toolResults.filter(r => r.error);

    if (fallbackResults.length > 0) {
      const fallback = fallbackResults[0];
      return fallback.message || 'Estou processando sua solicitação. Um momento, por favor.';
    }

    if (errorResults.length > 0) {
      return 'Não consegui concluir essa consulta agora, mas posso tentar de outra forma se quiser.';
    }

    return 'Estou organizando a resposta para você.';
  }

  async buildErrorResponse(query, toolResults) {
    const errorMessages = toolResults
      .filter(r => r.error)
      .map(r => r.message)
      .filter(Boolean);

    if (errorMessages.length > 0) {
      return `Encontrei um obstáculo ao consultar: ${errorMessages[0]}.`;
    }

    return 'Tive dificuldade para concluir essa busca agora.';
  }

  async buildDirectResponse(query) {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('download') || lowerQuery.includes('baixar')) {
      return 'Posso te ajudar com o download. Um momento.';
    }

    if (lowerQuery.includes('notícia') || lowerQuery.includes('noticia')) {
      return 'Vou procurar as notícias mais recentes para você.';
    }

    if (lowerQuery.includes('pesquisa') || lowerQuery.includes('busca')) {
      return 'Vou realizar essa pesquisa agora.';
    }

    return 'Entendi. Deixe-me verificar isso para você.';
  }

  incorporateFallbackNotice(consolidatedResponse, fallbackUsed) {
    if (!fallbackUsed || !consolidatedResponse.source) {
      return consolidatedResponse;
    }

    const notice = this.fallbackNotices[fallbackUsed.type] || '';
    if (!notice) {
      return consolidatedResponse;
    }

    return {
      ...consolidatedResponse,
      text: `${consolidatedResponse.text}${notice}`,
      fallbackIndicator: true
    };
  }

  calculateConfidence(toolResults) {
    if (!toolResults || toolResults.length === 0) {
      return 0.7;
    }

    const successfulResults = toolResults.filter(r => r.success && !r.fallback);
    const fallbackResults = toolResults.filter(r => r.fallback);

    if (successfulResults.length > 0) {
      return 0.95;
    }

    if (fallbackResults.length > 0) {
      return 0.75;
    }

    return 0.6;
  }
}

let instance = null;

function getResponseConsolidator() {
  if (!instance) {
    instance = new ResponseConsolidator();
  }
  return instance;
}

module.exports = {
  getResponseConsolidator,
  ResponseConsolidator
};
