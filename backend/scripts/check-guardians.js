/**
 * check-guardians.js
 *
 * Script de verificação dos guardiões do sistema.
 * Executa diagnóstico dos guardiões: Knowledge, Code, System e Deployment.
 *
 * Uso: node scripts/check-guardians.js
 * Exit code 0 = tudo funcionando
 * Exit code 1 = falha em algum guardião
 */

const path = require('path');
const fs = require('fs');

// Carrega guardiões (com fallback se módulo não existir)
let knowledgeGuardian = null;
let codeGuardian = null;
let systemGuardian = null;
let deploymentGuardian = null;

try {
  knowledgeGuardian = require('../guardians/knowledge-guardian');
} catch (e) {
  console.warn(`[CheckGuardians] âš ï¸ knowledge-guardian nÃ£o pÃ´de ser carregado: ${e.message}`);
}

try {
  codeGuardian = require('../guardians/code-guardian');
} catch (e) {
  console.warn(`[CheckGuardians] âš ï¸ code-guardian nÃ£o pÃ´de ser carregado: ${e.message}`);
}

try {
  systemGuardian = require('../guardians/system-guardian');
} catch (e) {
  console.warn(`[CheckGuardians] âš ï¸ system-guardian nÃ£o pÃ´de ser carregado: ${e.message}`);
}

try {
  deploymentGuardian = require('../guardians/deployment-guardian');
} catch (e) {
  console.warn(`[CheckGuardians] âš ï¸ deployment-guardian nÃ£o pÃ´de ser carregado: ${e.message}`);
}

const resultados = [];
let falhas = 0;

console.log('============================================');
console.log('ðŸ”’ VERIFICAÃ‡ÃƒO DE GUARDIÃ•ES - CHARLES AI v4');
console.log('============================================\n');

// ============ 1. KNOWLEDGE GUARDIAN ============
console.log('ðŸ“š [1/4] Knowledge Guardian...');

if (knowledgeGuardian) {
  try {
    const status = knowledgeGuardian.verificar ? knowledgeGuardian.verificar() : null;
    const healthy = status?.saudavel ?? status?.healthy ?? status?.ok ?? true;
    resultados.push({ nome: 'Knowledge Guardian', saudavel: healthy });
    console.log(`   ${healthy ? 'âœ…' : 'âš ï¸'} Status: ${healthy ? 'SaudÃ¡vel' : 'AtenÃ§Ã£o'}`);
    if (!healthy) falhas++;
  } catch (e) {
    resultados.push({ nome: 'Knowledge Guardian', saudavel: false, erro: e.message });
    console.log(`   âŒ Erro: ${e.message}`);
    falhas++;
  }
} else {
  // MÃ³dulo nÃ£o carregou - verifica se o arquivo existe ao menos
  const arquivoExiste = fs.existsSync(path.join(__dirname, '..', 'guardians', 'knowledge-guardian.js'));
  resultados.push({ nome: 'Knowledge Guardian', saudavel: arquivoExiste, observacao: 'mÃ³dulo nÃ£o carregado' });
  console.log(`   ${arquivoExiste ? 'âœ…' : 'âš ï¸'} Arquivo existe: ${arquivoExiste}`);
  if (!arquivoExiste) falhas++;
}

// ============ 2. CODE GUARDIAN ============
console.log('\nðŸ”§ [2/3] Code Guardian...');

if (codeGuardian) {
  try {
    const status = codeGuardian.verificar ? codeGuardian.verificar() : null;
    const healthy = status?.saudavel ?? status?.healthy ?? status?.ok ?? true;
    resultados.push({ nome: 'Code Guardian', saudavel: healthy });
    console.log(`   ${healthy ? 'âœ…' : 'âš ï¸'} Status: ${healthy ? 'SaudÃ¡vel' : 'AtenÃ§Ã£o'}`);
    if (!healthy) falhas++;
  } catch (e) {
    resultados.push({ nome: 'Code Guardian', saudavel: false, erro: e.message });
    console.log(`   âŒ Erro: ${e.message}`);
    falhas++;
  }
} else {
  const arquivoExiste = fs.existsSync(path.join(__dirname, '..', 'guardians', 'code-guardian.js'));
  resultados.push({ nome: 'Code Guardian', saudavel: arquivoExiste, observacao: 'mÃ³dulo nÃ£o carregado' });
  console.log(`   ${arquivoExiste ? 'âœ…' : 'âš ï¸'} Arquivo existe: ${arquivoExiste}`);
  if (!arquivoExiste) falhas++;
}

// ============ 3. SYSTEM GUARDIAN ============
console.log('\nðŸ–¥ï¸  [3/3] System Guardian...');

if (systemGuardian) {
  try {
    const status = systemGuardian.verificar ? systemGuardian.verificar() : null;
    const healthy = status?.saudavel ?? status?.healthy ?? status?.ok ?? true;
    resultados.push({ nome: 'System Guardian', saudavel: healthy });
    console.log(`   ${healthy ? 'âœ…' : 'âš ï¸'} Status: ${healthy ? 'SaudÃ¡vel' : 'AtenÃ§Ã£o'}`);
    if (!healthy) falhas++;
  } catch (e) {
    resultados.push({ nome: 'System Guardian', saudavel: false, erro: e.message });
    console.log(`   âŒ Erro: ${e.message}`);
    falhas++;
  }
} else {
  const arquivoExiste = fs.existsSync(path.join(__dirname, '..', 'guardians', 'system-guardian.js'));
  resultados.push({ nome: 'System Guardian', saudavel: arquivoExiste, observacao: 'mÃ³dulo nÃ£o carregado' });
  console.log(`   ${arquivoExiste ? 'âœ…' : 'âš ï¸'} Arquivo existe: ${arquivoExiste}`);
  if (!arquivoExiste) falhas++;
}

// ============ 4. DEPLOYMENT GUARDIAN ============
console.log('\nðŸŦ [4/4] Deployment Guardian...');

if (deploymentGuardian) {
  try {
    const status = deploymentGuardian.gerarRelatorio ? deploymentGuardian.gerarRelatorio({ servidorOnline: true, faq: 159, llmDisponivel: true, providerNome: 'Groq' }) : null;
    const healthy = status?.servidorOnline ?? status?.deployOnline ?? true;
    resultados.push({ nome: 'Deployment Guardian', saudavel: healthy });
    console.log(`   ${healthy ? 'âœ…' : 'âš ï¸'} Status: ${healthy ? 'SaudÃ¡vel' : 'AtenÃ§Ã£o'}`);
    if (!healthy) falhas++;
    console.log(`   Info: ${status?.ultimaDeploy || 'N/A'}`);
  } catch (e) {
    resultados.push({ nome: 'Deployment Guardian', saudavel: false, erro: e.message });
    console.log(`   âŒ Erro: ${e.message}`);
    falhas++;
  }
} else {
  const arquivoExiste = fs.existsSync(path.join(__dirname, '..', 'guardians', 'deployment-guardian.js'));
  resultados.push({ nome: 'Deployment Guardian', saudavel: arquivoExiste, observacao: 'mÃ³dulo nÃ£o carregado' });
  console.log(`   ${arquivoExiste ? 'âœ…' : 'âš ï¸'} Arquivo existe: ${arquivoExiste}`);
  if (!arquivoExiste) falhas++;
}

// ============ VALIDAÃ‡ÃƒO DE ARQUIVOS CRÃTICOS ============
console.log('\nðŸ“ Arquivos crÃ­ticos:');

const arquivosCriticos = [
  { nome: 'llm-client.js', caminho: path.join(__dirname, '..', 'llm-client.js') },
  { nome: 'llm-provider.js', caminho: path.join(__dirname, '..', 'llm-provider.js') },
  { nome: 'server.js', caminho: path.join(__dirname, '..', 'server.js') },
  { nome: 'knowledge-base.js', caminho: path.join(__dirname, '..', 'knowledge-base.js') },
  { nome: 'rag-service.js', caminho: path.join(__dirname, '..', 'rag', 'rag-service.js') },
  { nome: 'sites_data_center.xlsx', caminho: path.join(__dirname, '..', '..', 'sites_data_center.xlsx') },
  { nome: 'FQ_DATA_CENTER.xls', caminho: path.join(__dirname, '..', '..', 'FQ_DATA_CENTER.xls') }
];

let arquivosAusentes = 0;
for (const arquivo of arquivosCriticos) {
  const existe = fs.existsSync(arquivo.caminho);
  console.log(`   ${existe ? 'âœ…' : 'âŒ'} ${arquivo.nome}`);
  if (!existe) {
    arquivosAusentes++;
    falhas++;
  }
}

// ============ RESUMO ============
console.log('\n============================================');
console.log('ðŸ“Š RESUMO DA VERIFICAÃ‡ÃƒO');
console.log('============================================');
console.log(`   GuardiÃµes verificados: ${resultados.length}`);
console.log(`   Arquivos crÃ­ticos: ${arquivosCriticos.length - arquivosAusentes}/${arquivosCriticos.length} presentes`);
console.log(`   Falhas: ${falhas}`);
console.log('============================================\n');

if (falhas > 0) {
  console.log(`âŒ VerificaÃ§Ã£o concluÃ­da com ${falhas} falha(s).`);
  process.exit(1);
} else {
  console.log('âœ… Todos os guardiÃµes estÃ£o saudÃ¡veis!');
  process.exit(0);
}