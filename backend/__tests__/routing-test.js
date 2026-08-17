/**
 * routing-test.js
 * 
 * Teste de roteamento de especialistas de Data Center
 * Valida que as 5 consultas diferentes são roteadas para os especialistas corretos
 */

const { getRouterAgent, INTENT_CATEGORIES } = require('../agents/router-agent');
const { getDataCenterLoader } = require('../rag/datacenter-loader');
const path = require('path');

console.log('\n=== TESTE DE ROTEAMENTO DE ESPECIALISTAS ===\n');

// Inicializa router e data centers
const router = getRouterAgent();
const dcLoader = getDataCenterLoader();

// Carrega dados de teste
const excelPath = path.join(__dirname, '..', '..', 'sites_data_center.xlsx');
dcLoader.loadFromExcel(excelPath);

// Casos de teste
const testCases = [
  {
    nome: 'Localização',
    query: 'Onde fica o data center de São Paulo?',
    expectedIntent: INTENT_CATEGORIES.DATACENTER_LOCATION,
    expectedSource: 'specialist-locator'
  },
  {
    nome: 'Contato',
    query: 'Qual o telefone do data center do Rio?',
    expectedIntent: INTENT_CATEGORIES.DATACENTER_CONTACT,
    expectedSource: 'specialist-contact'
  },
  {
    nome: 'Diretório',
    query: 'Quais são todos os data centers da Claro?',
    expectedIntent: INTENT_CATEGORIES.DATACENTER_DIRECTORY,
    expectedSource: 'specialist-directory'
  },
  {
    nome: 'Região',
    query: 'Quantos data centers temos no Sudeste?',
    expectedIntent: INTENT_CATEGORIES.DATACENTER_REGION,
    expectedSource: 'specialist-region'
  },
  {
    nome: 'Disponibilidade',
    query: 'Qual a capacidade de servidores do data center?',
    expectedIntent: INTENT_CATEGORIES.DATACENTER_AVAILABILITY,
    expectedSource: 'specialist-availability'
  },
  {
    nome: 'Energia',
    query: 'Como funciona o sistema de energia do data center?',
    expectedIntent: INTENT_CATEGORIES.DATACENTER_AVAILABILITY,
    expectedSource: 'specialist-availability'
  },
  {
    nome: 'Segurança',
    query: 'Qual é o sistema de segurança física?',
    expectedIntent: INTENT_CATEGORIES.DATACENTER_AVAILABILITY,
    expectedSource: 'specialist-availability'
  }
];

let passados = 0;
let falhados = 0;

for (const test of testCases) {
  console.log(`\n📝 Teste: ${test.nome}`);
  console.log(`   Query: "${test.query}"`);
  
  const intent = router.classifyIntent(test.query);
  console.log(`   Intent Detectado: ${intent.category}`);
  console.log(`   Confiança: ${(intent.confidence * 100).toFixed(0)}%`);
  console.log(`   Reasoning: ${intent.reasoning}`);
  
  const agents = router.selectAgents(intent.category);
  console.log(`   Agentes: ${agents.join(', ')}`);
  
  // Processa a pergunta
  const resultado = router.processar(test.query, [], '', 'teste');
  console.log(`   Fonte Final: ${resultado.fonte}`);
  console.log(`   Resposta Preview: ${resultado.resposta.substring(0, 80)}...`);
  
  // Valida
  const intentOK = intent.category === test.expectedIntent;
  const fontOK = resultado.fonte === test.expectedSource;
  
  if (intentOK && fontOK) {
    console.log(`   ✅ PASSOU`);
    passados++;
  } else {
    console.log(`   ❌ FALHOU`);
    if (!intentOK) {
      console.log(`      Intent esperado: ${test.expectedIntent}, recebido: ${intent.category}`);
    }
    if (!fontOK) {
      console.log(`      Fonte esperada: ${test.expectedSource}, recebida: ${resultado.fonte}`);
    }
    falhados++;
  }
}

// Teste de Data Centers carregados
console.log(`\n\n📊 ESTATÍSTICAS DE DATA CENTERS:\n`);
const stats = dcLoader.getStats();
console.log(`   Total de Data Centers: ${stats.totalDataCenters}`);
console.log(`   Cidades: ${stats.cidades}`);
console.log(`   Estados: ${stats.ufs}`);
console.log(`   Locais: ${stats.listaCidades.join(', ')}`);

// Teste de busca
console.log(`\n\n🔍 TESTE DE BUSCA:\n`);
const searchTest = dcLoader.search('São Paulo');
console.log(`   Busca por "São Paulo": ${searchTest.length} resultado(s)`);
if (searchTest.length > 0) {
  console.log(`   Primeiro resultado: ${searchTest[0].titulo}`);
}

// Resumo
console.log(`\n\n📈 RESUMO:\n`);
console.log(`   Testes Passados: ${passados}/${testCases.length} ✅`);
console.log(`   Testes Falhados: ${falhados}/${testCases.length} ❌`);
console.log(`   Taxa de Sucesso: ${((passados / testCases.length) * 100).toFixed(0)}%`);

if (falhados === 0) {
  console.log(`\n✨ TODOS OS TESTES PASSARAM! Sistema de roteamento funcionando corretamente.\n`);
  process.exit(0);
} else {
  console.log(`\n⚠️  ${falhados} teste(s) falhado(s). Verifique os especialistas.\n`);
  process.exit(1);
}
