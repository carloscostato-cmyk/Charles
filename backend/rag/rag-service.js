/**
 * rag-service.js
 *
 * Serviço principal de RAG (Retrieval-Augmented Generation).
 * Orquestra: Document Loader -> Chunker -> Embeddings -> Vector Store
 * Implementa: Context Retrieval + Context Compression
 *
 * FASE 1 - RAG Enterprise
 */

const LocalVectorStore = require('./local-vector-store');
const { getEmbeddingProvider } = require('./embeddings');
const Chunker = require('./chunker');
const DocumentLoader = require('./document-loader');
const { getRAGValidator } = require('./rag-validator');
const { v4: uuidv4 } = require('uuid');

class RAGService {
  constructor() {
    this.vectorStore = new LocalVectorStore({ collection: 'charles-knowledge' });
    this.embeddingProvider = getEmbeddingProvider();
    this.chunker = new Chunker({ chunkSize: 500, chunkOverlap: 50 });
    this.documentLoader = new DocumentLoader();
    this.validator = getRAGValidator();
    this._initialized = false;
    this._indexedSources = new Set();
  }

  async initialize() {
    if (this._initialized) return;
    await this.vectorStore.initialize();
    this._initialized = true;
    console.log('[RAG] Serviico RAG inicializado');
  }

  // ============ INDEXACAO ============

  async indexFile(filePath, extraMetadata = {}) {
    await this.initialize();
    console.log(`[RAG] Indexando arquivo: ${filePath}`);
    const doc = await this.documentLoader.loadFile(filePath);
    return await this._indexDocument(doc, extraMetadata);
  }

  async indexURL(url, extraMetadata = {}) {
    await this.initialize();
    console.log(`[RAG] Indexando URL: ${url}`);
    const doc = await this.documentLoader.loadURL(url);
    return await this._indexDocument(doc, extraMetadata);
  }

  async indexText(text, metadata = {}) {
    await this.initialize();
    const doc = this.documentLoader.loadText(text, metadata);
    return await this._indexDocument(doc, metadata);
  }

  async indexFAQItems(items, metadata = {}) {
    await this.initialize();
    const chunks = this.chunker.chunkQAItems(items, { ...metadata, source: 'faq' });
    return await this._indexChunks(chunks, 'faq');
  }

  async _indexDocument(doc, extraMetadata = {}) {
    const sourceKey = doc.metadata.filePath || doc.metadata.url || doc.metadata.source || uuidv4();

    if (this._indexedSources.has(sourceKey)) {
      console.log(`[RAG] Fonte ja indexada: ${sourceKey}`);
      return { chunks: 0, source: sourceKey, skipped: true };
    }

    const chunks = this.chunker.chunk(doc.content, {
      ...doc.metadata,
      ...extraMetadata
    });

    const result = await this._indexChunks(chunks, sourceKey);
    this._indexedSources.add(sourceKey);
    return result;
  }

  async _indexChunks(chunks, source) {
    if (chunks.length === 0) {
      return { chunks: 0, source };
    }

    console.log(`[RAG] Gerando embeddings para ${chunks.length} chunks...`);

    const texts = chunks.map((c) => c.content);
    const embeddings = await this.embeddingProvider.embedBatch(texts);

    const documents = chunks.map((chunk, i) => ({
      id: uuidv4(),
      content: chunk.content,
      embedding: embeddings[i],
      metadata: chunk.metadata
    }));

    await this.vectorStore.addDocuments(documents);

    console.log(`[RAG] ${chunks.length} chunks indexados (fonte: ${source})`);
    return { chunks: chunks.length, source };
  }

  // ============ RETRIEVAL ============

  async retrieve(query, topK = 8, filter = {}) {
    await this.initialize();

    const queryEmbedding = await this.embeddingProvider.embed(query);
    const results = await this.vectorStore.similaritySearch(queryEmbedding, topK, filter);

    // Validação RAG: filtra documentos com baixa relevância e verifica confiança
    const validation = this.validator.validate(query, results);

    console.log(
      `[RAG] Retrieval: ${validation.filteredResults.length}/${results.length} resultados validados ` +
      `(query: "${query.substring(0, 50)}...", confianca: ${(validation.confidence * 100).toFixed(0)}%, valido: ${validation.valid})`
    );

    return {
      results: validation.filteredResults,
      validation
    };
  }

  async retrieveContextForPrompt(query, topK = 8) {
    const { results, validation } = await this.retrieve(query, topK);

    if (!validation.canAnswer || results.length === 0) {
      return {
        context: '',
        sources: [],
        hasContext: false,
        validation: {
          canAnswer: false,
          reason: validation.reason,
          confidence: validation.confidence,
          confidenceLevel: validation.confidenceLevel
        }
      };
    }

    // Context Compression: formata apenas o essencial com mais detalhes
    const contextParts = results.map((r, i) => {
      const source = r.metadata?.fileName || r.metadata?.source || 'desconhecido';
      const relevancia = (r.score * 100).toFixed(0);
      return `[Contexto ${i + 1}] (relevância: ${relevancia}%, fonte: ${source})\n${r.content}`;
    });

    return {
      context: contextParts.join('\n\n'),
      sources: results.map((r) => ({
        content: r.content.substring(0, 200),
        score: Math.round(r.score * 100),
        metadata: r.metadata
      })),
      hasContext: true,
      validation: {
        canAnswer: true,
        reason: validation.reason,
        confidence: validation.confidence,
        confidenceLevel: validation.confidenceLevel
      }
    };
  }

  // ============ GESTAO ============

  async getStats() {
    await this.initialize();
    const storeStats = await this.vectorStore.getStats();
    const embedInfo = this.embeddingProvider.getInfo();

    return {
      ...storeStats,
      embeddingProvider: embedInfo,
      indexedSources: Array.from(this._indexedSources),
      totalSources: this._indexedSources.size
    };
  }

  async clear() {
    await this.initialize();
    await this.vectorStore.clear();
    this._indexedSources.clear();
    console.log('[RAG] Base de conhecimento limpa');
  }

  async isHealthy() {
    try {
      await this.initialize();
      return await this.vectorStore.isHealthy();
    } catch {
      return false;
    }
  }
}

// Singleton
let instance = null;

function getRAGService() {
  if (!instance) {
    instance = new RAGService();
  }
  return instance;
}

module.exports = { getRAGService, RAGService };