/**
 * semantic-memory.js
 *
 * Memória Semântica (Semantic Memory / User Facts Store).
 * Extrai e armazena fatos importantes sobre o usuário.
 * Permite recuperação automática: "Meu nome é Carlos" → "Qual é meu nome?"
 *
 * FASE 4 - Memória Moderna
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Padrões de extração de fatos
const FACT_PATTERNS = [
  {
    category: 'name',
    patterns: [
      /meu nome (?:e|é)\s+([a-záàâãéêíóôõúç\s]+)/i,
      /eu me chamo\s+([a-záàâãéêíóôõúç\s]+)/i,
      /pode me chamar de\s+([a-záàâãéêíóôõúç\s]+)/i
    ],
    extractor: (match) => match[1].trim()
  },
  {
    category: 'email',
    patterns: [
      /meu email (?:e|é)\s+([\w.@-]+)/i,
      /meu e-mail (?:e|é)\s+([\w.@-]+)/i
    ],
    extractor: (match) => match[1].trim()
  },
  {
    category: 'phone',
    patterns: [
      /meu (?:telefone|celular|número|numero) (?:e|é)\s+([\d\s()-]+)/i
    ],
    extractor: (match) => match[1].trim()
  },
  {
    category: 'department',
    patterns: [
      /eu (?:trabalho|sou) (?:no|na|do|da)\s+([a-záàâãéêíóôõúç\s]+)/i,
      /meu (?:departamento|setor|área|area) (?:e|é)\s+([a-záàâãéêíóôõúç\s]+)/i
    ],
    extractor: (match) => match[1].trim()
  },
  {
    category: 'role',
    patterns: [
      /eu sou\s+(?:um|uma)\s+([a-záàâãéêíóôõúç\s]+)/i,
      /meu (?:cargo|função|funcao) (?:e|é)\s+([a-záàâãéêíóôõúç\s]+)/i
    ],
    extractor: (match) => match[1].trim()
  },
  {
    category: 'preference',
    patterns: [
      /eu (?:prefiro|gosto de|adoro)\s+([a-záàâãéêíóôõúç\s]+)/i,
      /meu (?:favorito|preferido) (?:e|é)\s+([a-záàâãéêíóôõúç\s]+)/i
    ],
    extractor: (match) => match[1].trim()
  }
];

// Padrões de consulta de fatos
const FACT_QUERY_PATTERNS = [
  {
    category: 'name',
    patterns: [
      /qual (?:e|é) o meu nome/i,
      /como eu me chamo/i,
      /quem sou eu/i,
      /como voce me chama/i
    ]
  },
  {
    category: 'email',
    patterns: [
      /qual (?:e|é) o meu email/i,
      /qual (?:e|é) o meu e-mail/i
    ]
  },
  {
    category: 'phone',
    patterns: [
      /qual (?:e|é) o meu (?:telefone|celular|número|numero)/i
    ]
  },
  {
    category: 'department',
    patterns: [
      /qual (?:e|é) o meu (?:departamento|setor)/i,
      /onde eu (?:trabalho|sou)/i
    ]
  },
  {
    category: 'role',
    patterns: [
      /qual (?:e|é) o meu (?:cargo|função|funcao)/i,
      /o que eu (?:faço|faco)/i
    ]
  },
  {
    category: 'preference',
    patterns: [
      /o que eu (?:prefiro|gosto)/i,
      /qual (?:e|é) o meu (?:favorito|preferido)/i
    ]
  }
];

class SemanticMemory {
  constructor() {
    this.dbPath = path.join(__dirname, '..', '..', 'data', 'semantic-memory.db');
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
      CREATE TABLE IF NOT EXISTS user_facts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        category TEXT NOT NULL,
        fact TEXT NOT NULL,
        confidence REAL DEFAULT 1.0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, category)
      );
      CREATE INDEX IF NOT EXISTS idx_facts_user ON user_facts(user_id);
      CREATE INDEX IF NOT EXISTS idx_facts_category ON user_facts(category);
    `);

    this._initialized = true;
    console.log('[SemanticMemory] Inicializado');
  }

  /**
   * Extrai fatos de uma interação
   * @param {string} userId
   * @param {string} pergunta
   * @param {string} resposta
   */
  async extractFacts(userId, pergunta, resposta) {
    await this.initialize();

    const facts = this._extractFactsFromText(pergunta);

    for (const fact of facts) {
      await this._saveFact(userId, fact.category, fact.value);
      console.log(`[SemanticMemory] Fato extraído: ${fact.category} = ${fact.value} (user: ${userId})`);
    }

    return facts;
  }

  /**
   * Recupera fatos relevantes para uma consulta
   * @param {string} userId
   * @param {string} query
   * @returns {Promise<Array>}
   */
  async relevantFacts(userId, query) {
    await this.initialize();

    // Detecta qual categoria de fato está sendo consultada
    const categories = this._detectFactQuery(query);

    if (categories.length === 0) {
      // Retorna todos os fatos do usuário
      return await this._getAllFacts(userId);
    }

    const facts = [];
    for (const category of categories) {
      const fact = await this._getFact(userId, category);
      if (fact) {
        facts.push(fact);
      }
    }

    return facts;
  }

  /**
   * Extrai fatos de um texto
   * @param {string} text
   * @returns {Array<{category: string, value: string}>}
   */
  _extractFactsFromText(text) {
    const facts = [];

    for (const { category, patterns, extractor } of FACT_PATTERNS) {
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          const value = extractor(match);
          if (value && value.length > 1 && value.length < 100) {
            facts.push({ category, value });
            break; // Apenas um fato por categoria
          }
        }
      }
    }

    return facts;
  }

  /**
   * Detecta se a query está perguntando sobre um fato
   * @param {string} query
   * @returns {Array<string>}
   */
  _detectFactQuery(query) {
    const categories = [];

    for (const { category, patterns } of FACT_QUERY_PATTERNS) {
      for (const pattern of patterns) {
        if (pattern.test(query)) {
          categories.push(category);
          break;
        }
      }
    }

    return categories;
  }

  /**
   * Salva um fato no banco
   * @param {string} userId
   * @param {string} category
   * @param {string} value
   */
  async _saveFact(userId, category, value) {
    const stmt = this.db.prepare(`
      INSERT INTO user_facts (user_id, category, fact, created_at, updated_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(user_id, category) DO UPDATE SET
        fact = excluded.fact,
        updated_at = datetime('now')
    `);
    stmt.run(userId, category, value);
  }

  /**
   * Recupera um fato específico
   * @param {string} userId
   * @param {string} category
   * @returns {Promise<Object|null>}
   */
  async _getFact(userId, category) {
    const row = this.db.prepare(
      'SELECT category, fact, created_at, updated_at FROM user_facts WHERE user_id = ? AND category = ?'
    ).get(userId, category);

    if (!row) return null;

    return {
      category: row.category,
      value: row.fact,
      fact: `${row.category}: ${row.fact}`,
      updatedAt: row.updated_at
    };
  }

  /**
   * Recupera todos os fatos de um usuário
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async _getAllFacts(userId) {
    const rows = this.db.prepare(
      'SELECT category, fact, created_at, updated_at FROM user_facts WHERE user_id = ?'
    ).all(userId);

    return rows.map((row) => ({
      category: row.category,
      value: row.fact,
      fact: `${row.category}: ${row.fact}`,
      updatedAt: row.updated_at
    }));
  }

  /**
   * Retorna estatísticas
   * @returns {Promise<Object>}
   */
  async getStats() {
    await this.initialize();

    const totalFacts = this.db.prepare('SELECT COUNT(*) as count FROM user_facts').get().count;
    const totalUsers = this.db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM user_facts').get().count;
    const byCategory = {};

    const rows = this.db.prepare('SELECT category, COUNT(*) as count FROM user_facts GROUP BY category').all();
    for (const row of rows) {
      byCategory[row.category] = row.count;
    }

    return {
      totalFacts,
      totalUsers,
      byCategory,
      dbPath: this.dbPath
    };
  }
}

module.exports = SemanticMemory;