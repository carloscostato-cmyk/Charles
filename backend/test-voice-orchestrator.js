/**
 * test-voice-orchestrator.js
 * Teste do Voice Orchestrator com SSML e prosódia avançada
 */

const { getVoiceOrchestrator } = require('./agents/voice-orchestrator');
const { diagnosticar } = require('./agents/tts-specialist');

console.log('=== TESTE VOICE ORCHESTRATOR v2.0 ===\n');

// Teste 1: Diagnóstico TTS Specialist
console.log('1. Diagnóstico TTS Specialist:');
const diagTTS = diagnosticar();
console.log(JSON.stringify(diagTTS, null, 2));

// Teste 2: Diagnóstico Voice Orchestrator
console.log('\n2. Diagnóstico Voice Orchestrator:');
const voiceOrchestrator = getVoiceOrchestrator();
const diagVO = voiceOrchestrator.diagnosticar();
console.log(JSON.stringify(diagVO, null, 2));

// Teste 3: Processamento de resposta com contexto neutro
console.log('\n3. Processamento - Contexto Neutro:');
const testeNeutro = voiceOrchestrator.processarRespostaComVoz(
  'O procedimento de backup é realizado diariamente às 23h.',
  'Como funciona o backup?',
  { fonte: 'faq' }
);
console.log('Resposta:', testeNeutro.resposta);
console.log('Sentimento:', testeNeutro.sentimento);
console.log('Intenção:', testeNeutro.intencao);
console.log('Parâmetros Voz:', testeNeutro.parametrosVoz);
console.log('SSML (primeiros 200 chars):', testeNeutro.ssml.substring(0, 200) + '...');

// Teste 4: Processamento com urgência
console.log('\n4. Processamento - Contexto Urgente:');
const testeUrgente = voiceOrchestrator.processarRespostaComVoz(
  'Reinicie o servidor imediatamente. Isso é crítico.',
  'O servidor caiu, preciso resolver agora!',
  { fonte: 'faq' }
);
console.log('Resposta:', testeUrgente.resposta);
console.log('Sentimento:', testeUrgente.sentimento);
console.log('Intenção:', testeUrgente.intencao);
console.log('Parâmetros Voz:', testeUrgente.parametrosVoz);
console.log('SSML (primeiros 200 chars):', testeUrgente.ssml.substring(0, 200) + '...');

// Teste 5: Processamento com explicação
console.log('\n5. Processamento - Contexto Explicação:');
const testeExplicacao = voiceOrchestrator.processarRespostaComVoz(
  'Primeiro, verifique o status do serviço. Segundo, reinicie se necessário. Finalmente, monitore os logs.',
  'Explique como resolver o problema passo a passo',
  { fonte: 'faq' }
);
console.log('Resposta:', testeExplicacao.resposta);
console.log('Sentimento:', testeExplicacao.sentimento);
console.log('Intenção:', testeExplicacao.intencao);
console.log('Parâmetros Voz:', testeExplicacao.parametrosVoz);
console.log('SSML (primeiros 200 chars):', testeExplicacao.ssml.substring(0, 200) + '...');

// Teste 6: SSML Completo
console.log('\n6. SSML Completo (teste neutro):');
console.log(testeNeutro.ssmlCompleto);

console.log('\n=== TESTE CONCLUÍDO ===');
