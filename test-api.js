/**
 * Script de teste rápido da API do Chatbot Charles
 * Execute: node test-api.js
 */

const http = require('http');

function testarAPI() {
  console.log('=== Teste da API do Chatbot Charles ===\n');
  
  // Teste 1: Status
  console.log('1️⃣  Testando GET /api/status...');
  http.get('http://localhost:3000/api/status', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const status = JSON.parse(data);
      console.log(`   ✅ Servidor: ${status.servidor}`);
      console.log(`   ✅ FAQ: ${status.faq.total} perguntas`);
      console.log(`   ✅ Ollama: ${status.ollama.disponivel ? 'Disponível' : 'Indisponível'}`);
      
      // Teste 2: Chat
      console.log('\n2️⃣  Testando POST /api/chat...');
      const pergunta = JSON.stringify({ mensagem: 'Qual o horário de funcionamento?' });
      
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(pergunta)
        }
      };
      
      const req = http.request(options, (res2) => {
        let data2 = '';
        res2.on('data', chunk => data2 += chunk);
        res2.on('end', () => {
          const resposta = JSON.parse(data2);
          console.log(`   ✅ Pergunta: "${resposta.pergunta.substring(0, 50)}..."`);
          console.log(`   ✅ Resposta: "${resposta.resposta.substring(0, 80)}..."`);
          console.log(`   ✅ Fonte: ${resposta.fonte}`);
          console.log(`   ✅ Sugestões: ${resposta.sugestoes.length}`);
          
          // Teste 3: Sugestões
          console.log('\n3️⃣  Testando GET /api/sugestoes...');
          http.get('http://localhost:3000/api/sugestoes?q=3', (res3) => {
            let data3 = '';
            res3.on('data', chunk => data3 += chunk);
            res3.on('end', () => {
              const sugestoes = JSON.parse(data3);
              console.log(`   ✅ ${sugestoes.total} sugestões carregadas`);
              sugestoes.sugestoes.forEach((s, i) => console.log(`      ${i+1}. ${s.substring(0, 60)}...`));
              
              console.log('\n🎉 Todos os testes passaram!');
              console.log('📱 Abra http://localhost:3000 no navegador para usar o chatbot\n');
            });
          }).end();
        });
      });
      
      req.write(pergunta);
      req.end();
    });
  }).on('error', (err) => {
    console.error('❌ Erro: Servidor não está rodando!');
    console.error('   Execute: node backend/server.js');
  });
}

testarAPI();