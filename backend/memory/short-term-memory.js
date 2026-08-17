/**
 * short-term-memory.js
 *
 * Memória de curto prazo (Short-Term Memory).
 * Mantém as últimas interações em memória RAM para acesso rápido.
 * Janela deslizante de contexto da conversa atual.
 *
 * FASE 4 - Memória Moderna
 */

class ShortTermMemory {
  constructor(maxInteractions = 10) {
    this.maxInteractions = maxInteractions;
    this.sessions = new Map(); // userId -> Array<interaction>
  }

  /**
   * Adiciona uma interação à memória de curto prazo
   * @param {string} userId
   * @param {string} pergunta
   * @param {string} resposta
   * @param {Object} metadata
   */
  add(userId, pergunta, resposta, metadata = {}) {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, []);
    }

    const session = this.sessions.get(userId);
    session.push({
      pergunta,
      resposta,
      timestamp: new Date().toISOString(),
      ...metadata
    });

    // Mantém apenas as últimas N interações
    if (session.length > this.maxInteractions) {
      session.shift();
    }
  }

  /**
   * Retorna as N interações mais recentes
   * @param {string} userId
   * @param {number} count
   * @returns {Array}
   */
  getRecent(userId, count = 5) {
    const session = this.sessions.get(userId) || [];
    return session.slice(-count);
  }

  /**
   * Retorna todo o histórico da sessão
   * @param {string} userId
   * @returns {Array}
   */
  getAll(userId) {
    return this.sessions.get(userId) || [];
  }

  /**
   * Gera um prompt de contexto das interações recentes
   * @param {string} userId
   * @param {number} count
   * @returns {string}
   */
  getContextPrompt(userId, count = 5) {
    const recent = this.getRecent(userId, count);
    if (recent.length === 0) return '';

    const parts = recent.map((interaction, i) => {
      return `Usuário: ${interaction.pergunta}\nCharles: ${interaction.resposta}`;
    });

    return `\n## Histórico da Conversa:\n${parts.join('\n\n')}\n`;
  }

  /**
   * Verifica se a pergunta é continuação de conversa anterior
   * @param {string} userId
   * @param {string} pergunta
   * @returns {boolean}
   */
  isContinuation(userId, pergunta) {
    const recent = this.getRecent(userId, 1);
    if (recent.length === 0) return false;

    const lower = pergunta.toLowerCase().trim();
    const continuationPatterns = [
      /^(e|mas|porem|contudo|entao|ai|assim|dessa forma|logo|por isso)\b/i,
      /^(ele|ela|isso|isso aqui|aquilo|o que voce disse|sobre isso|sobre aquilo)\b/i,
      /^(pode explicar melhor|pode detalhar|continue|e ai|e depois)\b/i,
      /\b(mais|tambem|alem disso|outro|outra)\b/i
    ];

    return continuationPatterns.some((pattern) => pattern.test(lower));
  }

  /**
   * Limpa a sessão de um usuário
   * @param {string} userId
   */
  clear(userId) {
    this.sessions.delete(userId);
  }

  /**
   * Limpa todas as sessões
   */
  clearAll() {
    this.sessions.clear();
  }

  /**
   * Retorna estatísticas
   * @returns {Object}
   */
  getStats() {
    let totalInteractions = 0;
    for (const session of this.sessions.values()) {
      totalInteractions += session.length;
    }

    return {
      activeSessions: this.sessions.size,
      totalInteractions,
      maxInteractions: this.maxInteractions
    };
  }
}

module.exports = ShortTermMemory;