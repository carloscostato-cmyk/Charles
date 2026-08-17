/**
 * tools/tool-registry.test.js
 *
 * Testes do registro de ferramentas.
 * Valida execucao de ferramentas e descoberta.
 */

const { getToolRegistry } = require('../../tools/tool-registry');

describe('Tool Registry', () => {
  let registry;

  beforeAll(() => {
    registry = getToolRegistry();
  });

  describe('Descoberta de ferramentas', () => {
    test('deve listar ferramentas disponiveis', () => {
      const tools = registry.getToolDefinitions();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    test('cada ferramenta deve ter nome e descricao', () => {
      const tools = registry.getToolDefinitions();
      tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
      });
    });

    test('deve ter estatisticas', () => {
      const stats = registry.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats.totalExecutions).toBe('number');
    });
  });

  describe('Execucao de ferramentas', () => {
    test('deve executar ferramenta de data', async () => {
      const result = await registry.executeTool('CurrentDateTool', {});
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    test('deve retornar erro para ferramenta inexistente', async () => {
      const result = await registry.executeTool('FerramentaInexistente', {});
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });
  });
});
