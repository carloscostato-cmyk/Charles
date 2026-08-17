class SafeTTSStreamer {
  constructor() {
    this.buffer = require('./circular-audio-buffer').CircularAudioBuffer;
    this.playbackLock = require('./exclusive-playback-lock').getExclusivePlaybackLock();
    this.cancellationToken = require('./cancellation-token').getCancellationToken();
    this.responseQueue = require('./response-queue').getResponseQueue();

    this.currentSession = null;
    this.userInterrupted = false;
  }

  async speak(response, options = {}) {
    const sessionId = options.sessionId || 'default';

    if (!response || !response.readyForTTS) {
      throw new Error('RESPONSE_NOT_CONSOLIDATED');
    }

    await this.playbackLock.acquire(`tts-${sessionId}`);

    try {
      const session = new AudioPlaybackSession({
        buffer: new this.buffer(65536),
        text: response.text,
        sessionId,
        onComplete: () => {
          this.playbackLock.release(`tts-${sessionId}`);
          if (options.onComplete) options.onComplete();
        },
        onInterrupt: () => {
          if (options.onInterrupt) options.onInterrupt();
        }
      });

      this.currentSession = session;

      if (response.ttsUrl) {
        await session.streamFromUrl(response.ttsUrl, this.cancellationToken);
      } else if (response.ssml || response.text) {
        // Aplica parâmetros de voz do voice specialist
        const voiceParams = options.voiceParams || {};
        const rate = voiceParams.rate !== undefined ? voiceParams.rate : 1.0;
        const pitch = voiceParams.pitch !== undefined ? voiceParams.pitch : 1.0;
        
        // Ajusta a velocidade para voz mais jovem (rate > 1 = mais rápido/mais jovem)
        const adjustedText = this.applyVoiceRate(response.text, rate, pitch);
        await session.streamFromText(adjustedText, this.cancellationToken);
      }

      await session.waitForCompletion();
      return session.getStats();
    } finally {
      if (this.currentSession === session) {
        this.currentSession = null;
      }
      this.playbackLock.release(`tts-${sessionId}`);
    }
  }

  async handleUserStop() {
    this.userInterrupted = true;
    this.cancellationToken.cancel('USER_REQUEST');

    if (this.currentSession) {
      await this.currentSession.stop();
      this.currentSession = null;
    }

    this.responseQueue.clear();

    return { action: 'RESET_TO_LISTENING', reason: 'USER_INTERRUPT' };
  }

  isSpeaking() {
    return this.currentSession !== null && this.currentSession.isPlaying;
  }

  getStats() {
    if (!this.currentSession) return null;
    return this.currentSession.getStats();
  }
}

class AudioPlaybackSession {
  constructor(options = {}) {
    this.buffer = options.buffer;
    this.text = options.text;
    this.sessionId = options.sessionId;
    this.onComplete = options.onComplete || (() => {});
    this.onInterrupt = options.onInterrupt || (() => {});

    this.stopped = false;
    this.completed = false;
    this.chunksPlayed = 0;
    this.bytesStreamed = 0;
    this.startTime = Date.now();
  }

  async streamFromUrl(url, cancellationToken) {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`TTS stream failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      if (cancellationToken.isCancelled()) {
        break;
      }

      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      this.bytesStreamed += value.length;
      this.buffer.write(value);
      this.chunksPlayed++;

      if (this.buffer.getAvailable() > 4096) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  }

  async streamFromText(text, cancellationToken) {
    if (!text) return;

    const chunks = this.chunkText(text, 50);
    let totalChars = 0;

    for (const chunk of chunks) {
      if (cancellationToken.isCancelled()) {
        break;
      }

      const bytes = new TextEncoder().encode(chunk);
      this.buffer.write(bytes);
      this.chunksPlayed++;
      totalChars += chunk.length;

      await new Promise(resolve => setTimeout(resolve, 30));
    }

    this.bytesStreamed = totalChars;
  }

  chunkText(text, chunkSize) {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Aplica parâmetros de voz para ajuste de timing
   * @param {string} text - Texto original
   * @param {number} rate - Taxa de fala (1.0 = normal, >1 = mais rápido/mais jovem)
   * @param {number} pitch - Altura da voz
   * @returns {string} - Texto ajustado
   */
  applyVoiceRate(text, rate, pitch) {
    // Marca rate e pitch para o motor de síntese reconhecer via SSML ou flags
    // Para Web Speech API compatibilidade
    const adjustedRate = rate > 0 ? rate : 1.0;
    const adjustedPitch = pitch > 0 ? pitch : 1.0;
    
    // Retorna texto com metadados de taxa e altura para o motor de áudio
    // O motor de áudio aplicará esses parâmetros durante a reprodução
    return {
      original: text,
      rate: adjustedRate,
      pitch: adjustedPitch
    };
  }

  async waitForCompletion() {
    const start = Date.now();
    const maxWait = 60000;

    while (!this.completed && !this.stopped) {
      if (Date.now() - start > maxWait) {
        throw new Error('TTS_PLAYBACK_TIMEOUT');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return this.getStats();
  }

  async stop() {
    this.stopped = true;
    this.completed = true;
    this.buffer.clear();
    this.onInterrupt();
  }

  isStopped() {
    return this.stopped;
  }

  isPlaying() {
    return !this.stopped && !this.completed;
  }

  getStats() {
    return {
      sessionId: this.sessionId,
      chunksPlayed: this.chunksPlayed,
      bytesStreamed: this.bytesStreamed,
      durationMs: Date.now() - this.startTime,
      stopped: this.stopped,
      completed: this.completed
    };
  }
}

let instance = null;

function getSafeTTSStreamer() {
  if (!instance) {
    instance = new SafeTTSStreamer();
  }
  return instance;
}

module.exports = {
  getSafeTTSStreamer,
  SafeTTSStreamer,
  AudioPlaybackSession
};
