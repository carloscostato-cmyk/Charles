/**
 * embeddings.js
 *
 * Camada de geração de embeddings semânticos.
 * Suporta múltiplos provedores de embedding com fallback automático.
 *
 * Estratégia (Smart Embedding Selection):
 * 1. Se GEMINI_API_KEY disponível → Google text-embedding-004 (grátis, 768 dims)
 * 2. Se OPENAI_API_KEY disponível → OpenAI text-embedding-3-small (1536 dims)
 * 3. Fallback → Hash-based local embedding (384 dims, sem API)
 *
 * FASE 1 - RAG Enterprise
 */

const crypto = require('crypto');

// ============ CONFIGURAÇÃO ============

const EMBEDDING_CONFIG = {
  gemini: {
    name: 'Google Gemini Embeddings',
    model: 'gemini-embedding-001',
    dimensions: 768,
    apiKeyEnv: 'GEMINI_API_KEY',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models'
  },
  openai: {
    name: 'OpenAI Embeddings',
    model: 'text-embedding-3-small',
    dimensions: 1536,
    apiKeyEnv: 'OPENAI_API_KEY',
    endpoint: 'https://api.openai.com/v1/embeddings'
  }
};

// ============ CLASSE PRINCIPAL ============

class EmbeddingProvider {
  constructor() {
    this.provider = this._selectProvider();
    this.dimensions = this.provider ? EMBEDDING_CONFIG[this.provider].dimensions : 384;
    console.log(`[Embeddings] Provedor ativo: ${this.provider || 'local-hash'} (${this.dimensions} dims)`);
  }

  /**
   * Seleciona o melhor provedor de embeddings disponível
   * @returns {string|null}
   */
  _selectProvider() {
    // Tenta Gemini primeiro (grátis)
    if (process.env[EMBEDDING_CONFIG.gemini.apiKeyEnv]) {
      return 'gemini';
    }
    // Tenta OpenAI
    if (process.env[EMBEDDING_CONFIG.openai.apiKeyEnv]) {
      return 'openai';
    }
    // Fallback: embedding local baseado em hash
    return null;
  }

  /**
   * Gera embedding para um texto
   * @param {string} text
   * @returns {Promise<number[]>}
   */
  async embed(text) {
    if (!text || text.trim().length === 0) {
      return new Array(this.dimensions).fill(0);
    }

    try {
      switch (this.provider) {
        case 'gemini':
          return await this._embedGemini(text);
        case 'openai':
          return await this._embedOpenAI(text);
        default:
          return this._embedLocal(text);
      }
    } catch (error) {
      console.warn(`[Embeddings] Erro com ${this.provider}, usando local:`, error.message);
      return this._embedLocal(text);
    }
  }

  /**
   * Gera embedding otimizado para consulta.
   * Provedores de retrieval distinguem vetores de documentos e de perguntas.
   */
  async embedQuery(text) {
    if (!text || text.trim().length === 0) {
      return new Array(this.dimensions).fill(0);
    }

    try {
      if (this.provider === 'gemini') {
        return await this._embedGemini(text, 'RETRIEVAL_QUERY');
      }
      if (this.provider === 'openai') {
        return await this._embedOpenAI(text);
      }
      return this._embedLocal(text);
    } catch (error) {
      console.warn(`[Embeddings] Erro no embedding de consulta ${this.provider}, usando local:`, error.message);
      return this._embedLocal(text);
    }
  }

  /**
   * Gera embeddings para múltiplos textos (batch)
   * Usa lotes pequenos com pausa para respeitar o rate limit das APIs de embedding.
   * @param {string[]} texts
   * @returns {Promise<number[][]>}
   */
  async embedBatch(texts) {
    const BATCH_SIZE = 5;
    const BATCH_DELAY_MS = 1500;
    const results = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map((t) => this.embed(t)));
      results.push(...batchResults);

      if (i + BATCH_SIZE < texts.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    return results;
  }

  // ============ PROVEDORES ============

  /**
   * Embedding via Google Gemini API
   */
  async _embedGemini(text, taskType = 'RETRIEVAL_DOCUMENT') {
    const config = EMBEDDING_CONFIG.gemini;
    const endpoint = `${config.endpoint}/${config.model}:embedContent?key=${process.env[config.apiKeyEnv]}`;

    const body = {
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: config.dimensions
    };

    const MAX_TENTATIVAS = 5;
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const data = await response.json();
        return data.embedding?.values || [];
      }

      // Rate limit (429) ou erro temporário (5xx): aguarda com backoff e tenta novamente
      if ((response.status === 429 || response.status >= 500) && tentativa < MAX_TENTATIVAS) {
        const espera = 2000 * Math.pow(2, tentativa - 1) + Math.floor(Math.random() * 500);
        console.warn(`[Embeddings] Gemini HTTP ${response.status} — aguardando ${(espera / 1000).toFixed(1)}s (tentativa ${tentativa}/${MAX_TENTATIVAS})`);
        await new Promise((r) => setTimeout(r, espera));
        continue;
      }

      throw new Error(`Gemini embedding error: HTTP ${response.status}`);
    }
  }

  /**
   * Embedding via OpenAI API
   */
  async _embedOpenAI(text) {
    const config = EMBEDDING_CONFIG.openai;
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env[config.apiKeyEnv]}`
      },
      body: JSON.stringify({
        model: config.model,
        input: text
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI embedding error: HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.data?.[0]?.embedding || [];
  }

  /**
   * Embedding local baseado em hash (fallback - sem API externa)
   * Gera vetor de 384 dimensões usando hashing determinístico.
   * Captura similaridade lexical via n-gramas.
   */
  _embedLocal(text) {
    const DIMS = 384;
    const embedding = new Array(DIMS).fill(0);

    const normalized = text.toLowerCase().trim();
    const tokens = normalized.split(/\s+/).filter((t) => t.length > 1);

    // Cria n-gramas (1, 2, 3) para capturar contexto
    const ngrams = new Set();
    for (const token of tokens) {
      ngrams.add(token);
    }
    for (let i = 0; i < tokens.length - 1; i++) {
      ngrams.add(`${tokens[i]} ${tokens[i + 1]}`);
    }
    for (let i = 0; i < tokens.length - 2; i++) {
      ngrams.add(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
    }

    // Hash de cada n-grama para posições do vetor
    for (const ngram of ngrams) {
      const hash = crypto.createHash('sha256').update(ngram).digest();
      for (let j = 0; j < 6; j += 2) {
        const pos = (hash[j] + hash[j + 1] * 256) % DIMS;
        embedding[pos] += 1;
      }
    }

    // Normaliza o vetor (L2 normalization)
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < DIMS; i++) {
        embedding[i] = embedding[i] / norm;
      }
    }

    return embedding;
  }

  /**
   * Retorna informações do provedor ativo
   */
  getInfo() {
    return {
      provider: this.provider || 'local-hash',
      dimensions: this.dimensions,
      available: !!this.provider
    };
  }
}

// Singleton
let instance = null;

function getEmbeddingProvider() {
  if (!instance) {
    instance = new EmbeddingProvider();
  }
  return instance;
}

module.exports = { getEmbeddingProvider, EmbeddingProvider };