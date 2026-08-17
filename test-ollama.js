/**
 * Teste rápido do Ollama via API de chat
 * Executa: node test-ollama.js
 */

const http = require('http');

function testarOllama() {
  const dados = JSON.stringify({
    model: 'phi3:mini',
    messages: [
      { role: 'system', content: 'Você é um assistente amigável chamado Charles. Responda em português do Brasil.' },
      { role: 'user', content: 'Bom dia! Tudo bem? Como você se chama?' }
    ],
    stream: false,
    options: {
      temperature: 0.7,
      max_tokens: 300
    }
  });

  const options = {
    hostname: 'localhost',
    port: 11434,
    path: '/api/chat',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(dados)
    }
  };

  console.log('⏳ Testando Ollama com phi3:mini...');
  console.log('   (pode levar até 60 segundos na primeira vez)\n');

  const inicio = Date.now();
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const tempo = ((Date.now() - inicio) / 1000).toFixed(1);
      try {
        const parsed = JSON.parse(data);
        if (parsed.message && parsed.message.content) {
          console.log(`✅ Ollama respondeu em ${tempo}s!\n`);
          console.log('📝 Resposta:');
          console.log('─'.repeat(50));
          console.log(parsed.message.content.trim());
          console.log('─'.repeat(50));
        } else {
          console.error('❌ Resposta inesperada:', JSON.stringify(parsed).substring(0, 200));
        }
      } catch (err) {
        console.error('❌ Erro ao parsear:', err.message);
        console.error('Raw:', data.substring(0, 200));
      }
    });
  });

  req.on('error', (err) => {
    console.error('❌ Erro de conexão:', err.message);
    console.error('   Certifique-se de que o Ollama está rodando!');
  });

  req.setTimeout(120000, () => {
    req.destroy();
    console.error('❌ Timeout de 120s excedido');
  });

  req.write(dados);
  req.end();
}

testarOllama();