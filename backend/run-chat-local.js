#!/usr/bin/env node
/**
 * run-chat-local.js
 * 
 * Script para rodar o chatbot localmente via terminal
 * SEM FALLBACKS - apenas FAQ + Especialistas + Groq
 */

const readline = require('readline');
const { processarPergunta } = require('./llm-client');
const { buscarNaFAQ } = require('./faq-search');
const { lerFAQ } = require('./faq-reader');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '\n👤 Você: '
});

const faq = lerFAQ();
console.log('\n' + '='.repeat(60));
console.log('🤖 CHARLES CHATBOT v3.1 - Chat Local (SEM FALLBACK)');
console.log('='.repeat(60));
console.log(`📚 FAQ: ${faq.length} perguntas carregadas`);
console.log(`🔧 Modo: Groq + FAQ + Especialistas (sem fallback)`);
console.log(`💡 Digite 'sair' para encerrar\n`);
console.log('='.repeat(60));

rl.prompt();

rl.on('line', async (line) => {
  const pergunta = line.trim();
  
  if (!pergunta) {
    rl.prompt();
    return;
  }
  
  if (pergunta.toLowerCase() === 'sair') {
    console.log('\n👋 Até logo!\n');
    process.exit(0);
  }
  
  try {
    console.log('\n⏳ Processando...\n');
    
    // Busca na FAQ
    const resultadosFAQ = buscarNaFAQ(pergunta, faq, 3);
    
    // Processa
    const resultado = await processarPergunta(pergunta, resultadosFAQ, 'terminal-user');
    
    // Exibe resultado
    console.log('─'.repeat(60));
    console.log(`🤖 Charles [${resultado.fonte}]:\n`);
    console.log(resultado.resposta);
    console.log('\n' + '─'.repeat(60));
    console.log(`📊 Qualidade: ${resultado.qualidade}% | Tipo: ${resultado.tipoResposta?.tipo || 'N/A'}`);
    console.log(`🎯 Agentes: ${resultado.routing?.agentsUsed?.join(', ') || 'N/A'}`);
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error('💡 Verifique sua chave API do Groq em .env\n');
  }
  
  rl.prompt();
});

rl.on('close', () => {
  console.log('\n👋 Até logo!\n');
  process.exit(0);
});
