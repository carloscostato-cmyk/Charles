class STTSpecialist {
  constructor() {
    this.provider = 'web-speech-api';
    this.lang = 'pt-BR';
    this.continuous = false;
    this.interimResults = true;
  }

  async transcribe(audioBuffer) {
    return new Promise((resolve, reject) => {
      if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
        reject(new Error('Web Speech API não suportado'));
        return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognizer = new SpeechRecognition();
      
      recognizer.lang = this.lang;
      recognizer.continuous = this.continuous;
      recognizer.interimResults = this.interimResults;
      
      let transcript = '';
      let confidence = 0;
      
      recognizer.onresult = (event) => {
        const result = event.results[event.results.length - 1];
        if (result.isFinal) {
          transcript = result[0].transcript.trim();
          confidence = result[0].confidence || 1;
        }
      };

      recognizer.onerror = (event) => {
        reject(new Error(`Erro STT: ${event.error}`));
      };

      recognizer.onend = () => {
        if (transcript) {
          resolve({ transcript, confidence });
        } else {
          reject(new Error('Nenhuma transcrição obtida'));
        }
      };

      try {
        recognizer.start();
      } catch (err) {
        reject(err);
      }
    });
  }

  async webSpeechToText(text) {
    if (typeof text !== 'string') {
      throw new Error('Texto inválido para transcrição');
    }
    return text;
  }

  getDefaultConfig() {
    return {
      lang: 'pt-BR',
      continuous: false,
      interimResults: true,
      maxAlternatives: 1,
      timeout: 15000
    };
  }
}

module.exports = { STTSpecialist };