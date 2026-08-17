/**
 * llm-provider.test.js
 *
 * Testes do sistema multi-provider de LLM.
 * Valida fallback, seleção de modelo, e disponibilidade.
 */

const { getProvider, getProvidersStatus, classifyComplexity, selectSmartModel, getProvidersDisponiveis, analyzeImage } = require('../llm-provider');

describe('LLM Provider System', () => {
  
  describe('Provider Selection', () => {
    test('deve retornar um provedor', () => {
      const provider = getProvider();
      expect(provider).toBeDefined();
      expect(provider.name).toBeDefined();
    });

    test('deve ter método chat implementado', () => {
      const provider = getProvider();
      expect(typeof provider.chat).toBe('function');
    });

    test('deve retornar status dos provedores', () => {
      const status = getProvidersStatus();
      expect(Array.isArray(status)).toBe(true);
      expect(status.length).toBeGreaterThan(0);
    });

    test('deve listar provedores disponiveis', () => {
      const providers = getProvidersDisponiveis();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    test('provedores devem ter campos esperados', () => {
      const providers = getProvidersDisponiveis();
      providers.forEach(p => {
        expect(p).toHaveProperty('id');
        expect(p).toHaveProperty('nome');
        expect(p).toHaveProperty('modelo');
      });
    });
  });

  describe('Smart Model Selection', () => {
    test('deve classificar pergunta simples como LOW', () => {
      const result = classifyComplexity('Oi');
      expect(result.level).toBe('LOW');
      expect(result.score).toBeLessThan(2);
    });

    test('deve classificar pergunta longa como MEDIUM+', () => {
      const complexQuery = 'Pode explicar detalhadamente como funciona a arquitetura de um data center, incluindo redundância, failover, e procedimentos de manutenção?';
      const result = classifyComplexity(complexQuery);
      expect(['MEDIUM', 'HIGH']).toContain(result.level);
    });

    test('deve retornar recomendação de modelo', () => {
      const result = selectSmartModel('Qual é a data de hoje?');
      expect(result.model).toBeDefined();
      expect(result.provider).toBeDefined();
      expect(result.complexity).toBeDefined();
    });

    test('deve ter fallback de modelos', () => {
      const lowComplexity = selectSmartModel('oi');
      const highComplexity = selectSmartModel('Explique em detalhes o procedimento de failover em data centers com redundância geográfica');
      
      expect(lowComplexity.complexity.level).toBeDefined();
      expect(highComplexity.complexity.level).toBeDefined();
    });

    test('deve classificar calculo como LOW', () => {
      const result = classifyComplexity('2 + 2');
      expect(result.level).toBe('LOW');
    });

    test('deve classificar saudacao como LOW', () => {
      const result = classifyComplexity('obrigado');
      expect(result.level).toBe('LOW');
    });
  });

  describe('Provider Status', () => {
    test('status deve conter propriedades esperadas', () => {
      const status = getProvidersStatus();
      status.forEach(s => {
        expect(s).toHaveProperty('id');
        expect(s).toHaveProperty('nome');
        expect(s).toHaveProperty('modelo');
      });
    });
  });

  describe('Analyze Image', () => {
    test('deve retornar objeto quando arquivo nao existe', async () => {
      const result = await analyzeImage('/caminho/inexistente/imagem.jpg');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(false);
    });
  });
});
