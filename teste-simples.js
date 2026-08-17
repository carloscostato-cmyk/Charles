const http = require('http');

const dados = JSON.stringify({ mensagem: 'oi' });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(dados)
  }
};

console.log('⏳ Enviando "oi" para o chat...');
const inicio = Date.now();

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const tempo = ((Date.now() - inicio) / 1000).toFixed(1);
    console.log(`✅ Resposta em ${tempo}s`);
    try {
      const parsed = JSON.parse(data);
      console.log('📝 Resposta:', JSON.stringify(parsed, null, 2));
    } catch (err) {
      console.log('Raw:', data);
    }
  });
});

req.on('error', (err) => console.error('❌', err.message));
req.setTimeout(120000, () => { req.destroy(); console.error('❌ Timeout'); });
req.write(dados);
req.end();