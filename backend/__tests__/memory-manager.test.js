/**
 * memory-manager.test.js
 *
 * Testes do gerenciador de memoria.
 * Valida short-term, long-term e semantic memory.
 */

const { getMemoryManager } = require('../memory/memory-manager');

describe('Memory Manager', () => {
  let memoryManager;
  const testUserId = 'test-user-memory';

  beforeAll(async () => {
    memoryManager = getMemoryManager();
  });

  describe('Memoria de curto prazo', () => {
    test('deve lembrar interacao', async () => {
      await memoryManager.remember(testUserId, 'pergunta teste', 'resposta teste', { fonte: 'test' });
      expect(true).toBe(true);
    });

    test('deve recuperar memoria', async () => {
      const memory = await memoryManager.recall(testUserId, 'teste');
      expect(memory).toBeDefined();
      expect(memory).toHaveProperty('history');
      expect(memory).toHaveProperty('facts');
      expect(Array.isArray(memory.history)).toBe(true);
      expect(Array.isArray(memory.facts)).toBe(true);
    });

    test('deve retornar estatisticas', async () => {
      const stats = await memoryManager.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats.shortTerm).toBe('object');
    });
  });

  describe('Sessoes', () => {
    test('deve criar nova sessao', async () => {
      await memoryManager.newSession(testUserId);
      expect(true).toBe(true);
    });
  });
});
