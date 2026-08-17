const { processarPergunta } = require('./llm-client');

async function test() {
  console.log('=== TESTING CURRENT SYSTEM ===\n');
  
  const queries = [
    'qual o endereço do data center de São Paulo?',
    'qual é o papel do inventário na operação do data center?',
    'me passa o telefone do data center do Rio de Janeiro'
  ];
  
  for (const q of queries) {
    console.log(`🔍 Query: "${q}"`);
    try {
      const result = await processarPergunta(q, []);
      console.log(`✅ Fonte: ${result.fonte}`);
      console.log(`📝 Resposta: ${result.resposta.substring(0, 200)}...`);
      console.log(`🎯 Tipo: ${result.tipoResposta?.tipo}\n`);
    } catch (err) {
      console.log(`❌ Erro: ${err.message}\n`);
    }
  }
}

test().catch(console.error);