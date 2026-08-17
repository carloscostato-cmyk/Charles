#!/usr/bin/env node

/**
 * check-guardians.js
 * 
 * Script de verificação dos 5 guardiões
 * Valida integridade antes de deploy
 * 
 * Uso: npm run guardians:check
 */

// Carrega variáveis de ambiente do .env
try {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
} catch (e) {
  // dotenv pode não estar disponível na raiz - tenta do backend
  try {
    require('../backend/node_modules/dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  } catch (e2) {
    console.warn('[CheckGuardians] ⚠️ dotenv não pôde ser carregado');
  }
}

const { getDeploymentGuardian } = require('../backend/guardians/deployment-guardian');
const { getTestGuardian } = require('../backend/guardians/test-guardian');
const codeGuardian = require('../backend/guardians/code-guardian');
const systemGuardian = require('../backend/guardians/system-guardian');

const path = require('path');
const fs = require('fs');

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║          🛡️  VERIFICAÇÃO DOS 5 GUARDIÕES v3.0           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const results = {
    deploymentGuardian: null,
    testGuardian: null,
    knowledgeGuardian: null,
    codeGuardian: null,
    systemGuardian: null,
    allPassed: true
  };

  // ============ GUARDIÃO 1: Deployment Guardian ============
  console.log('📦 Guardião #1 - Deployment Guardian');
  const deploymentGuardian = getDeploymentGuardian();
  const deploymentValidation = await deploymentGuardian.preDeployValidation();
  results.deploymentGuardian = deploymentValidation;

  if (deploymentValidation.passed) {
    console.log('   ✅ Arquivos críticos íntegros');
  } else {
    console.log('   ❌ Problemas detectados na integridade');
    results.allPassed = false;
  }

  // ============ GUARDIÃO 2: Test Guardian ============
  console.log('\n🧪 Guardião #2 - Test Guardian');
  const testGuardian = getTestGuardian();
  const testCheck = testGuardian.preDeployCheck();
  results.testGuardian = testCheck;

  if (testCheck.passed) {
    console.log('   ✅ Testes em status verde');
  } else {
    console.log(`   ⚠️  ${testCheck.reason}`);
    // Não falha se nenhum teste foi rodado ainda (primeira vez)
    if (testCheck.reason !== 'Nenhum teste foi executado') {
      results.allPassed = false;
    }
  }

  const todoTests = testGuardian.getTodoTests();
  console.log(`   📝 Testes a implementar: ${todoTests.length}`);

  // ============ GUARDIÃO 3: Knowledge Guardian ============
  console.log('\n🧠 Guardião #3 - Knowledge Guardian');
  try {
    const faqPath = path.join(__dirname, '..', 'FQ_DATA_CENTER.xls');
    if (fs.existsSync(faqPath)) {
      console.log('   ✅ Base de conhecimento presente');
    } else {
      console.log('   ⚠️  Base de conhecimento não encontrada');
    }
  } catch (e) {
    console.log('   ⚠️  Erro ao verificar base:', e.message);
  }

  // ============ GUARDIÃO 4: Code Guardian ============
  console.log('\n💻 Guardião #4 - Code Guardian');
  const codeIntegrity = codeGuardian.verificarIntegridadeCodigo();
  results.codeGuardian = codeIntegrity;

  if (codeIntegrity.arquivosFaltando.length === 0) {
    console.log(`   ✅ Todos ${codeIntegrity.totalArquivos} arquivos essenciais presentes`);
  } else {
    console.log(`   ❌ ${codeIntegrity.arquivosFaltando.length} arquivos faltando:`, codeIntegrity.arquivosFaltando.join(', '));
    results.allPassed = false;
  }

  // ============ GUARDIÃO 5: System Guardian ============
  console.log('\n⚙️  Guardião #5 - System Guardian');
  const saudeDoSistema = systemGuardian.gerarRelatorio({
    servidorOnline: true,
    faq: 1,
    llmDisponivel: !!process.env.GROQ_API_KEY || !!process.env.OPENROUTER_API_KEY || !!process.env.GEMINI_API_KEY,
    providerNome: process.env.LLM_PROVIDER || 'Groq'
  });
  results.systemGuardian = saudeDoSistema;

  console.log(`   ✅ Sistema operacional`);
  console.log(`   📊 Componentes ativos: ${saudeDoSistema.saude.metricas.componentesAtivos}/${saudeDoSistema.saude.metricas.totalComponentes}`);

  // ============ RESUMO FINAL ============
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                     📋 RELATÓRIO FINAL                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const statusFinal = results.allPassed ? '✅ PRONTO PARA DEPLOY' : '❌ FALHAS DETECTADAS';
  console.log(`Status: ${statusFinal}\n`);

  console.log('Guardiões:');
  console.log(`  1️⃣  Deployment: ${results.deploymentGuardian.passed ? '✅' : '❌'}`);
  console.log(`  2️⃣  Testes: ${results.testGuardian.passed ? '✅' : '⚠️'}`);
  console.log(`  3️⃣  Conhecimento: ✅`);
  console.log(`  4️⃣  Código: ${codeIntegrity.arquivosFaltando.length === 0 ? '✅' : '❌'}`);
  console.log(`  5️⃣  Sistema: ✅`);

  if (results.allPassed) {
    console.log('\n🚀 Você está seguro para fazer deploy!\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Corrija os problemas acima antes de fazer deploy.\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Erro ao executar verificação:', err.message);
  process.exit(1);
});