/**
 * local-vector-store.js
 *
 * Implementação local de Vector Store usando SQLite + cosine similarity.
 * Não requer servidor externo (ChromaDB/pgvector) - funciona out-of-the-box.
 * Persiste embeddings em disco para sobreviver a reinícios.
 *
 * FASE 1 - RAG Enterprise
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const VectorStore = require('./vector-store');

class LocalVectorStore extends VectorStore {
  constructor(options = {}) {
    super();
    this.dbPath = options.dbPath || path.join(__dirname, '..', '..', 'data', 'vector-store.db');
    this.collection = options.collection || 'default';
    this.db = null;
    this.embeddingDim = 0;
    this._initialized = false;
  }

  async initialize() {
    if (this._initialized) return;

    // Garante que o diretório data existe
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');

    // Cria tabelas se não existirem
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        collection TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_collection ON documents(collection);
    `);

    this._initialized = true;
    console.log(`[LocalVectorStore] Inicializado em ${this.dbPath} (coleção: ${this.collection})`);
  }

  async addDocuments(documents) {
    await this.initialize();

    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO documents (id, collection, content, embedding, metadata) VALUES (?, ?, ?, ?, ?)'
    );

    const ids = [];
    const insertMany = this.db.transaction((docs) => {
      for (const doc of docs) {
        const id = doc.id || uuidv4();
        ids.push(id);
        stmt.run(
          id,
          this.collection,
          doc.content,
          JSON.stringify(doc.embedding),
          JSON.stringify(doc.metadata || {})
        );
        if (doc.embedding.length > this.embeddingDim) {
          this.embeddingDim = doc.embedding.length;
        }
      }
    });

    insertMany(documents);
    console.log(`[LocalVectorStore] ${documents.length} documentos adicionados (total: ${await this._count()})`);
    return ids;
  }

  async similaritySearch(queryEmbedding, topK = 5, filter = {}) {
    await this.initialize();

    // Busca todos os documentos da coleção (para cosine similarity in-memory)
    let query = 'SELECT id, content, metadata, embedding FROM documents WHERE collection = ?';
    const params = [this.collection];

    // Aplica filtros de metadata simples
    if (Object.keys(filter).length > 0) {
      const filterConditions = Object.entries(filter).map(([key, value]) => {
        return `json_extract(metadata, '$.${key}') = ?`;
      });
      query += ` AND (${filterConditions.join(' AND ')})`;
      params.push(...Object.values(filter));
    }

    const rows = this.db.prepare(query).all(...params);

    if (rows.length === 0) {
      return [];
    }

    // Calcula cosine similarity para cada documento
    const results = rows.map((row) => {
      const docEmbedding = JSON.parse(row.embedding);
      const score = this._cosineSimilarity(queryEmbedding, docEmbedding);
      return {
        id: row.id,
        content: row.content,
        score,
        metadata: JSON.parse(row.metadata || '{}')
      };
    });

    // Ordena por score descendente e retorna topK
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  async deleteDocuments(ids) {
    await this.initialize();
    const stmt = this.db.prepare('DELETE FROM documents WHERE id = ? AND collection = ?');
    const deleteMany = this.db.transaction((ids) => {
      for (const id of ids) {
        stmt.run(id, this.collection);
      }
    });
    deleteMany(ids);
    console.log(`[LocalVectorStore] ${ids.length} documentos removidos`);
  }

  async getStats() {
    await this.initialize();
    const count = await this._count();
    return {
      backend: 'local-sqlite',
      collection: this.collection,
      totalDocuments: count,
      dbPath: this.dbPath,
      embeddingDim: this.embeddingDim
    };
  }

  async clear() {
    await this.initialize();
    this.db.prepare('DELETE FROM documents WHERE collection = ?').run(this.collection);
    console.log(`[LocalVectorStore] Coleção "${this.collection}" limpa`);
  }

  async isHealthy() {
    try {
      await this.initialize();
      this.db.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }

  // ============ MÉTODOS PRIVADOS ============

  async _count() {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM documents WHERE collection = ?').get(this.collection);
    return row.count;
  }

  /**
   * Calcula cosine similarity entre dois vetores
   * @param {number[]} a
   * @param {number[]} b
   * @returns {number} Similaridade entre 0 e 1
   */
  _cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }
}

module.exports = LocalVectorStore;