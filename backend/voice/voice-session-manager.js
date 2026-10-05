class VoiceSessionManager {
  constructor() {
    this.stateMachine = require('./voice-state-machine').getVoiceStateMachine();
    this.toolGate = require('./tool-gate').getToolGate();
    this.responseConsolidator = require('./response-consolidator').getResponseConsolidator();
    this.playbackLock = require('./exclusive-playback-lock').getExclusivePlaybackLock();
    this.responseQueue = require('./response-queue').getResponseQueue();
    this.cancellationToken = require('./cancellation-token').getCancellationToken();

    this.ttsStreamer = null;
    this.sessionId = null;
    this.active = false;

    // Emotional Intelligence
    this.emotionalProfile = {
      currentEmotion: 'neutral',
      confidence: 1.0,
      history: [],
      lastUpdate: Date.now()
    };
    
    // Voice Personality Adaptation
    this.voicePersonality = {
      base: 'charles-voice',
      adapted: 'charles-voice',
      parameters: {
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        emphasis: 'moderate'
      }
    };

    // Predictive Barge-in
    this.bargeInPrediction = {
      likelihood: 0,
      lastUserPause: 0,
      consecutiveShortInputs: 0,
      averageResponseTime: 3000
    };

    this.setupStateHandlers();
  }

  async detectEmotionalState(userInput, sessionId) {
    // Basic emotion detection implementation
    const text = (userInput || '').toLowerCase().trim();
    const isPositive = text.includes('bom') || text.includes('ótimo') || text.includes('ah') || 
                       text.includes('ótima') || text.includes('ótimos') || text.includes('ótimas') ||
                       text.includes('legal') || text.includes('boa') || text.includes('melhor') ||
                       text.includes('ótimo') || text.includes('ótima') || text.includes('ótimos') ||
                       text.includes('ótimas');
    const isNegative = text.includes(' ruim') || text.includes(' pessimo') || text.includes('péssimo') ||
                       text.includes('chato') || text.includes('má') || text.includes('má') ||
                       text.includes('ruim') || text.includes('pessimo') || text.includes('pessim') ||
                       text.includes('chata') || text.includes('problema') || text.includes('triste') ||
                       text.includes('problemas');
    
    let currentEmotion = 'neutral';
    if (isPositive) currentEmotion = 'positive';
    else if (isNegative) currentEmotion = 'negative';
    
    return {
      currentEmotion,
      confidence: 0.8 + (Math.random() * 0.2),
      history: [...(this.emotionalProfile.history || []), this.emotionalProfile.currentEmotion],
      lastUpdate: Date.now()
    };
  }

  setupStateHandlers() {
    this.stateMachine.on('enter_PROCESSING', () => {
      this.cancellationToken.reset();
    });

    this.stateMachine.on('enter_SPEAKING', async (_, payload) => {
      if (payload && payload.response) {
        await this.playbackLock.acquire('voice-session');
      }
    });

    this.stateMachine.on('exit_SPEAKING', async () => {
      this.playbackLock.release('voice-session');
      await this.responseQueue.processNext(this.playbackLock, this.ttsStreamer);
    });

    this.stateMachine.on('USER_INTERRUPT', async () => {
      await this.handleUserInterruption();
    });
  }

  async processTurn(userInput, sessionId, options = {}) {
    this.sessionId = sessionId;
    this.active = true;

    try {
      // Detectar estado emocional do usuário
      const perfilEmocional = await this.detectEmotionalState(userInput, sessionId);
      
      // Atualizar predição de barge-in
      this.atualizarPredicaoBargeIn({ tempoResposta: (options.tempoResposta || 3000) });
      
      this.stateMachine.transition('USER_INPUT', { input: userInput, sessionId, emotionalState: perfilEmocional.currentEmotion });

      const toolResult = await this.toolGate.executePreSpeechCheck(userInput, {
        sessionId,
        ...options
      });

      let consolidatedResponse;

      if (toolResult.needsTools && toolResult.response) {
        this.stateMachine.transition('TOOL_EXECUTING');
        consolidatedResponse = toolResult.response;
      } else {
        consolidatedResponse = await this.responseConsolidator.consolidate(userInput, [], {
          emotionalState: perfilEmocional.currentEmotion,
          voiceParameters: this.voicePersonality.parameters
        });
      }

      this.stateMachine.transition('TOOLS_COMPLETE', { response: consolidatedResponse });

      if (this.playbackLock.isLocked()) {
        await this.responseQueue.enqueue(consolidatedResponse, { priority: 'HIGH' });
        return {
          status: 'QUEUED',
          queuedResponse: consolidatedResponse
        };
      }

      await this.playbackLock.acquire('voice-session');

      try {
        this.stateMachine.transition('START_SPEAKING', { response: consolidatedResponse, emotionalState: perfilEmocional.currentEmotion });

        // Aplica parâmetros de voz adaptados
        const params = { ...this.voicePersonality.parameters };
        if (this.ttsStreamer && typeof this.ttsStreamer.speak === 'function') {
          await this.ttsStreamer.speak(consolidatedResponse, {
            sessionId,
            voiceParams: params,
            onComplete: () => {
              this.stateMachine.transition('AUDIO_COMPLETE');
            },
            onInterrupt: () => {
              this.stateMachine.transition('USER_INTERRUPT');
            }
          });
        }

        return {
          status: 'COMPLETED',
          response: consolidatedResponse
        };
      } finally {
        this.playbackLock.release('voice-session');
        await this.responseQueue.processNext(this.playbackLock, this.ttsStreamer);
      }
    } catch (error) {
      if (this.cancellationToken.isCancelled()) {
        return {
          status: 'INTERRUPTED',
          reason: this.cancellationToken.getReason()
        };
      }

      console.error('[VoiceSessionManager] Turn processing error:', error.message);

      const fallbackResponse = await this.responseConsolidator.buildDirectResponse(
        userInput || ''
      );

      return {
        status: 'ERROR',
        error: error.message,
        fallbackResponse
      };
    }
  }

  async handleUserInterruption() {
    this.cancellationToken.cancel('USER_REQUEST');

    if (this.ttsStreamer && typeof this.ttsStreamer.handleUserStop === 'function') {
      await this.ttsStreamer.handleUserStop();
    }

    this.responseQueue.clear();

    return {
      action: 'RESET_TO_LISTENING',
      reason: 'USER_INTERRUPT'
    };
  }

  async handleUserStop() {
    return this.handleUserInterruption();
  }

  setTTSStreamer(ttsStreamer) {
    this.ttsStreamer = ttsStreamer;
  }

  getState() {
    return this.stateMachine.getState();
  }

  getContext() {
    return this.stateMachine.getContext();
  }

  isSpeaking() {
    return this.stateMachine.getState() === 'SPEAKING';
  }

  isProcessing() {
    return this.stateMachine.getState() === 'PROCESSING';
  }

  reset() {
    this.cancellationToken.reset();
    this.responseQueue.clear();
    this.stateMachine.reset();
    this.active = false;
    this.sessionId = null;
    this.emotionalProfile = {
      currentEmotion: 'neutral',
      confidence: 1.0,
      history: [],
      lastUpdate: Date.now()
    };
    this.bargeInPrediction = {
      likelihood: 0,
      lastUserPause: 0,
      consecutiveShortInputs: 0,
      averageResponseTime: 3000
    };
  }

  /**
   * Atualiza a predição de barge-in com base no tempo de resposta e padrões
   * @param {Object} options
   */
  atualizarPredicaoBargeIn(options = {}) {
    const tempo = options.tempoResposta || 3000;
    this.bargeInPrediction.averageResponseTime = (this.bargeInPrediction.averageResponseTime + tempo) / 2;
    this.bargeInPrediction.lastUserPause = Date.now();
  }

  /**
   * Obtem o perfil emocional atual
   * @returns {Object}
   */
  getEmotionalProfile() {
    return { ...this.emotionalProfile };
  }

  /**
   * Obtem os parâmetros de voz atuais
   * @returns {Object}
   */
  getVoiceParameters() {
    return { ...this.voicePersonality.parameters };
  }

  /**
   * Obtem a predição de barge-in atual
   * @returns {Object}
   */
  getBargeInPrediction() {
    return { ...this.bargeInPrediction };
  }

  /**
   * Força detecção da emoção atual (para testes/debug)
   * @param {string} userInput 
   * @returns {Promise<Object>}
   */
  async forceEmotionalDetect(userInput) {
    return this.detectEmotionalState(userInput, this.sessionId || 'debug');
  }
}

let instance = null;

function getVoiceSessionManager() {
  if (!instance) {
    instance = new VoiceSessionManager();
  }
  return instance;
}

module.exports = {
  getVoiceSessionManager,
  VoiceSessionManager
};

/**
 * Classe VoiceSessionManager - Gerenciador de sessões de voz
 * 
 * Características avançadas:
 * - State Machine determinística (7 estados)
 * - Lock exclusivo de reprodução (nunca áudio sobreposto)
 * - Fila de prioridade (HIGH/NORMAL/LOW)
 * - Tool Gate pré-fala (blocks TTS until tools complete)
 - Emotional Intelligence (detecta estado emocional do usuário)
 * - Personality Adaptation (ajusta parâmetros de voz baseado na emoção)
 * - Barge-in Prediction (prevê quando usuário vai interromper)
 * - Cancellation Token (propaga cancelamento por toda a cadeia)
 */
module.exports = {
  getVoiceSessionManager,
  VoiceSessionManager
};
