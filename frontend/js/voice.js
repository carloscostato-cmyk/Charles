/**
 * voice.js
 * 
 * Assistente de voz para o Chatbot Charles.
 * 
 * Utiliza a Web Speech API nativa do navegador (gratuita, sem chaves de API).
 * 
 * Funcionalidades:
 * - Reconhecimento de fala (Speech-to-Text)
 * - Síntese de fala (Text-to-Speech) com voz masculina jovem e natural
 * - Fallback para navegadores sem suporte
 * - **Nova funcionalidade: Sincronização labial (lip-sync)**
 * 
 * ============ VERIFICAÇÃO DE SUPORTO ============
 */

const voiceSupport = {
  speechRecognition: 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window,
  speechSynthesis: 'speechSynthesis' in window
};

// ============ RECONHECIMENTO DE FALA (STT) ============

/**
 * Classe para gerenciar reconhecimento de voz
 */
class VoiceRecognition {
  constructor() {
    this.recognizer = null;
    this.ouvindo = false;
    this.onResult = null;
    this.onEnd = null;
    this.onError = null;

    if (!voiceSupport.speechRecognition) {
      console.warn('[Voice] Reconhecimento de voz não suportado neste navegador');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognizer = new SpeechRecognition();
    this.recognizer.lang = 'pt-BR';
    this.recognizer.continuous = false;
    this.recognizer.interimResults = true;
    this.recognizer.maxAlternatives = 1;

    // Configura callbacks
    this.recognizer.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');

      if (event.results[0].isFinal && this.onResult) {
        this.onResult(transcript);
      }
    };

    this.recognizer.onend = () => {
      this.ouvindo = false;
      if (this.onEnd) this.onEnd();
    };

    this.recognizer.onerror = (event) => {
      this.ouvindo = false;
      let mensagem = 'Erro ao capturar áudio';
      
      switch (event.error) {
        case 'no-speech':
          mensagem = 'Nenhuma fala detectada. Tente novamente.';
          break;
        case 'aborted':
          mensagem = 'Captura de voz interrompida.';
          break;
        case 'audio-capture':
          mensagem = 'Microfone não encontrado. Verifique as permissões.';
          break;
        case 'not-allowed':
          mensagem = 'Permissão do microfone negada. Permita o acesso nas configurações.';
          break;
        case 'network':
          mensagem = 'Erro de rede no reconhecimento de voz.';
          break;
      }

      if (this.onError) this.onError(mensagem);
    };
  }

  /**
   * Inicia escuta do microfone
   */
  iniciar() {
    if (!this.recognizer) {
      if (this.onError) this.onError('Reconhecimento de voz não suportado');
      return;
    }

    if (this.ouvindo) return;
    
    try {
      this.ouvindo = true;
      this.recognizer.start();
    } catch (err) {
      this.ouvindo = false;
      if (this.onError) this.onError('Erro ao iniciar captura de voz');
    }
  }

  /**
   * Para a escuta
   */
  parar() {
    if (this.recognizer && this.ouvindo) {
      this.recognizer.stop();
      this.ouvindo = false;
    }
  }

  /**
   * Verifica se está ouvindo
   */
  estaOuvindo() {
    return this.ouvindo;
  }
}

// ============ SÍNTESE DE FALA (TTS) ============

/**
 * Classe para gerenciar síntese de fala
 * Prioriza vozes masculinas jovens e naturais em português brasileiro
 * Garante que SEMPRE haja uma voz selecionada
 */
class VoiceSynthesis {
  constructor() {
    this.audioElement = null;
    this.falando = false;
    this.falaId = 0;
    this.onStart = null;
    this.onEnd = null;
  }

  falar(texto) {
    if (!texto || texto.trim() === '') {
      console.warn('[Voice] Texto vazio, nada para falar');
      return;
    }
    
    this.parar();

    const idFala = ++this.falaId;
    this.falando = true;
    
    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: texto })
    })
    .then(res => res.json())
    .then(data => {
      if (idFala !== this.falaId) return;
      
      if (data.sucesso && data.audioBase64) {
        const binaryString = window.atob(data.audioBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: data.mimeType || 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(blob);
        
        this.audioElement = new Audio(audioUrl);
        
        this.audioElement.addEventListener('play', () => {
          if (this.onStart) this.onStart();
          const startEvent = new CustomEvent('tts:start', { detail: { id: idFala, text: texto } });
          window.dispatchEvent(startEvent);
        });
        
        this.audioElement.addEventListener('ended', () => {
          this.finalizarFala(idFala);
          URL.revokeObjectURL(audioUrl);
          const endEvent = new CustomEvent('tts:end', { detail: { id: idFala } });
          window.dispatchEvent(endEvent);
        });
        
        this.audioElement.addEventListener('error', (e) => {
          this.finalizarFala(idFala);
          URL.revokeObjectURL(audioUrl);
          const errorEvent = new CustomEvent('tts:error', { detail: { id: idFala, error: e } });
          window.dispatchEvent(errorEvent);
        });
        
        this.audioElement.play().catch(e => {
            console.error('[Voice] Erro ao tocar audio:', e);
            this.finalizarFala(idFala);
        });
      } else {
        console.warn('[Voice] Falha no TTS Neural, resposta inválida', data);
        this.finalizarFala(idFala);
        window.dispatchEvent(new CustomEvent('tts:end', { detail: { id: idFala } }));
      }
    })
    .catch(e => {
      console.error('[Voice] Erro na request TTS:', e);
      if (idFala !== this.falaId) return;
      this.finalizarFala(idFala);
      window.dispatchEvent(new CustomEvent('tts:error', { detail: { id: idFala, error: e } }));
    });
  }

  parar() {
    this.falaId += 1;
    if (this.audioElement) {
        this.audioElement.pause();
        this.audioElement = null;
    }
    this.falando = false;
    window.dispatchEvent(new CustomEvent('tts:stop', { detail: { id: this.falaId } }));
  }

  finalizarFala(idFala) {
    if (idFala !== this.falaId) return;
    this.audioElement = null;
    this.falando = false;
    if (this.onEnd) this.onEnd();
  }

  estaFalando() {
    return this.falando || (this.audioElement && !this.audioElement.paused);
  }
}

// ============ EXPORTAÇÃO ============

// Cria instâncias globais
const voiceRecognition = new VoiceRecognition();
const voiceSynthesis = new VoiceSynthesis();
