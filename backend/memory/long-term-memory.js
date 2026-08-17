/**
 * long-term-memory.js
 *
 * Memória de longo prazo (Long-Term Memory).
 * Persiste conversas em banco SQLite para sobreviver a reinícios.
 * Implementa Conversation Summary para compressão de contexto.
 *
 * FASE 4 - Memória Moderna
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class LongTermMemory {
  constructor() {
    this.dbPath = path.join(__dirname, '..', '..', 'data', 'memory.db');
    this.db = null;
    this._initialized = false;
  }

  async initialize() {
    if (this._initialized) return;

    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        pergunta TEXT NOT NULL,
        resposta TEXT NOT NULL,
        fonte TEXT,
        qualidade INTEGER,
        timestamp TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_user ON interactions(user_id);

      CREATE TABLE IF NOT EXISTS summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        summary TEXT NOT NULL,
        interaction_count INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_summary_user ON summaries(user_id);
    `);

    this._initialized = true;
    console.log('[LongTermMemory] Inicializado');
  }

  /**
   * Salva uma interação no banco
   */
  async saveInteraction(userId, pergunta, resposta, metadata = {}) {
    await this.initialize();

    const stmt = this.db.prepare(
      'INSERT INTO interactions (user_id, pergunta, resposta, fonte, qualidade) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(userId, pergunta, resposta, metadata.fonte || null, metadata.qualidade || null);

    // Atualiza resumo a cada 5 interações
    const count = this._countInteractions(userId);
    if (count % 5 === 0) {
      await this._updateSummary(userId);
    }
  }

  /**
   * Retorna o histórico de interações de um usuário
   * @param {string} userId
   * @param {number} limit
   * @returns {Array}
   */
  async getHistory(userId, limit = 20) {
    await this.initialize();
    const rows = this.db.prepare(
      'SELECT pergunta, resposta, timestamp FROM interactions WHERE user_id = ? ORDER BY id DESC LIMIT ?'
    ).all(userId, limit);
    return rows.reverse();
  }

  /**
   * Retorna o resumo da conversa do usuário
   * @param {string} userId
   * @returns {Promise<string>}
   */
  async getConversationSummary(userId) {
    await this.initialize();

    const row = this.db.prepare(
      'SELECT summary FROM summaries WHERE user_id = ?'
    ).get(userId);

    if (row) return row.summary;

    // Se não tem resumo, gera um
    return await this._updateSummary(userId);
  }

  /**
   * Gera/atualiza o resumo da conversa
   * @param {string} userId
   * @returns {Promise<string>}
   */
  async _updateSummary(userId) {
    const interactions = await this.getHistory(userId, 20);

    if (interactions.length === 0) return '';

    // Cria um resumo simples das interações
    const topics = new Set();
    for (const interaction of interactions) {
      // Extrai palavras-chave da pergunta
      const words = interaction.pergunta.toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4);
      words.slice(0, 3).forEach((w) => topics.add(w));
    }

    const summary = `Conversa com ${interactions.length} interações. Tópicos: ${Array.from(topics).slice(0, 10).join(', ')}.`;

    // Salva ou atualiza o resumo
    const stmt = this.db.prepare(`
      INSERT INTO summaries (user_id, summary, interaction_count, created_at, updated_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        summary = excluded.summary,
        interaction_count = excluded.interaction_count,
        updated_at = datetime('now')
    `);
    stmt.run(userId, summary, interactions.length);

    return summary;
  }

  /**
   * Conta interações de um usuário
   * @param {string} userId
   * @returns {number}
   */
  _countInteractions(userId) {
    const row = this.db.prepare(
      'SELECT COUNT(*) as count FROM interactions WHERE user_id = ?'
    ).get(userId);
    return row.count;
  }

  /**
   * Retorna estatísticas
   * @returns {Promise<Object>}
   */
  async getStats() {
    await this.initialize();

    const totalInteractions = this.db.prepare('SELECT COUNT(*) as count FROM interactions').get().count;
    const totalUsers = this.db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM interactions').get().count;
    const totalSummaries = this.db.prepare('SELECT COUNT(*) as count FROM summaries').get().count;

    return {
      totalInteractions,
      totalUsers,
      totalSummaries,
      dbPath: this.dbPath
    };
  }
}

module.exports = LongTermMemory;