/**
 * test-modules.js
 * Script de teste para verificar se todos os modulos carregam corretamente.
 */

console.log('=== Teste de Carregamento de Modulos ===\n');

const modules = [
  { name: 'RAG Service', path: './rag/rag-service' },
  { name: 'Tool Registry', path: './tools/tool-registry' },
  { name: 'Memory Manager', path: './memory/memory-manager' },
  { name: 'Router Agent', path: './agents/router-agent' },
  { name: 'Tracer', path: './observability/tracer' },
  { name: 'SSE Handler', path: './streaming/sse-handler' },
  { name: 'File Processor', path: './multimodal/file-processor' },
  { name: 'Metrics Collector', path: './observability/metrics' },
  { name: 'LLM Provider', path: './llm-provider' },
  { name: 'LLM Client', path: './llm-client' },
  { name: 'Orchestrator', path: './agents/orchestrator' },
  { name: 'FAQ Specialist', path: './agents/faq-specialist' },
  { name: 'Humanizer', path: './agents/humanizer' },
  { name: 'Context Memory', path: './agents/context-memory' },
  { name: 'Response Quality', path: './agents/response-quality' },
  { name: 'Knowledge Gap', path: './agents/knowledge-gap' },
  { name: 'Knowledge Guardian', path: './guardians/knowledge-guardian' },
  { name: 'Code Guardian', path: './guardians/code-guardian' },
  { name: 'System Guardian', path: './guardians/system-guardian' }
];

let success = 0;
let failed = 0;

for (const mod of modules) {
  try {
    require(mod.path);
    console.log('  OK ' + mod.name);
    success++;
  } catch (e) {
    console.log('  FAIL ' + mod.name + ': ' + e.message);
    failed++;
  }
}

console.log('\n=== Resultado: ' + success + ' OK, ' + failed + ' Falhas ===');

if (failed === 0) {
  console.log('\nTodos os modulos carregaram com sucesso!');
  process.exit(0);
} else {
  console.log('\nAlguns modulos falharam ao carregar.');
  process.exit(1);
}