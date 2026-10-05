/**
 * quality-improvement-agent.test.js
 * Testes para o QualityImprovementAgent
 */

const { QualityImprovementAgent } = require('../agents/quality-improvement-agent');

jest.mock('../observability/tracer', () => ({
  getTracer: () => ({
    initialize: jest.fn(),
    db: {
      prepare: () => ({
        all: () => [],
        get: () => ({ avg: 85 })
      })
    }
  })
}));

jest.mock('../rag/rag-service', () => ({
  getRAGService: () => ({
    retrieve: jest.fn().mockResolvedValue({
      results: [{ score: 0.8, content: 'contexto teste' }],
      validation: { valid: true, canAnswer: true }
    })
  })
}));

jest.mock('../rag/datacenter-loader', () => ({
  getDataCenterLoader: () => ({
    search: jest.fn().mockReturnValue([{ titulo: 'DC-SP', cidade: 'São Paulo', uf: 'SP' }]),
    gerarContextoRAG: jest.fn().mockReturnValue([
      { content: 'DC SP contexto', metadata: { source: 'datacenters' } }
    ])
  })
}));

jest.mock('../faq-reader', () => ({
  lerFAQ: () => [
    { pergunta: 'como dar acesso', resposta: 'procedimento...', score: 0.9 },
    { pergunta: 'objetivo ITSM', resposta: 'objetivo...', score: 0.85 }
  ]
}));

jest.mock('../faq-search', () => ({
  buscarNaFAQ: (q, faq, k) => faq.filter(f => f.pergunta.includes(q.split(' ')[0])).slice(0, k)
}));

jest.mock('../agents/knowledge-gap', () => ({
  listarPerguntasPendentes: () => [
    { id: 1, pergunta: 'backup procedure', vezesPerguntada: 3 },
    { id: 2, pergunta: 'firmware update', vezesPerguntada: 1 }
  ],
  marcarRespondida: jest.fn()
}));

describe('QualityImprovementAgent', () => {
  let agent;

  beforeEach(() => {
    agent = new QualityImprovementAgent();
  });

  test('deve calcular composite score corretamente', () => {
    const metrics = {
      retrievalPrecision: 0.9,
      citationRate: 0.95,
      hallucinationRate: 0.02,
      coverageRate: 0.85,
      avgQualityScore: 0.88,
      faqFreshness: 0.7
    };

    const score = agent._calculateCompositeScore(metrics);
    expect(score).toBeGreaterThan(7);
    expect(score).toBeLessThanOrEqual(10);
  });

  test('deve identificar issues quando métricas abaixo do threshold', () => {
    const metrics = {
      retrievalPrecision: 0.5,
      citationRate: 0.6,
      hallucinationRate: 0.15,
      coverageRate: 0.4,
      avgQualityScore: 0.5,
      faqFreshness: 0.2
    };

    const issues = agent._identifyIssues(metrics);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some(i => i.type === 'RETRIEVAL_PRECISION')).toBe(true);
    expect(issues.some(i => i.type === 'HALLUCINATION_RATE')).toBe(true);
  });

  test('deve retornar dashboard com progresso', () => {
    const dashboard = agent.getDashboard();
    expect(dashboard).toHaveProperty('currentScore');
    expect(dashboard).toHaveProperty('targetScore');
    expect(dashboard).toHaveProperty('progress');
    expect(dashboard).toHaveProperty('trend');
  });

  test('deve atualizar configuração', () => {
    const newConfig = agent.updateConfig({ targetScore: 9.5, evaluationIntervalHours: 12 });
    expect(newConfig.targetScore).toBe(9.5);
    expect(newConfig.evaluationIntervalHours).toBe(12);
  });
});

/**
 * D3 — Métrica "conversaHumana"
 *
 * Antes, o quality agent media apenas qualidade documental e dava nota alta
 * mesmo com o Charles quebrado na conversa. Estas testes cobrem a régua nova.
 */
describe('QualityImprovementAgent — Métrica Conversa Humana', () => {
  /** Cria agente com traces sociais simulados. */
  function criarAgenteComTraces(traces) {
    jest.resetModules();
    jest.doMock('../observability/tracer', () => ({
      getTracer: () => ({
        initialize: jest.fn(),
        db: {
          prepare: (sql) => {
            // Só o query de traces sociais retorna dados controlledos.
            if (String(sql).includes("fonte LIKE 'social:%'")) {
              return { all: () => traces };
            }
            return { all: () => [], get: () => ({ avg: 0 }) };
          }
        }
      })
    }));

    const mod = require('../agents/quality-improvement-agent');
    return new mod.QualityImprovementAgent();
  }

  afterEach(() => {
    jest.resetModules();
    jest.dontMock('../observability/tracer');
  });

  test('social trace com saudação coerente = 1.0 (nota máxima)', async () => {
    const agente = criarAgenteComTraces([
      { answer: 'Bom dia, Carlos! Sou o Charles, especialista em Data Center.', fonte: 'social:saudacao' }
    ]);

    await expect(agente._measureConversaHumana()).resolves.toBe(1);
  });

  test('formato técnico em small talk = penalizado (o bug histórico)', async () => {
    const agente = criarAgenteComTraces([
      { answer: 'Confiança: Alto\nFatos Confirmados:\n- Nenhum', fonte: 'social:saudacao' }
    ]);

    const score = await agente._measureConversaHumana();
    expect(score).toBe(0);
  });

  test('resposta social vazia = penalizada', async () => {
    const agente = criarAgenteComTraces([
      { answer: '', fonte: 'social:agradecimento' }
    ]);

    await expect(agente._measureConversaHumana()).resolves.toBe(0);
  });

  test('mistura: parte boa, parte com formato técnico', async () => {
    const agente = criarAgenteComTraces([
      { answer: 'Boa tarde! Como posso ajudar?', fonte: 'social:saudacao' },
      { answer: 'Confiança: Baixo\nFatos Confirmados: - nenhum', fonte: 'social:estado' }
    ]);

    await expect(agente._measureConversaHumana()).resolves.toBe(0.5);
  });

  test('sem traces sociais = 1.0 (não penaliza instalação nova)', async () => {
    const agente = criarAgenteComTraces([]);
    await expect(agente._measureConversaHumana()).resolves.toBe(1);
  });

  test('conversa ruim gera issue CONVERSA_HUMANA', () => {
    const { QualityImprovementAgent } = require('../agents/quality-improvement-agent');
    const agente = new QualityImprovementAgent();

    const issues = agente._identifyIssues({
      retrievalPrecision: 0.95,
      citationRate: 0.95,
      hallucinationRate: 0.01,
      coverageRate: 0.95,
      avgQualityScore: 0.9,
      faqFreshness: 1,
      conversaHumana: 0.5
    });

    expect(issues.some((i) => i.type === 'CONVERSA_HUMANA')).toBe(true);
  });

  test('conversa boa NÃO gera issue CONVERSA_HUMANA', () => {
    const { QualityImprovementAgent } = require('../agents/quality-improvement-agent');
    const agente = new QualityImprovementAgent();

    const issues = agente._identifyIssues({
      retrievalPrecision: 0.95,
      citationRate: 0.95,
      hallucinationRate: 0.01,
      coverageRate: 0.95,
      avgQualityScore: 0.9,
      faqFreshness: 1,
      conversaHumana: 1
    });

    expect(issues.some((i) => i.type === 'CONVERSA_HUMANA')).toBe(false);
  });

  test('métrica entra no score composto com peso próprio', () => {
    const { QualityImprovementAgent } = require('../agents/quality-improvement-agent');
    const agente = new QualityImprovementAgent();

    const base = {
      retrievalPrecision: 0.95,
      citationRate: 0.95,
      hallucinationRate: 0.01,
      coverageRate: 0.95,
      avgQualityScore: 0.9,
      faqFreshness: 1
    };

    const comConversaBoa = agente._calculateCompositeScore({ ...base, conversaHumana: 1 });
    const comConversaRuim = agente._calculateCompositeScore({ ...base, conversaHumana: 0 });

    // Conversa ruim TEM de reduzir a nota final — é o objetivo da métrica.
    expect(comConversaRuim).toBeLessThan(comConversaBoa);
  });

  test('métrica ausente mantém compatibilidade (metrics sem conversaHumana)', () => {
    const { QualityImprovementAgent } = require('../agents/quality-improvement-agent');
    const agente = new QualityImprovementAgent();

    const metrics = {
      retrievalPrecision: 0.9,
      citationRate: 0.95,
      hallucinationRate: 0.02,
      coverageRate: 0.85,
      avgQualityScore: 0.88,
      faqFreshness: 0.7
    };

    const score = agente._calculateCompositeScore(metrics);
    expect(score).toBeGreaterThan(7);
    expect(score).toBeLessThanOrEqual(10);
  });
});