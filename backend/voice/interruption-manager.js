class InterruptionManager {
  constructor() {
    this.userStopCommands = ['pare', 'stop', 'cancela', 'silêncio', 'silencio', 'cancelar', 'parar'];
    this.currentPriority = 0;
    this.playbackLock = require('./exclusive-playback-lock').getExclusivePlaybackLock();
    this.responseQueue = require('./response-queue').getResponseQueue();
    this.ttsStreamer = require('./safe-tts-streamer').getSafeTTSStreamer();
  }

  isUserStopCommand(text) {
    const lower = String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    return this.userStopCommands.some(cmd => lower.includes(cmd));
  }

  canInterrupt(currentPriority, interruptType) {
    if (interruptType === 'SYSTEM') {
      return false;
    }

    if (interruptType === 'USER_VOICE') {
      return currentPriority <= 1;
    }

    if (interruptType === 'USER_STOP') {
      return true;
    }

    return false;
  }

  async handleUserStop(sessionId = 'default') {
    const result = await this.ttsStreamer.handleUserStop();
    this.responseQueue.clear();

    return {
      ...result,
      sessionId
    };
  }
}

module.exports = { InterruptionManager };
