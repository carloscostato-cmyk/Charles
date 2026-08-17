/**
 * test-rag-validator.js
 *
 * Teste da Validação RAG - Verifica se as regras de validação
 * estão funcionando corretamente.
 */

const { RAGValidator, THRESHOLDS } = require('./rag/rag-validator');

const validator = new RAGValidator();

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.log(`  ❌ ${message}`);
  }
}

console.log('========================================');
console.log('  TESTE - VALIDAÇÃO RAG');
console.log('========================================\n');

console.log('1. Sem documentos recuperados:');
const result1 = validator.validate('Qual o procedimento de acesso ao Data Center?', []);
assert(!result1.canAnswer, 'Não deve responder sem documentos');
assert(result1.reason.includes('Nenhum documento'), 'Deve informar que nenhum documento foi recuperado');
assert(result1.confidence === 0, 'Confiança deve ser 0');

console.log('\n2. Documentos com baixa relevância (score < 0.30):');
const result2 = validator.validate(
  'Qual o procedimento de acesso ao Data Center?',
  [
    { content: 'O clima em São Paulo está ensolarado hoje.', score: 0.10 },
    { content: 'A previsão do tempo para amanhã é de chuva.', score: 0.12 }
  ]
);
assert(!result2.canAnswer, 'Não deve responder com documentos de baixa relevância');
assert(result2.filteredResults.length === 0, 'Deve filtrar todos os documentos de baixa relevância');
assert(result2.reason.includes('relevância suficiente'), 'Deve informar que não há relevância suficiente');

console.log('\n3. Documentos relevantes mas confiança baixa:');
const result3 = validator.validate(
  'Qual o procedimento de acesso ao Data Center?',
  [
    { content: 'O Data Center possui controle de acesso biométrico para entrada.', score: 0.32 },
    { content: 'Acesso ao Data Center requer credencial.', score: 0.28 }
  ]
);
assert(!result3.canAnswer, 'Não deve responder com confiança baixa');
assert(result3.reason.includes('Confiança insuficiente'), 'Deve informar confiança insuficiente');

console.log('\n4. Documentos relevantes e confiança adequada:');
const result4 = validator.validate(
  'Qual o procedimento de acesso ao Data Center?',
  [
    { content: 'O procedimento de acesso ao Data Center requer identificação biométrica e autorização prévia do gestor.', score: 0.85 },
    { content: 'Para acessar o Data Center, o colaborador deve apresentar crachá e registrar entrada no sistema.', score: 0.78 }
  ]
);
assert(result4.canAnswer, 'Deve responder com confiança adequada');
assert(result4.confidence >= THRESHOLDS.MIN_CONFIDENCE_SCORE, 'Confiança deve ser >= limiar mínimo');
assert(result4.confidenceLevel === 'high', 'Nível de confiança deve ser high');
assert(result4.filteredResults.length === 2, 'Deve manter os 2 documentos relevantes');

console.log('\n5. Documentos tematicamente não relacionados:');
const result5 = validator.validate(
  'Qual o procedimento de acesso ao Data Center?',
  [
    { content: 'O restaurante da empresa oferece almoço das 11h às 14h.', score: 0.75 },
    { content: 'O estacionamento possui 200 vagas para colaboradores.', score: 0.70 }
  ]
);
assert(!result5.canAnswer, 'Não deve responder com documentos não relacionados ao tema');
assert(result5.reason.includes('diretamente relacionados'), 'Deve informar que documentos não são relacionados');

console.log('\n6. Pergunta curta (1 termo-chave) - deve permitir:');
const result6 = validator.validate(
  'Data Center',
  [
    { content: 'O Data Center da empresa está localizado em São Paulo e possui certificação Tier III.', score: 0.80 }
  ]
);
assert(result6.canAnswer, 'Deve responder para pergunta curta com documento relevante');

console.log('\n7. decideAnswer - sem contexto:');
const decision1 = validator.decideAnswer('Qual o procedimento?', { hasContext: false });
assert(!decision1.shouldAnswer, 'Não deve responder sem contexto');
assert(decision1.message.includes('não foi encontrada'), 'Deve informar que informação não foi encontrada');

console.log('\n8. decideAnswer - com contexto válido:');
const decision2 = validator.decideAnswer(
  'Qual o procedimento de acesso ao Data Center?',
  {
    hasContext: true,
    sources: [
      { content: 'O procedimento de acesso ao Data Center requer identificação biométrica.', score: 0.80 }
    ]
  }
);
assert(decision2.shouldAnswer, 'Deve responder com contexto válido');
assert(decision2.confidenceLevel === 'medium' || decision2.confidenceLevel === 'high', 'Nível de confiança deve ser medium ou high');

console.log('\n9. decideAnswer - com contexto de baixa confiança:');
const decision3 = validator.decideAnswer(
  'Qual o procedimento de acesso ao Data Center?',
  {
    hasContext: true,
    sources: [
      { content: 'O restaurante da empresa oferece almoço.', score: 0.20 }
    ]
  }
);
assert(!decision3.shouldAnswer, 'Não deve responder com contexto de baixa confiança');

console.log('\n10. Extração de termos-chave:');
const terms = validator._extractKeyTerms('Qual o procedimento de acesso ao Data Center em São Paulo?');
assert(terms.includes('procedimento'), 'Deve extrair "procedimento"');
assert(terms.includes('acesso'), 'Deve extrair "acesso"');
assert(terms.includes('center'), 'Deve extrair "center"');
assert(!terms.includes('qual'), 'Não deve extrair stopword "qual"');
assert(!terms.includes('o'), 'Não deve extrair palavra curta "o"');

console.log('\n11. Cálculo de confiança ponderada:');
const confidence = validator._calculateConfidence([
  { score: 0.90 },
  { score: 0.80 },
  { score: 0.70 }
]);
// Peso: 3*0.90 + 2*0.80 + 1*0.70 = 2.7 + 1.6 + 0.7 = 5.0 / 6 = 0.833
assert(Math.abs(confidence - 0.833) < 0.01, `Confiança ponderada correta (${confidence.toFixed(3)})`);

console.log('\n12. Nível de confiança:');
assert(validator._getConfidenceLevel(0.70, 2) === 'high', 'Score 0.70 com 2 docs = high');
assert(validator._getConfidenceLevel(0.40, 1) === 'medium', 'Score 0.40 com 1 doc = medium');
assert(validator._getConfidenceLevel(0.20, 1) === 'low', 'Score 0.20 com 1 doc = low');

console.log('\n========================================');
console.log(`  RESULTADO: ${passed} passaram, ${failed} falharam`);
console.log('========================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n  ✅ Todos os testes passaram!');
}