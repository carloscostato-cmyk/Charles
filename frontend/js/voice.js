/**
 * voice.js
 * 
 * Assistente de voz resiliente para o Chatbot Charles (v4.3).
 * 
 * Arquitetura Dual-Engine:
 * 1. TTS Neural (ElevenLabs / OpenAI / Azure) via backend `/api/tts` quando configurado.
 * 2. Fallback Inteligente Nativo via Web Speech API do navegador (100% gratuito e offline).
 * 
 * Funcionalidades:
 * - Reconhecimento de fala contínuo/pontual (Speech-to-Text) com tratamento de permissões.
 * - Síntese de fala adaptativa com seleção refinada de voz pt-BR e prosódia humana.
 * - Sanitização completa de Markdown e caracteres especiais antes da fala.
 * - Sincronização labial (lip-sync) e eventos de onda sonora (`tts:start`, `tts:end`, `tts:stop`).
 * - Desbloqueio de áudio (AudioContext & Web Speech unlock) contra restrições de autoplay.
 */

// ============ VERIFICAÇÃO DE SUPORTE ============
const voiceSupport = {
  speechRecognition: 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window,
  speechSynthesis: 'speechSynthesis' in window,
  audioContext: 'AudioContext' in window || 'webkitAudioContext' in window
};

/**
 * Sanitiza texto markdown e formatações para leitura natural por voz
 * @param {string} texto
 * @returns {string}
 */
function limparTextoParaFala(texto) {
  if (!texto || typeof texto !== 'string') return '';

  let t = texto;

  // Remove estrutura do Quality Enforcer v4.1 (Confiança, Fatos, Pontos, Resposta)
  t = t.replace(/^Confian[çc]a\s*:\s*[^\n]*/gmi, '');
  t = t.replace(/^Fatos?\s*Confirmados?\s*:\s*/gmi, '');
  t = t.replace(/^Pontos?\s*N[ãa]o\s*Confirmados?\s*:\s*/gmi, '');
  t = t.replace(/^Resposta\s*:\s*/gmi, '');
  t = t.replace(/^CITACAO_FORCADA\s*:\s*[^\n]*/gmi, '');
  t = t.replace(/^ESTRUTURA_FORCADA\s*:\s*[^\n]*/gmi, '');
  t = t.replace(/^RISCO_ALUCINACAO\s*:\s*[^\n]*/gmi, '');

  // Remove blocos de código
  t = t.replace(/```[\s\S]*?```/g, '');
  t = t.replace(/`([^`]+)`/g, '$1');

  // Remove links markdown [texto](url) -> texto
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove tags HTML
  t = t.replace(/<[^>]+>/g, '');

  // Remove cabeçalhos markdown (#, ##, ###)
  t = t.replace(/^#{1,6}\s+/gm, '');

  // Remove marcações de negrito e itálico (*, **, _, __)
  t = t.replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1');

  // Remove marcadores de lista (*, -, +)
  t = t.replace(/^[\s]*[-*+]\s+/gm, '');

  // Remove separadores e tabelas markdown
  t = t.replace(/\|/g, ' ');
  t = t.replace(/[-]{3,}/g, '');

  // Remove emojis comuns que podem soar estranhos
  t = t.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

  // Ajusta siglas e pronúncias técnicas comuns
  t = t.replace(/\bDC\b/g, 'Data Center');
  t = t.replace(/\bDCs\b/g, 'Data Centers');
  t = t.replace(/\bFAQ\b/gi, 'F A Q');
  t = t.replace(/\bSP\b/g, 'São Paulo');
  t = t.replace(/\bRJ\b/g, 'Rio de Janeiro');
  t = t.replace(/\bSLA\b/gi, 'S L A');

  // Remove múltiplos espaços e quebras de linha repetidas
  t = t.replace(/\s+/g, ' ').trim();

  return t;
}

// ============ RECONHECIMENTO DE FALA (STT) ============

/**
 * Classe para gerenciar reconhecimento de voz (Speech Recognition)
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
          mensagem = 'Permissão do microfone negada. Permita o acesso nas configurações do navegador.';
          break;
        case 'network':
          mensagem = 'Erro de rede no reconhecimento de voz.';
          break;
      }

      if (this.onError) this.onError(mensagem);
    };
  }

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

  parar() {
    if (this.recognizer && this.ouvindo) {
      try {
        this.recognizer.stop();
      } catch (e) {}
      this.ouvindo = false;
    }
  }

  estaOuvindo() {
    return this.ouvindo;
  }
}

// ============ SÍNTESE DE FALA (TTS RESILIENTE) ============

/**
 * Classe para gerenciar síntese de fala com fallback automático
 */
class VoiceSynthesis {
  constructor() {
    this.audioElement = null;
    this.falando = false;
    this.falaId = 0;
    this.onStart = null;
    this.onEnd = null;
    this.vozesDisponiveis = [];
    this.vozSelecionada = null;
    this.audioDesbloqueado = false;

    this.carregarVozes();
    if (voiceSupport.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => this.carregarVozes();
    }
  }

  /**
   * Carrega e seleciona a melhor voz pt-BR do sistema operacional/navegador
   */
  carregarVozes() {
    if (!voiceSupport.speechSynthesis) return;

    this.vozesDisponiveis = window.speechSynthesis.getVoices();
    if (!this.vozesDisponiveis || this.vozesDisponiveis.length === 0) return;

    // Filtra vozes em português
    const vozesPt = this.vozesDisponiveis.filter(v => 
      v.lang === 'pt-BR' || v.lang === 'pt_BR' || v.lang.startsWith('pt')
    );

    if (vozesPt.length > 0) {
      // Charles e voz MASCULINA (requisito do projeto).
      // Vozes masculinas pt-BR vem primeiro; as femininas so como ultimo recurso.
      const preferenciasMasculinas = [
        'Microsoft Daniel',
        'Daniel',
        'Microsoft Antonio',
        'Antonio',
        'Microsoft Ricardo',
        'Ricardo',
        'Google português do Brasil',
        'Lucia' // so entra aqui se o SO nao tiver nenhuma voz masculina
      ];

      let vozPreferida = null;
      for (const pref of preferenciasMasculinas) {
        vozPreferida = vozesPt.find(v =>
          v.name.toLowerCase().includes(pref.toLowerCase())
        );
        if (vozPreferida) break;
      }

      // Ultimo recurso: 1a voz pt-BR disponivel
      if (!vozPreferida) {
        vozPreferida = vozesPt[0];
        console.warn('[Voice] Nenhuma voz masculina pt-BR encontrada, usando:', vozPreferida.name);
      }

      this.vozSelecionada = vozPreferida;
      console.log('[Voice] Voz pt-BR selecionada:', this.vozSelecionada.name, this.vozSelecionada.lang);
    } else {
      // Fallback: usa primeira voz disponível
      this.vozSelecionada = this.vozesDisponiveis[0];
      console.warn('[Voice] Nenhuma voz pt-BR encontrada, usando:', this.vozSelecionada.name, this.vozSelecionada.lang);
    }
  }

  /**
   * Desbloqueia o áudio em navegadores com restrições de autoplay
   */
  destravarAudio() {
    if (this.audioDesbloqueado) return;
    this.audioDesbloqueado = true;

    if (voiceSupport.speechSynthesis) {
      try {
        window.speechSynthesis.resume();
      } catch (e) {}
    }
  }

  /**
   * Sintetiza e fala um texto. Tenta Neural TTS primeiro, com fallback transparente para Web Speech.
   * @param {string} texto
   * @param {object} contexto
   */
  falar(texto, contexto = {}) {
    this.destravarAudio();

    if (!texto || typeof texto !== 'string' || !texto.trim()) {
      console.warn('[Voice] Texto vazio, nada para falar');
      return;
    }

    this.parar();

    const idFala = ++this.falaId;
    const textoLimpo = limparTextoParaFala(texto);
    if (!textoLimpo) return;

    this.falando = true;

    // 1. Tenta sintetizar via Neural TTS do backend
    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: textoLimpo, ...contexto })
    })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (idFala !== this.falaId) return;

      if (data && data.sucesso && data.audioBase64) {
        // Áudio neural gerado com sucesso
        this.tocarAudioBase64(data.audioBase64, data.mimeType || 'audio/mpeg', idFala, textoLimpo);
      } else {
        // Backend retornou fallback (sem chaves externas) -> Usar Web Speech API nativa
        this.falarComWebSpeech(textoLimpo, idFala);
      }
    })
    .catch(err => {
      console.warn('[Voice] Erro ao consultar /api/tts, acionando fallback Web Speech:', err.message);
      if (idFala !== this.falaId) return;
      this.falarComWebSpeech(textoLimpo, idFala);
    });
  }

  /**
   * Toca áudio Base64 retornado pelo TTS Neural
   */
  tocarAudioBase64(audioBase64, mimeType, idFala, texto) {
    try {
      const binaryString = window.atob(audioBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      const audioUrl = URL.createObjectURL(blob);

      this.audioElement = new Audio(audioUrl);

      this.audioElement.addEventListener('play', () => {
        if (idFala !== this.falaId) return;
        if (this.onStart) this.onStart();
        window.dispatchEvent(new CustomEvent('tts:start', { detail: { id: idFala, text: texto } }));
      });

      this.audioElement.addEventListener('ended', () => {
        this.finalizarFala(idFala);
        URL.revokeObjectURL(audioUrl);
        window.dispatchEvent(new CustomEvent('tts:end', { detail: { id: idFala } }));
      });

      this.audioElement.addEventListener('error', (e) => {
        console.warn('[Voice] Erro na reprodução de áudio neural, tentando Web Speech fallback...');
        URL.revokeObjectURL(audioUrl);
        this.finalizarFala(idFala);
        this.falarComWebSpeech(texto, idFala);
      });

      this.audioElement.play().catch(e => {
        console.warn('[Voice] Autoplay bloqueado para áudio neural, tentando Web Speech...');
        this.finalizarFala(idFala);
        this.falarComWebSpeech(texto, idFala);
      });
    } catch (e) {
      console.error('[Voice] Erro ao decodificar Base64:', e);
      this.falarComWebSpeech(texto, idFala);
    }
  }

  /**
   * Síntese de fala nativa pelo navegador (Web Speech API)
   */
  falarComWebSpeech(texto, idFala) {
    if (!voiceSupport.speechSynthesis) {
      console.warn('[Voice] Web Speech API não disponível neste navegador');
      this.finalizarFala(idFala);
      window.dispatchEvent(new CustomEvent('tts:error', { detail: { id: idFala, error: 'Web Speech indisponível' } }));
      return;
    }

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.0;   // Velocidade natural
      utterance.pitch = 0.85; // Tom levemente grave -> reforca timbre masculino do Charles
      utterance.volume = 1.0; // Volume máximo

      // Garante que as vozes estão carregadas
      if (!this.vozSelecionada || this.vozesDisponiveis.length === 0) {
        this.carregarVozes();
      }
      if (this.vozSelecionada) {
        utterance.voice = this.vozSelecionada;
        console.log('[Voice] Usando voz:', this.vozSelecionada.name, 'lang:', this.vozSelecionada.lang);
      } else {
        console.warn('[Voice] Nenhuma voz disponível, usando padrão do navegador');
      }

      utterance.onstart = () => {
        if (idFala !== this.falaId) return;
        this.falando = true;
        if (this.onStart) this.onStart();
        window.dispatchEvent(new CustomEvent('tts:start', { detail: { id: idFala, text: texto } }));
      };

      utterance.onend = () => {
        this.finalizarFala(idFala);
        window.dispatchEvent(new CustomEvent('tts:end', { detail: { id: idFala } }));
      };

      utterance.onerror = (e) => {
        console.warn('[Voice] Erro no WebSpeechUtterance:', e);
        this.finalizarFala(idFala);
        window.dispatchEvent(new CustomEvent('tts:error', { detail: { id: idFala, error: e } }));
      };

      // Workaround para o bug do Chrome que pausa vozes longas após 15 segundos
      const resumeInterval = setInterval(() => {
        if (!this.falando || idFala !== this.falaId) {
          clearInterval(resumeInterval);
          return;
        }
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      }, 10000);

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('[Voice] Falha crítica no Web Speech:', e);
      this.finalizarFala(idFala);
      window.dispatchEvent(new CustomEvent('tts:error', { detail: { id: idFala, error: e } }));
    }
  }

  /**
   * Interrompe qualquer reprodução de fala em andamento
   */
  parar() {
    this.falaId += 1;

    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      } catch (e) {}
      this.audioElement = null;
    }

    if (voiceSupport.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
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
    return this.falando || (voiceSupport.speechSynthesis && window.speechSynthesis.speaking) || (this.audioElement && !this.audioElement.paused);
  }
}

// ============ EXPORTAÇÃO GLOBAL ============
const voiceRecognition = new VoiceRecognition();
const voiceSynthesis = new VoiceSynthesis();

window.voiceRecognition = voiceRecognition;
window.voiceSynthesis = voiceSynthesis;
window.limparTextoParaFala = limparTextoParaFala;
