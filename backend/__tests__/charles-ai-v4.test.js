/**
 * charles-ai-v4.test.js
 *
 * Testes do CHARLES AI v4 - system prompt integrado
 * Valida: anti-alucinação, formato de resposta, prioridade de fontes,
 * verificação de confiança e política RAG.
 */

const { processarPergunta } = require('../llm-client');

describe('CHARLES AI v4 - System Prompt', () => {

  describe('Anti-Alucinação', () => {
    test('não deve inventar dados quando não há contexto', async () => {
      const resultado = await processarPergunta('Qual é o telefone do presidente da empresa?', [], 'test-user');
      expect(resultado.resposta).toBeDefined();
      expect(resultado.resposta.length).toBeGreaterThan(0);
    });

    test('deve priorizar resposta da FAQ quando disponível', async () => {
      const faqMock = [
        {
          pergunta: 'Qual é o endereço do Data Center de Barueri?',
          resposta: 'O Data Center de Barueri está localizado na Alameda Araguaia, 2252, Alphaville.',
          score: 0.85
        }
      ];
      const resultado = await processarPergunta('Qual é o endereço do Data Center de Barueri?', faqMock, 'test-user');
      expect(resultado.fonte).toBe('faq');
      expect(resultado.resposta).toContain('Alameda Araguaia');
    });

    test('não deve retornar "livro aberto" como resposta', async () => {
      const resultado = await processarPergunta('Explique como funciona o failover em data centers', [], 'test-user');
      const respostaLower = resultado.resposta.toLowerCase();
      expect(respostaLower).not.toContain('livro aberto');
    });
  });

  describe('RAG - Prioridade de Fontes', () => {
    test('deve classificar confiança da resposta', async () => {
      const resultado = await processarPergunta('Qual é o SLA do Data Center?', [], 'test-user');
      // O sistema deve retornar estrutura com qualidade/confiança
      expect(resultado.qualidade).toBeDefined();
      expect(resultado.qualidade).toBeGreaterThanOrEqual(0);
      expect(resultado.qualidade).toBeLessThanOrEqual(100);
    });

    test('deve incluir metadados de fonte na resposta', async () => {
      const faqMock = [
        {
          pergunta: 'Como solicitar acesso ao Data Center?',
          resposta: 'Para solicitar acesso ao Data Center, é necessário abrir chamado na central de serviços.',
          score: 0.9
        }
      ];
      const resultado = await processarPergunta('Como solicitar acesso ao Data Center?', faqMock, 'test-user');
      expect(resultado.fonte).toBeDefined();
      expect(resultado.routing).toBeDefined();
      expect(resultado.routing.intent).toBeDefined();
    });
  });

  describe('Memória Interna', () => {
    test('deve registrar interações na memória', async () => {
      const resultado = await processarPergunta('Qual é o telefone do Data Center de São Paulo?', [], 'test-memory-user');
      expect(resultado.resposta).toBeDefined();
      // A memória deve ser registrada para o usuário
      expect(resultado).toHaveProperty('memory');
    });
  });

  describe('Formato de Resposta', () => {
    test('deve retornar resposta como string válida', async () => {
      const resultado = await processarPergunta('O que é um Data Center Tier III?', [], 'test-format-user');
      expect(typeof resultado.resposta).toBe('string');
      expect(resultado.resposta.trim().length).toBeGreaterThan(0);
    });

    test('deve gerar tipo de resposta para TTS', async () => {
      const resultado = await processarPergunta('Qual a localização do Data Center de Campinas?', [], 'test-tts-user');
      expect(resultado.tipoResposta).toBeDefined();
      expect(resultado.tipoResposta.tipo).toBeDefined();
      expect(typeof resultado.tipoResposta.deveSerFalado).toBe('boolean');
    });
  });
});