const VoiceRecognition = require('./voice.js').VoiceRecognition;
const VoiceSynthesis = require('./voice.js').VoiceSynthesis;
const STTSpecialist = require('./specialist-stt').STTSpecialist;
const BackendOrchestrator = require('./specialist-orchestration').BackendOrchestrator;
const TTSSpecialist = require('./specialist-tts').TTSSpecialist;

class VoiceFlowOrchestrator {
  constructor() {
    this.stt = new STTSpecialist();
    this.llm = new LLMSpecialist();
    this.backend = new BackendOrchestrator();
    this.tts = new TTSSpecialist();
    this.voiceRecognition = new VoiceRecognition();
    this.voiceSynthesis = new VoiceSynthesis();
    
    this.setupVoiceRecognition();
  }

  setupVoiceRecognition() {
    this.voiceRecognition.onResult = (transcript) => {
      this.handleTranscription(transcript);
    };
    
    this.voiceRecognition.onEnd = () => {
      this.resetListeningState();
    };
    
    this.voiceRecognition.onError = (error) => {
      this.handleError(error);
    };
  }

  async handleTranscription(transcript) {
    console.log('[VoiceOrchestrator] Transcrição recebida:', transcript);
    
    try {
      const response = await this.backend.processVoiceText(transcript);
      console.log('[VoiceOrchestrator] Resposta:', response);
      
      await this.speakResponse(response);
    } catch (error) {
      console.error('[VoiceOrchestrator] Erro no processamento:', error);
      await this.speakError();
    }
  }

  async speakResponse(response) {
    const texto = response.resposta || 'Desculpe, não respondi corretamente.';
    await this.tts.speakWithFallback(texto);
  }

  async speakError() {
    await this.tts.speakWithFallback('Ocorreu um erro ao processar sua solicitação.');
  }

  handleError(error) {
    console.error('[VoiceOrchestrator] Erro no reconhecimento de voz:', error);
  }

  resetListeningState() {
    if (this.voiceScreen) {
      this.voiceScreen.querySelector('.listening').classList.remove('listening');
    }
  }

  startListening() {
    this.voiceRecognition.iniciar();
  }
}

module.exports = { VoiceFlowOrchestrator, VoiceRecognition, VoiceSynthesis };