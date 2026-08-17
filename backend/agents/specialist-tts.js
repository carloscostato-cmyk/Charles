class TTSSpecialist {
  constructor() {
    this.synthesis = window.speechSynthesis;
    this.voice = null;
    this.isSpeaking = false;
  }

  speak(text, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.synthesis) {
        reject(new Error('Web Speech Synthesis API não suportado'));
        return;
      }

      clearTimeout(this.timeoutId);
      this.synthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = options.rate || 1.0;
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume || 1.0;

      if (this.voice) utterance.voice = this.voice;

      utterance.onend = () => {
        this.isSpeaking = false;
        resolve({ success: true });
      };

      utterance.onerror = (e) => {
        this.isSpeaking = false;
        reject(new Error(`Erro TTS: ${e.error}`));
      };

      this.isSpeaking = true;
      this.synthesis.speak(utterance);
    });
  }

  selectVoice(voices, preferred = 'male') {
    if (!voices || voices.length === 0) return null;
    
    const maleVoices = voices.filter(v => v.lang.startsWith('pt') && /male|mister/i.test(v.name));
    if (maleVoices.length > 0) return maleVoices[0];
    
    return voices.find(v => v.lang.startsWith('pt')) || voices[0];
  }

  stop() {
    if (this.synthesis) {
      this.synthesis.cancel();
      this.isSpeaking = false;
    }
  }

  async speakWithFallback(text) {
    try {
      const result = await this.speak(text);
      return result;
    } catch (error) {
      console.error('[TTS] Erro ao falar:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { TTSSpecialist };