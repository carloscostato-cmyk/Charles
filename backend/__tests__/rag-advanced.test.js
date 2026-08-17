/**
 * Testes para RAG
 * Cobre: embeddings.js, local-vector-store.js, rag-service.js
 */
const path = require('path');
const os = require('os');
const fs = require('fs');

describe('Embeddings - Geração de Embeddings', () => {
  const { EmbeddingProvider } = require('../rag/embeddings');

  test('gera embedding local para texto', async () => {
    const provider = new EmbeddingProvider();
    const embedding = await provider.embed('data center em são paulo');
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(384);
  });

  test('gera embedding zero para texto vazio', async () => {
    const provider = new EmbeddingProvider();
    const embedding = await provider.embed('');
    expect(embedding).toHaveLength(384);
    expect(embedding.every(v => v === 0)).toBe(true);
  });

  test('embedBatch gera embeddings para múltiplos textos', async () => {
    const provider = new EmbeddingProvider();
    const embeddings = await provider.embedBatch(['texto um', 'texto dois']);
    expect(embeddings).toHaveLength(2);
    expect(embeddings[0]).toHaveLength(384);
  });

  test('embedBatch processa em lotes de 10', async () => {
    const provider = new EmbeddingProvider();
    const texts = Array.from({ length: 12 }, (_, i) => `texto ${i}`);
    const embeddings = await provider.embedBatch(texts);
    expect(embeddings).toHaveLength(12);
  });

  test('getInfo retorna informações do provedor', () => {
    const provider = new EmbeddingProvider();
    const info = provider.getInfo();
    expect(info.provider).toBeDefined();
    expect(info.dimensions).toBe(384);
    expect(info.available).toBe(false);
  });

  test('embedding local é determinístico', async () => {
    const provider = new EmbeddingProvider();
    const e1 = await provider.embed('mesmo texto');
    const e2 = await provider.embed('mesmo texto');
    expect(e1).toEqual(e2);
  });

  test('embedding local normaliza vetor (L2)', async () => {
    const provider = new EmbeddingProvider();
    const embedding = await provider.embed('texto com várias palavras para normalizar');
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1, 1);
  });
});

describe('LocalVectorStore - Vector Store Local', () => {
  const LocalVectorStore = require('../rag/local-vector-store');
  let store;
  let dbPath;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `vector-store-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.db`);
    store = new LocalVectorStore({ dbPath, collection: 'test-collection' });
  });

  afterEach(() => {
    if (fs.existsSync(dbPath)) {
      try { fs.unlinkSync(dbPath); } catch {}
      try { fs.unlinkSync(dbPath + '-wal'); } catch {}
      try { fs.unlinkSync(dbPath + '-shm'); } catch {}
    }
  });

  test('initialize cria banco de dados', async () => {
    await store.initialize();
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  test('addDocuments adiciona e retorna IDs', async () => {
    await store.initialize();
    const ids = await store.addDocuments([
      { id: 'doc1', content: 'Conteúdo 1', embedding: [1, 0, 0], metadata: { tipo: 'faq' } },
      { id: 'doc2', content: 'Conteúdo 2', embedding: [0, 1, 0], metadata: { tipo: 'manual' } }
    ]);
    expect(ids).toEqual(['doc1', 'doc2']);
  });

  test('similaritySearch retorna resultados ordenados por score', async () => {
    await store.initialize();
    await store.addDocuments([
      { id: 'doc1', content: 'Data center em São Paulo', embedding: [1, 0, 0], metadata: {} },
      { id: 'doc2', content: 'Procedimento de acesso', embedding: [0, 1, 0], metadata: {} }
    ]);
    const results = await store.similaritySearch([1, 0, 0], 2);
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('doc1');
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  test('similaritySearch aplica filtros de metadata', async () => {
    await store.initialize();
    await store.addDocuments([
      { id: 'doc1', content: 'Conteúdo 1', embedding: [1, 0, 0], metadata: { tipo: 'faq' } },
      { id: 'doc2', content: 'Conteúdo 2', embedding: [1, 0, 0], metadata: { tipo: 'manual' } }
    ]);
    const results = await store.similaritySearch([1, 0, 0], 5, { tipo: 'faq' });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('doc1');
  });

  test('similaritySearch retorna vazio para coleção sem documentos', async () => {
    await store.initialize();
    const results = await store.similaritySearch([1, 0, 0]);
    expect(results).toEqual([]);
  });

  test('deleteDocuments remove documentos', async () => {
    await store.initialize();
    await store.addDocuments([
      { id: 'doc1', content: 'Conteúdo 1', embedding: [1, 0, 0], metadata: {} }
    ]);
    await store.deleteDocuments(['doc1']);
    const results = await store.similaritySearch([1, 0, 0]);
    expect(results).toEqual([]);
  });

  test('getStats retorna estatísticas', async () => {
    await store.initialize();
    await store.addDocuments([
      { id: 'doc1', content: 'Conteúdo 1', embedding: [1, 0, 0], metadata: {} }
    ]);
    const stats = await store.getStats();
    expect(stats.backend).toBe('local-sqlite');
    expect(stats.collection).toBe('test-collection');
    expect(stats.totalDocuments).toBe(1);
  });

  test('clear remove todos os documentos', async () => {
    await store.initialize();
    await store.addDocuments([
      { id: 'doc1', content: 'Conteúdo 1', embedding: [1, 0, 0], metadata: {} }
    ]);
    await store.clear();
    const stats = await store.getStats();
    expect(stats.totalDocuments).toBe(0);
  });

  test('isHealthy retorna true', async () => {
    expect(await store.isHealthy()).toBe(true);
  });

  test('cosine similarity calcula corretamente', () => {
    expect(store._cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(store._cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(store._cosineSimilarity([1, 0], [1, 1])).toBeCloseTo(0.707, 2);
  });

  test('cosine similarity retorna 0 para vetores de tamanhos diferentes', () => {
    expect(store._cosineSimilarity([1, 0], [1])).toBe(0);
  });

  test('cosine similarity retorna 0 para vetor nulo', () => {
    expect(store._cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

describe('RAGService - Serviço RAG', () => {
  const { RAGService } = require('../rag/rag-service');

  test('indexText indexa texto e retrieve retorna contexto', async () => {
    const service = new RAGService();
    await service.indexText('O data center de São Paulo fica na Avenida Paulista.', {
      fileName: 'teste.txt'
    });
    const result = await service.retrieveContextForPrompt('onde fica o data center de são paulo?');
    expect(result.hasContext).toBe(true);
    expect(result.context.length).toBeGreaterThan(0);
    expect(result.sources.length).toBeGreaterThan(0);
  });

  test('retrieve retorna validação', async () => {
    const service = new RAGService();
    await service.indexText('Procedimento de acesso ao data center.', { fileName: 'proc.txt' });
    const result = await service.retrieve('como acessar o data center?');
    expect(result.validation).toBeDefined();
    expect(result.results).toBeDefined();
  });

  test('getStats retorna estatísticas', async () => {
    const service = new RAGService();
    const stats = await service.getStats();
    expect(stats.backend).toBe('local-sqlite');
    expect(stats.embeddingProvider).toBeDefined();
    expect(stats.totalSources).toBeGreaterThanOrEqual(0);
  });

  test('isHealthy retorna true', async () => {
    const service = new RAGService();
    expect(await service.isHealthy()).toBe(true);
  });

  test('clear limpa base de conhecimento', async () => {
    const service = new RAGService();
    await service.indexText('Texto para limpar', { fileName: 'limpar.txt' });
    await service.clear();
    const stats = await service.getStats();
    expect(stats.totalDocuments).toBe(0);
    expect(stats.totalSources).toBe(0);
  });

  test('indexText com mesmo sourceKey não duplica', async () => {
    const service = new RAGService();
    await service.indexText('Texto único', { fileName: 'unico.txt' });
    const result = await service.indexText('Texto único', { fileName: 'unico.txt' });
    expect(result.skipped).toBe(true);
    expect(result.chunks).toBe(0);
  });
});