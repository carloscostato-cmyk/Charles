/**
 * rag-service.test.js
 *
 * Testes do serviço RAG.
 * Valida indexação, busca semântica e validação de contexto.
 */

const { getRAGService } = require('../rag/rag-service');

describe('RAG Service', () => {
  let ragService;

  beforeAll(async () => {
    ragService = getRAGService();
    await ragService.initialize();
  });

  describe('Inicialização', () => {
    test('deve retornar instancia do servico', () => {
      expect(ragService).toBeDefined();
    });

    test('deve ter metodo retrieve', () => {
      expect(typeof ragService.retrieve).toBe('function');
    });

    test('deve ter metodo getStats', () => {
      expect(typeof ragService.getStats).toBe('function');
    });
  });

  describe('Busca semântica', () => {
    test('deve buscar contexto para pergunta sobre data center', async () => {
      const result = await ragService.retrieve('data center', 5);
      expect(result).toBeDefined();
      expect(result).toHaveProperty('results');
      expect(Array.isArray(result.results)).toBe(true);
    });

    test('deve retornar estatisticas', async () => {
      const stats = await ragService.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats.totalDocuments).toBe('number');
    });
  });

  describe('Indexacao', () => {
    test('deve indexar texto simples', async () => {
      const result = await ragService.indexText('Teste de indexacao RAG', {
        source: 'test',
        testId: 'rag-test-1'
      });
      expect(result).toBeDefined();
    });
  });
});
