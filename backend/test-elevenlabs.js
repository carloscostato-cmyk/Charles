require('dotenv').config({ path: '../.env' });

if (process.env.ALLOW_INSECURE_TLS === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const { synthesize } = require('./tts/neural-tts-service.js');

async function test() {
  try {
    console.log('Iniciando teste direto na API da ElevenLabs com TLS proxy bypass...');
    const result = await synthesize('Olá, executivo. Este é um teste de voz em alta definição.', { sentimento: { estilo: 'neutro' } });
    
    if (result.provider === 'elevenlabs' && result.audioBase64) {
       console.log('SUCESSO_ELEVENLABS');
       console.log('Tamanho: ' + result.audioBase64.length);
    } else {
       console.log('FALHA_FALLBACK');
       console.log(JSON.stringify(result, null, 2));
    }
  } catch (err) {
    console.error('ERRO_CRITICO:', err.message);
  }
}
test();
