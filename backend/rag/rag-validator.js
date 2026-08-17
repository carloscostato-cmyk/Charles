/**
 * rag-validator.js
 *
 * Validação RAG - Garante que apenas informações relevantes e confiáveis
 * sejam utilizadas nas respostas.
 *
 * Regras de validação:
 * 1. Verifica se a informação recuperada realmente responde à pergunta.
 * 2. Ignora documentos com baixa relevância.
 * 3. Utiliza apenas trechos diretamente relacionados ao tema solicitado.
 * 4. Se a confiança da informação for baixa, não responde.
 * 5. Se os documentos forem insuficientes, informa que a informação não foi encontrada.
 * 6. Nunca preenche lacunas com conhecimento próprio.
 */

// Limiares de confiança (ajustáveis)
const THRESHOLDS = {
  // Score mínimo para considerar um documento relevante
  MIN_RELEVANCE_SCORE: 0.25,
  // Score mínimo para considerar a resposta confiável (média dos top resultados)
  MIN_CONFIDENCE_SCORE: 0.25,
  // Número mínimo de documentos relevantes para responder
  MIN_DOCUMENTS: 1,
  // Número mínimo de documentos para alta confiança
  MIN_DOCUMENTS_HIGH_CONFIDENCE: 2,
  // Score para alta confiança
  HIGH_CONFIDENCE_SCORE: 0.50
};

class RAGValidator {
  /**
   * Valida os resultados de retrieval contra a pergunta.
   * @param {string} query - Pergunta original do usuário
   * @param {Array} results - Resultados do vector store (com score)
   * @returns {Object} Resultado da validação
   */
  validate(query, results) {
    if (!query || !results || results.length === 0) {
      return this._buildResult({
        valid: false,
        reason: 'Nenhum documento recuperado para a consulta.',
        canAnswer: false,
        confidence: 0,
        filteredResults: []
      });
    }

    // Passo 1: Filtra documentos com baixa relevância
    const relevantResults = results.filter(
      (r) => r.score >= THRESHOLDS.MIN_RELEVANCE_SCORE
    );

    if (relevantResults.length === 0) {
      return this._buildResult({
        valid: false,
        reason: 'Nenhum documento com relevância suficiente encontrado. A informação não foi encontrada na base de conhecimento.',
        canAnswer: false,
        confidence: 0,
        filteredResults: []
      });
    }

    // Passo 2: Verifica se há documentos suficientes
    if (relevantResults.length < THRESHOLDS.MIN_DOCUMENTS) {
      return this._buildResult({
        valid: false,
        reason: 'Documentos insuficientes para responder com confiança. A informação não foi encontrada na base de conhecimento.',
        canAnswer: false,
        confidence: 0,
        filteredResults: relevantResults
      });
    }

    // Passo 3: Calcula confiança baseada nos scores
    const confidence = this._calculateConfidence(relevantResults);

    // Passo 4: Verifica se a confiança é suficiente
    if (confidence < THRESHOLDS.MIN_CONFIDENCE_SCORE) {
      return this._buildResult({
        valid: false,
        reason: 'Confiança insuficiente na informação recuperada. A informação não foi encontrada com segurança na base de conhecimento.',
        canAnswer: false,
        confidence,
        filteredResults: relevantResults
      });
    }

    // Passo 5: Verifica relevância temática (overlap de termos-chave)
    const thematicCheck = this._checkThematicRelevance(query, relevantResults);

    if (!thematicCheck.pass) {
      return this._buildResult({
        valid: false,
        reason: 'Os documentos recuperados não estão diretamente relacionados ao tema da pergunta. A informação não foi encontrada na base de conhecimento.',
        canAnswer: false,
        confidence,
        filteredResults: relevantResults,
        thematicScore: thematicCheck.score
      });
    }

    // Passo 6: Determina nível de confiança final
    const confidenceLevel = this._getConfidenceLevel(confidence, relevantResults.length);

    return this._buildResult({
      valid: true,
      reason: 'Informação recuperada com confiança adequada.',
      canAnswer: true,
      confidence,
      confidenceLevel,
      filteredResults: relevantResults,
      thematicScore: thematicCheck.score
    });
  }

  /**
   * Verifica se a pergunta pode ser respondida com o contexto disponível.
   * @param {string} query - Pergunta original
   * @param {Object} contextResult - Resultado de retrieveContextForPrompt
   * @returns {Object} Decisão de resposta
   */
  decideAnswer(query, contextResult) {
    if (!contextResult || !contextResult.hasContext) {
      return {
        shouldAnswer: false,
        message: 'A informação não foi encontrada na base de conhecimento.',
        confidence: 0,
        confidenceLevel: 'none'
      };
    }

    const validation = this.validate(query, contextResult.sources || []);

    if (!validation.canAnswer) {
      return {
        shouldAnswer: false,
        message: validation.reason,
        confidence: validation.confidence,
        confidenceLevel: validation.confidenceLevel
      };
    }

    return {
      shouldAnswer: true,
      message: 'Informação recuperada com sucesso.',
      confidence: validation.confidence,
      confidenceLevel: validation.confidenceLevel,
      filteredSources: validation.filteredResults
    };
  }

  /**
   * Calcula a confiança geral baseada nos scores dos documentos relevantes.
   * @param {Array} results - Documentos relevantes
   * @returns {number} Confiança entre 0 e 1
   */
  _calculateConfidence(results) {
    if (results.length === 0) return 0;

    // Média ponderada: documentos com maior score têm mais peso
    const totalWeight = results.reduce((sum, r, i) => sum + (results.length - i), 0);
    const weightedSum = results.reduce((sum, r, i) => {
      const weight = results.length - i;
      return sum + (r.score * weight);
    }, 0);

    return weightedSum / totalWeight;
  }

  /**
   * Verifica se os documentos estão tematicamente relacionados à pergunta.
   * Usa overlap de termos-chave como proxy de relevância temática.
   * @param {string} query - Pergunta
   * @param {Array} results - Documentos relevantes
   * @returns {Object} Resultado da verificação temática
   */
  _checkThematicRelevance(query, results) {
    const queryTerms = this._extractKeyTerms(query);
    if (queryTerms.length === 0) {
      return { pass: true, score: 1.0 };
    }

    let maxDocScore = 0;
    for (const result of results) {
      const content = (result.content || '').toLowerCase();
      let matchedCount = 0;
      for (const term of queryTerms) {
        if (content.includes(term)) {
          matchedCount++;
        }
      }
      const docScore = matchedCount / queryTerms.length;
      if (docScore > maxDocScore) {
        maxDocScore = docScore;
      }
    }

    const pass = maxDocScore >= 0.15 || queryTerms.length <= 1;

    return { pass, score: maxDocScore };
  }

  /**
   * Extrai termos-chave da pergunta (palavras com mais de 3 caracteres,
   * excluindo stopwords comuns).
   * @param {string} query - Pergunta
   * @returns {string[]} Termos-chave
   */
  _extractKeyTerms(query) {
    const stopwords = new Set([
      'para', 'como', 'qual', 'quais', 'onde', 'quando', 'quem', 'porque',
      'por', 'que', 'com', 'sem', 'uma', 'um', 'uns', 'umas', 'dos', 'das',
      'nos', 'nas', 'aos', 'das', 'pelo', 'pela', 'pelos', 'pelas', 'sobre',
      'entre', 'apos', 'ate', 'desde', 'durante', 'mediante', 'segundo',
      'conforme', 'consoante', 'exceto', 'salvo', 'menos', 'mais', 'muito',
      'pouco', 'todos', 'todas', 'todo', 'toda', 'outro', 'outra', 'outros',
      'outras', 'mesmo', 'mesma', 'mesmos', 'mesmas', 'tambem', 'ainda',
      'ja', 'nao', 'sim', 'ser', 'estar', 'ter', 'haver', 'fazer', 'poder',
      'dever', 'querer', 'saber', 'precisar', 'gostar', 'achar', 'ver',
      'dizer', 'falar', 'dar', 'ficar', 'passar', 'chegar', 'sair', 'entrar',
      'voltar', 'vir', 'ir', 'levar', 'trazer', 'pegar', 'deixar', 'colocar',
      'what', 'how', 'why', 'when', 'where', 'who', 'which', 'that', 'this',
      'with', 'without', 'from', 'into', 'onto', 'upon', 'about', 'between',
      'after', 'before', 'during', 'until', 'since', 'through', 'against',
      'under', 'over', 'again', 'further', 'then', 'once', 'here', 'there',
      'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few',
      'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'so',
      'than', 'too', 'very', 'just', 'also', 'can', 'will', 'just', 'should',
      'would', 'could', 'may', 'might', 'must', 'shall', 'need', 'dare'
    ]);

    const words = query
      .toLowerCase()
      .replace(/[^\w\sà-úÀ-Ú]/g, ' ')
      .split(/\s+/)
      .filter((w) => {
        // MANTÉM identificadores de documentos (PR, PRQ, números, siglas)
        const isDocId = /^(pr|prq|\d+|[A-Z]{2,})$/i.test(w);
        const isLongEnough = w.length > 3;
        const notStopword = !stopwords.has(w);
        return (isDocId || isLongEnough) && notStopword;
      });

    return [...new Set(words)];
  }

  /**
   * Determina o nível de confiança da resposta.
   * @param {number} confidence - Confiança calculada
   * @param {number} docCount - Número de documentos relevantes
   * @returns {string} Nível de confiança
   */
  _getConfidenceLevel(confidence, docCount) {
    if (confidence >= THRESHOLDS.HIGH_CONFIDENCE_SCORE && docCount >= THRESHOLDS.MIN_DOCUMENTS_HIGH_CONFIDENCE) {
      return 'high';
    }
    if (confidence >= THRESHOLDS.MIN_CONFIDENCE_SCORE) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Constrói o resultado padronizado da validação.
   * @param {Object} data - Dados do resultado
   * @returns {Object} Resultado formatado
   */
  _buildResult(data) {
    return {
      valid: data.valid,
      reason: data.reason,
      canAnswer: data.canAnswer,
      confidence: Math.round(data.confidence * 100) / 100,
      confidenceLevel: data.confidenceLevel || (data.canAnswer ? 'medium' : 'none'),
      filteredResults: data.filteredResults || [],
      thematicScore: data.thematicScore !== undefined ? Math.round(data.thematicScore * 100) / 100 : undefined
    };
  }
}

// Singleton
let instance = null;

function getRAGValidator() {
  if (!instance) {
    instance = new RAGValidator();
  }
  return instance;
}

module.exports = { RAGValidator, getRAGValidator, THRESHOLDS };