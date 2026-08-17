/**
 * router-agent.test.js
 *
 * Testes do agente roteador.
 * Valida classificação de intenção e roteamento para especialistas.
 */

const { getRouterAgent } = require('../agents/router-agent');

describe('Router Agent', () => {
  let router;

  beforeAll(() => {
    router = getRouterAgent();
  });

  describe('Classificacao de intencao', () => {
    test('deve detectar intencao de localizacao', () => {
      const result = router.classifyIntent('onde fica o data center de sao paulo');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('confidence');
    });

    test('deve detectar intencao de contato', () => {
      const result = router.classifyIntent('qual o telefone do data center');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('category');
    });

    test('deve detectar intencao de diretorio', () => {
      const result = router.classifyIntent('quais sao todos os data centers');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('category');
    });

    test('deve detectar intencao de regiao', () => {
      const result = router.classifyIntent('quantos data centers temos no sudeste');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('category');
    });

    test('deve detectar intencao de disponibilidade', () => {
      const result = router.classifyIntent('qual a capacidade de energia');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('category');
    });
  });

  describe('Processamento', () => {
    test('deve processar pergunta e retornar resposta', () => {
      const resultado = router.processar('teste', [], 'resposta generica', 'llm');
      expect(resultado).toBeDefined();
      expect(resultado).toHaveProperty('resposta');
    });

    test('deve ter metodo getStats', () => {
      const stats = router.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats.totalRouted).toBe('number');
    });
  });
});
