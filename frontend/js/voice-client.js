class VoiceClient {
  constructor() {
    this.audioContext = null;
    this.currentSource = null;
    this.isPlaying = false;
    this.bufferQueue = [];
    this.playbackLock = false;
    this.sessionId = 'default';
  }

  async init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  async playTTS(ttsUrl) {
    await this.init();

    if (this.playbackLock) {
      await this.enqueueResponse(ttsUrl);
      return { status: 'QUEUED' };
    }

    this.playbackLock = true;

    try {
      const response = await fetch(ttsUrl);
      if (!response.ok) throw new Error(`TTS fetch failed: ${response.status}`);

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));

      await this.playBuffer(audioBuffer);

      return { status: 'COMPLETED' };
    } catch (error) {
      console.error('[VoiceClient] Playback error:', error.message);
      return { status: 'ERROR', error: error.message };
    } finally {
      this.playbackLock = false;
      await this.playNextQueued();
    }
  }

  async playBuffer(audioBuffer) {
    this.isPlaying = true;

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    source.onended = () => {
      this.isPlaying = false;
    };

    this.currentSource = source;
    source.start(0);
  }

  async enqueueResponse(ttsUrl) {
    return new Promise((resolve) => {
      this.bufferQueue.push(ttsUrl);
      resolve({ status: 'QUEUED', queueSize: this.bufferQueue.length });
    });
  }

  async playNextQueued() {
    if (this.bufferQueue.length === 0) return;

    const next = this.bufferQueue.shift();
    await this.playTTS(next);
  }

  async handleUserStop() {
    if (this.currentSource && this.isPlaying) {
      try {
        this.currentSource.stop();
      } catch (error) {
        // already stopped
      }
      this.currentSource = null;
    }

    this.isPlaying = false;
    this.bufferQueue = [];

    if (this.audioContext && this.audioContext.state === 'running') {
      await this.audioContext.suspend();
    }

    return { action: 'STOPPED' };
  }

  getStatus() {
    return {
      isPlaying: this.isPlaying,
      playbackLock: this.playbackLock,
      queueSize: this.bufferQueue.length
    };
  }

  destroy() {
    this.handleUserStop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

window.VoiceClient = VoiceClient;
