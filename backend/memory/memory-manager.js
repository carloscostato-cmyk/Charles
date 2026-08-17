/**
 * memory-manager.js
 *
 * Gerenciador de Memória Moderna (Modern Memory System).
 * Coordena: Short-Term Memory, Long-Term Memory e Semantic Memory.
 * Permite recuperação automática de fatos importantes da conversa.
 *
 * FASE 4 - Memória Moderna
 */

const ShortTermMemory = require('./short-term-memory');
const LongTermMemory = require('./long-term-memory');
const SemanticMemory = require('./semantic-memory');

class MemoryManager {
  constructor() {
    this.shortTerm = new ShortTermMemory();
    this.longTerm = new LongTermMemory();
    this.semantic = new SemanticMemory();
    this._initialized = false;
  }

  async initialize() {
    if (this._initialized) return;
    await this.longTerm.initialize();
    await this.semantic.initialize();
    this._initialized = true;
    console.log('[Memory] Sistema de memória inicializado');
  }

  /**
   * Registra uma interação na memória
   * @param {string} userId
   * @param {string} pergunta
   * @param {string} resposta
   * @param {Object} metadata
   */
  async remember(userId, pergunta, resposta, metadata = {}) {
    await this.initialize();

    // Short-term: mantém últimas interações em memória
    this.shortTerm.add(userId, pergunta, resposta, metadata);

    // Long-term: persiste no banco
    await this.longTerm.saveInteraction(userId, pergunta, resposta, metadata);

    // Semantic: extrai fatos importantes
    await this.semantic.extractFacts(userId, pergunta, resposta);

    console.log(`[Memory] Interação registrada para usuário ${userId}`);
  }

  /**
   * Recupera contexto para uma nova pergunta
   * @param {string} userId
   * @param {string} pergunta
   * @returns {Promise<{history: Array, facts: Array, summary: string}>}
   */
  async recall(userId, pergunta) {
    await this.initialize();

    // Recupera histórico recente (short-term)
    const history = this.shortTerm.getRecent(userId, 5);

    // Recupera fatos relevantes (semantic memory)
    const facts = await this.semantic.relevantFacts(userId, pergunta);

    // Recupera resumo da conversa (long-term)
    const summary = await this.longTerm.getConversationSummary(userId);

    return { history, facts, summary };
  }

  /**
   * Busca fatos do usuário (ex: "Qual é meu nome?")
   * @param {string} userId
   * @param {string} query
   * @returns {Promise<Array>}
   */
  async recallFacts(userId, query) {
    await this.initialize();
    return await this.semantic.relevantFacts(userId, query);
  }

  /**
   * Inicia nova sessão (limpa short-term)
   * @param {string} userId
   */
  async newSession(userId) {
    this.shortTerm.clear(userId);
    console.log(`[Memory] Nova sessão para usuário ${userId}`);
  }

  /**
   * Gera resumo da conversa
   * @param {string} userId
   * @returns {Promise<string>}
   */
  async summarize(userId) {
    await this.initialize();
    return await this.longTerm.getConversationSummary(userId);
  }

  /**
   * Retorna estatísticas de memória
   * @returns {Promise<Object>}
   */
  async getStats() {
    await this.initialize();
    return {
      shortTerm: this.shortTerm.getStats(),
      longTerm: await this.longTerm.getStats(),
      semantic: await this.semantic.getStats()
    };
  }
}

// Singleton
let instance = null;

function getMemoryManager() {
  if (!instance) {
    instance = new MemoryManager();
  }
  return instance;
}

module.exports = { getMemoryManager, MemoryManager };