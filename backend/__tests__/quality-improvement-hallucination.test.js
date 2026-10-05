const { QualityImprovementAgent } = require('../agents/quality-improvement-agent');

describe('QualityImprovementAgent - taxa de alucinacao', () => {
  test('não classifica FAQ, especialista ou abstencao segura como alucinacao', async () => {
    const agent = new QualityImprovementAgent();
    agent.tracer = {
      initialize: jest.fn(),
      db: {
        prepare: () => ({
          all: () => [
            { question: 'endereço', answer: 'Resposta longa fundamentada pela FAQ.', fonte: 'faq' },
            { question: 'localização', answer: 'Resposta longa do especialista.', fonte: 'specialist-locator' },
            {
              question: 'SLA',
              answer: 'Não encontrei evidência documental suficiente para confirmar essa orientação. Não vou completar a resposta com suposições.',
              fonte: 'no-evidence'
            }
          ]
        })
      }
    };
    agent.ragService = {
      retrieve: jest.fn().mockResolvedValue({
        validation: { canAnswer: false },
        results: []
      })
    };

    await expect(agent._measureHallucinationRate()).resolves.toBe(0);
    expect(agent.ragService.retrieve).not.toHaveBeenCalled();
  });

  test('avalia apenas resposta livre longa sem contexto', async () => {
    const agent = new QualityImprovementAgent();
    agent.tracer = {
      initialize: jest.fn(),
      db: {
        prepare: () => ({
          all: () => [{
            question: 'pergunta',
            answer: 'A'.repeat(250),
            fonte: 'llm'
          }]
        })
      }
    };
    agent.ragService = {
      retrieve: jest.fn().mockResolvedValue({
        validation: { canAnswer: false },
        results: []
      })
    };
    agent.verificarAluciniaECC = jest.fn().mockReturnValue(0);

    await expect(agent._measureHallucinationRate()).resolves.toBe(1);
  });
});
