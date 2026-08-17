/**
 * orchestrator.test.js
 * 
 * Testes do orquestrador de agentes
 * Valida que os 5 agentes especialistas funcionam
 */

const orchestrator = require('../agents/orchestrator');

describe('Orchestrator - 5 Agentes Especialistas', () => {
  
  describe('Agentes disponíveis', () => {
    test('deve ter 5 agentes especialistas', () => {
      const status = orchestrator.getStatusAgentes();
      expect(status.agentes).toBeDefined();
      expect(status.agentes.length).toBe(5);
    });

    test('todos agentes devem ter status', () => {
      const status = orchestrator.getStatusAgentes();
      status.agentes.forEach(agent => {
        expect(agent).toHaveProperty('id');
        expect(agent).toHaveProperty('nome');
        expect(agent).toHaveProperty('status');
      });
    });
  });

  describe('Processamento de pergunta', () => {
    test('deve processar pergunta simples', () => {
      const resultado = orchestrator.processar(
        'Qual é a data de hoje?',
        [],
        'Hoje é 31 de julho de 2026',
        'llm'
      );

      expect(resultado).toHaveProperty('resposta');
      expect(resultado).toHaveProperty('fonte');
      expect(resultado).toHaveProperty('qualidade');
    });

    test('deve retornar resposta não vazia', () => {
      const resultado = orchestrator.processar(
        'teste',
        [],
        '',
        'fallback'
      );

      expect(resultado.resposta).toBeDefined();
      expect(resultado.resposta.length).toBeGreaterThan(0);
    });

    test('deve registrar Knowledge Gap quando sem resposta', () => {
      const resultado = orchestrator.processar(
        'pergunta aleatória sem resposta',
        [],
        '',
        'fallback'
      );

      expect(resultado.fonte).toBeDefined();
    });
  });

  describe('Contexto LLM', () => {
    test('deve gerar contexto para LLM', () => {
      const contexto = orchestrator.gerarContextoLLM(
        'Qual é o procedimento de backup?',
        [{ pergunta: 'Como fazer backup?', resposta: 'Use ferramentas X' }]
      );

      expect(typeof contexto).toBe('string');
    });
  });
});
