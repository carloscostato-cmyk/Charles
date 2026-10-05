const {
  calcularQualityScore,
  verificarEstrutura
} = require('../agents/quality-enforcer');

describe('Quality Enforcer - abstencao segura', () => {
  test('pontua recusa segura acima da meta sem inventar citacao', () => {
    const resposta = [
      'Confiança: Baixo',
      'Fatos Confirmados:',
      '- Não há evidência documental suficiente.',
      'Pontos Não Confirmados:',
      '- O procedimento oficial não foi localizado.',
      'Resposta:',
      'Não encontrei evidência documental suficiente para confirmar essa orientação. Não vou completar a resposta com suposições.'
    ].join('\n');

    const estrutura = verificarEstrutura(resposta);
    const score = calcularQualityScore({
      resposta,
      citations: { hasValidCitation: false, count: 0 },
      estrutura,
      ragValidation: { pass: false, confidence: 0 },
      fonte: 'no-evidence',
      scoreFAQ: 0
    });

    expect(score).toBeGreaterThanOrEqual(85);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('não promove resposta sem evidência que contenha afirmação factual', () => {
    const score = calcularQualityScore({
      resposta: 'O SLA é de 99,99%.',
      citations: { hasValidCitation: false, count: 0 },
      estrutura: verificarEstrutura('O SLA é de 99,99%.'),
      ragValidation: { pass: false, confidence: 0 },
      fonte: 'no-evidence',
      scoreFAQ: 0
    });

    expect(score).toBeLessThan(85);
  });
});
