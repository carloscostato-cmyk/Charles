/**
 * neural-tts-service.js
 *
 * Camada de TTS neural multi-provider para o Charles Voice AI v3.0.
 * Providers (em ordem de prioridade):
 *  1. ElevenLabs (ELEVENLABS_API_KEY)
 *  2. OpenAI TTS (OPENAI_API_KEY)
 *  3. Azure Speech (AZURE_SPEECH_KEY + AZURE_SPEECH_REGION)
 *  4. Fallback: null → cliente usa Web Speech com cues SSML
 */

const https = require('https');
const http = require('http');

const PROVIDER_PRIORITY = ['elevenlabs', 'openai', 'azure'];

function getAvailableProviders() {
  const available = [];
  if (process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY.length > 5) available.push('elevenlabs');
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 5) available.push('openai');
  if (process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_KEY.length > 5) available.push('azure');
  return available;
}

function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, buffer, headers: res.headers });
        } else {
          reject(new Error(`TTS HTTP ${res.statusCode}: ${buffer.toString('utf8').slice(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error('TTS timeout'));
    });
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Mapeia sentimento → estilo do provider
 */
function mapEmotionStyle(sentimento = {}) {
  const s = (sentimento.sentimento || sentimento.label || 'neutro').toLowerCase();
  const map = {
    urgente: { style: 'excited', stability: 0.35, similarity: 0.75 },
    animado: { style: 'cheerful', stability: 0.4, similarity: 0.7 },
    positivo: { style: 'friendly', stability: 0.5, similarity: 0.75 },
    frustrado: { style: 'empathetic', stability: 0.65, similarity: 0.8 },
    confuso: { style: 'calm', stability: 0.7, similarity: 0.8 },
    neutro: { style: 'professional', stability: 0.55, similarity: 0.75 }
  };
  return map[s] || map.neutro;
}

async function synthesizeElevenLabs(texto, contexto = {}) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Adam default
  const emotion = mapEmotionStyle(contexto.sentimento);

  const body = JSON.stringify({
    text: texto,
    model_id: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
    voice_settings: {
      stability: emotion.stability,
      similarity_boost: emotion.similarity,
      style: 0.35,
      use_speaker_boost: true
    }
  });

  const result = await httpRequest(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg'
      }
    },
    body
  );

  return {
    provider: 'elevenlabs',
    mimeType: 'audio/mpeg',
    audioBase64: result.buffer.toString('base64'),
    emotion: emotion.style
  };
}

async function synthesizeOpenAI(texto, contexto = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  const voice = process.env.OPENAI_TTS_VOICE || 'onyx'; // masculina
  const model = process.env.OPENAI_TTS_MODEL || 'tts-1-hd';

  // OpenAI TTS não tem emotion nativo; ajustamos via instruções no texto limpo
  const body = JSON.stringify({
    model,
    input: texto.slice(0, 4000),
    voice,
    response_format: 'mp3',
    speed: Math.min(1.25, Math.max(0.75, Number(contexto.parametrosVoz?.rate) || 1.0))
  });

  const result = await httpRequest(
    'https://api.openai.com/v1/audio/speech',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    },
    body
  );

  return {
    provider: 'openai',
    mimeType: 'audio/mpeg',
    audioBase64: result.buffer.toString('base64'),
    emotion: mapEmotionStyle(contexto.sentimento).style
  };
}

async function synthesizeAzure(texto, contexto = {}) {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  const voiceName = process.env.AZURE_SPEECH_VOICE || 'pt-BR-AntonioNeural';
  const emotion = mapEmotionStyle(contexto.sentimento);
  const rate = contexto.parametrosVoz?.rate || 1.0;
  const pitch = contexto.parametrosVoz?.pitch || 1.0;

  const ratePct = `${Math.round((rate - 1) * 100)}%`;
  const pitchPct = `${Math.round((pitch - 1) * 100)}%`;

  const ssml = `
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"
       xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="pt-BR">
  <voice name="${voiceName}">
    <mstts:express-as style="${emotion.style === 'professional' ? 'calm' : emotion.style === 'excited' ? 'excited' : 'friendly'}">
      <prosody rate="${ratePct}" pitch="${pitchPct}">
        ${escapeXml(texto)}
      </prosody>
    </mstts:express-as>
  </voice>
</speak>`.trim();

  const result = await httpRequest(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'Charles-VoiceAI/3.0'
      }
    },
    ssml
  );

  return {
    provider: 'azure',
    mimeType: 'audio/mpeg',
    audioBase64: result.buffer.toString('base64'),
    emotion: emotion.style
  };
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Sintetiza áudio neural. Retorna null se nenhum provider disponível/funcionou.
 */
async function synthesize(texto, contexto = {}) {
  if (!texto || !String(texto).trim()) {
    throw new Error('Texto vazio para TTS');
  }

  const preferred = (process.env.TTS_PROVIDER || '').toLowerCase();
  const available = getAvailableProviders();
  const order = preferred && available.includes(preferred)
    ? [preferred, ...available.filter((p) => p !== preferred)]
    : available;

  if (order.length === 0) {
    return {
      provider: 'webspeech-fallback',
      mimeType: null,
      audioBase64: null,
      fallback: true,
      reason: 'Nenhum provider neural configurado (ELEVENLABS_API_KEY / OPENAI_API_KEY / AZURE_SPEECH_KEY)'
    };
  }

  const errors = [];
  for (const provider of order) {
    try {
      if (provider === 'elevenlabs') return await synthesizeElevenLabs(texto, contexto);
      if (provider === 'openai') return await synthesizeOpenAI(texto, contexto);
      if (provider === 'azure') return await synthesizeAzure(texto, contexto);
    } catch (err) {
      console.warn(`[NeuralTTS] ${provider} falhou: ${err.message}`);
      errors.push({ provider, error: err.message });
    }
  }

  return {
    provider: 'webspeech-fallback',
    mimeType: null,
    audioBase64: null,
    fallback: true,
    reason: 'Todos os providers neurais falharam',
    errors
  };
}

function getStatus() {
  const available = getAvailableProviders();
  return {
    versao: '3.0',
    neuralDisponivel: available.length > 0,
    providersDisponiveis: available,
    providerPreferido: process.env.TTS_PROVIDER || available[0] || 'webspeech-fallback',
    fallback: 'webspeech-ssml-cues'
  };
}

module.exports = {
  synthesize,
  getStatus,
  getAvailableProviders,
  mapEmotionStyle
};
