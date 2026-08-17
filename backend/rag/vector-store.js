/**
 * vector-store.js
 *
 * Interface abstrata para Vector Store (Vector Store Abstraction Layer).
 * Segue o princípio Open/Closed (SOLID): aberta para extensão,
 * fechada para modificação. Novos backends (ChromaDB, pgvector, Pinecone)
 * podem ser adicionados implementando esta interface.
 *
 * FASE 1 - RAG Enterprise
 */

/**
 * Classe base abstrata para Vector Stores.
 * Qualquer implementação de vector store deve estender esta classe.
 */
class VectorStore {
  /**
   * Inicializa o vector store
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('Método initialize() deve ser implementado');
  }

  /**
   * Adiciona documentos ao vector store
   * @param {Array<{id: string, content: string, embedding: number[], metadata: Object}>} documents
   * @returns {Promise<string[]>} IDs dos documentos adicionados
   */
  async addDocuments(documents) {
    throw new Error('Método addDocuments() deve ser implementado');
  }

  /**
   * Busca documentos por similaridade semântica
   * @param {number[]} queryEmbedding - Embedding da consulta
   * @param {number} topK - Número de resultados
   * @param {Object} filter - Filtros de metadata opcionais
   * @returns {Promise<Array<{id: string, content: string, score: number, metadata: Object}>>}
   */
  async similaritySearch(queryEmbedding, topK = 5, filter = {}) {
    throw new Error('Método similaritySearch() deve ser implementado');
  }

  /**
   * Remove documentos por ID
   * @param {string[]} ids
   * @returns {Promise<void>}
   */
  async deleteDocuments(ids) {
    throw new Error('Método deleteDocuments() deve ser implementado');
  }

  /**
   * Retorna estatísticas do vector store
   * @returns {Promise<Object>}
   */
  async getStats() {
    throw new Error('Método getStats() deve ser implementado');
  }

  /**
   * Limpa todos os documentos
   * @returns {Promise<void>}
   */
  async clear() {
    throw new Error('Método clear() deve ser implementado');
  }

  /**
   * Verifica se o vector store está saudável
   * @returns {Promise<boolean>}
   */
  async isHealthy() {
    return true;
  }
}

module.exports = VectorStore;