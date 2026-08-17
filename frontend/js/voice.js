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
    this.voices = [];
    this.voiceSelecionada = null;
    this.falando = false;
    this.utteranceAtual = null;
    this.falaTimeout = null;
    this.falaId = 0;
    this.onStart = null;
    this.onEnd = null;

    if (!voiceSupport.speechSynthesis) {
      console.warn('[Voice] Síntese de fala não suportada neste navegador');
      return;
    }

    // Carrega vozes disponíveis
    this.carregarVozes();
    
    // CORREÇÃO: Usa addEventListener se disponível (mais robusto que onvoiceschanged)
    // Em alguns navegadores (Chrome), as vozes carregam de forma assíncrona
    if (typeof speechSynthesis.addEventListener === 'function') {
      speechSynthesis.addEventListener('voiceschanged', () => this.carregarVozes());
    }
    
    // Fallback: também usa onvoiceschanged se existir
    if ('onvoiceschanged' in speechSynthesis) {
      speechSynthesis.onvoiceschanged = () => this.carregarVozes();
    }
    
    // CORREÇÃO: Retry agressivo - tenta carregar vozes várias vezes nos primeiros 6 segundos
    // Necessário porque alguns navegadores demoram para carregar a lista de vozes
    let tentativas = 0;
    const intervaloRetry = setInterval(() => {
      tentativas++;
      if (this.voiceSelecionada || tentativas > 20) {
        clearInterval(intervaloRetry);
        return;
      }
      this.carregarVozes();
    }, 300);
  }

  /**
   * Carrega lista de vozes disponíveis e seleciona a melhor voz masculina em pt-BR
   * Garante que SEMPRE selecione uma voz (mesmo que feminina como fallback)
   */
  carregarVozes() {
    this.voices = speechSynthesis.getVoices();
    
    if (this.voices.length === 0) {
      console.warn('[Voice] Nenhuma voz disponível ainda. Aguardando carregamento...');
      return;
    }
    
    // Se já tem uma voz selecionada, não recarrega
    if (this.voiceSelecionada) return;
    
    console.log('[Voice] Vozes disponíveis:', this.voices.map(v => `${v.name} (${v.lang})`).join(', '));
    
    // Nomes masculinos - PRIORIZA JOVENS (ordem de preferência)
    const nomesMasculinos = ['felipe', 'daniel', 'ricardo', 'bruno', 'lucas', 'rafael', 'thiago', 'david', 'mark', 'james', 'paul', 'carlos', 'joão', 'pedro'];
    
    // Nomes de vozes que soam VELHAS - EVITAR (Alex é voz velha!)
    const nomesVozesVelhas = ['antonio', 'antônio', 'george', 'thomas', 'joseph', 'jose'];
    
    // Nomes femininos para evitar (apenas quando buscando masculina)
    const nomesFemininos = ['maria', 'francine', 'helena', 'júlia', 'ana', 'sara', 'lisa', 'kate', 'joanne', 'salli', 'kimberly', 'danielle', 'vitoria', 'zira', 'hazel'];
    
    // PASSO 1: Procura vozes masculinas JOVENS em pt-BR (prioridade máxima)
    let vozEncontrada = null;

    // Tokens que indicam vozes modernas/neural/expressive de TTS comerciais
    const preferenciaTokens = ['neural', 'natural', 'expressive', 'premium', 'wave', 'nevo', 'opus', 'google', 'microsoft', 'azure', 'clara', 'neuraltalk'];

    // Primeiro, procura vozes jovens (daniel, felipe, ricardo, bruno, etc) em pt-BR
    const vozesJovens = ['felipe', 'daniel', 'ricardo', 'bruno', 'lucas', 'rafael', 'thiago'];
    vozEncontrada = this.voices.find(v => {
      const name = v.name.toLowerCase();
      return v.lang.toLowerCase().startsWith('pt') && vozesJovens.some(nj => name.includes(nj));
    });

    // PASSO 1.5: Vozes neurais pt-BR que NÃO sejam velhas (evita Antonio)
    if (!vozEncontrada) {
      vozEncontrada = this.voices.find(v => {
        const name = v.name.toLowerCase();
        return v.lang.toLowerCase().startsWith('pt') &&
               preferenciaTokens.some(t => name.includes(t)) &&
               !nomesVozesVelhas.some(nv => name.includes(nv));
      });
    }

    // PASSO 2: Lista de preferência por nome (fallback) - jovens primeiro
    if (!vozEncontrada) {
      const preferenciaNomes = [
        'microsoft daniel', 'microsoft felipe', 'microsoft ricardo', 'microsoft bruno',
        'google portugu', 'google português', 'google brazil', 'amazon polly', 'aws polly'
      ];
      for (const nome of preferenciaNomes) {
        vozEncontrada = this.voices.find(v => {
          const vName = v.name.toLowerCase();
          const vLang = v.lang.toLowerCase();
          return (vName.includes(nome) || vLang.includes(nome)) && v.lang.startsWith('pt');
        });
        if (vozEncontrada) break;
      }
    }

    // PASSO 3: Procura qualquer voz masculina pt-BR (por nome) - EVITA vozes velhas
    if (!vozEncontrada) {
      vozEncontrada = this.voices.find(v => 
        v.lang.startsWith('pt') && 
        nomesMasculinos.some(n => v.name.toLowerCase().includes(n)) &&
        !nomesVozesVelhas.some(nv => v.name.toLowerCase().includes(nv))
      );
    }

    // PASSO 4: Procura qualquer voz pt-BR que NÃO seja claramente feminina e NÃO seja velha
    if (!vozEncontrada) {
      vozEncontrada = this.voices.find(v => 
        v.lang.startsWith('pt') && 
        !nomesFemininos.some(n => v.name.toLowerCase().includes(n)) &&
        !nomesVozesVelhas.some(nv => v.name.toLowerCase().includes(nv))
      );
    }
    
    // PASSO 4: FALLBACK CRÍTICO - Usa qualquer voz pt-BR (mesmo velha ou feminina)
    // É melhor ter UMA voz do que NENHUMA
    if (!vozEncontrada) {
      vozEncontrada = this.voices.find(v => v.lang.startsWith('pt'));
      if (vozEncontrada) {
        console.log('[Voice] Nenhuma voz masculina jovem encontrada. Usando fallback pt-BR.');
      }
    }
    
    // PASSO 5: ÚLTIMO RECURSO - Usa qualquer voz disponível
    if (!vozEncontrada && this.voices.length > 0) {
      vozEncontrada = this.voices[0];
      console.log('[Voice] Nenhuma voz pt-BR encontrada. Usando primeira voz disponível:', vozEncontrada.name);
    }
    
    // Define a voz selecionada
    if (vozEncontrada) {
      this.voiceSelecionada = vozEncontrada;
      const isMasculina = nomesMasculinos.some(n => vozEncontrada.name.toLowerCase().includes(n));
      console.log('[Voice] Voz selecionada:', vozEncontrada.name, `(${vozEncontrada.lang})`, isMasculina ? '✅ Masculina' : '⚠️ Usando pitch grave');
    }

    // FORÇA Microsoft Daniel se disponível (preferência explícita do cliente)
    if (!this.voiceSelecionada) {
      const daniel = this.voices.find(v => v.name.toLowerCase().includes('microsoft daniel'));
      if (daniel) {
        this.voiceSelecionada = daniel;
        console.log('[Voice] Forçando seleção de voz: Microsoft Daniel');
      }
    }
  }

  /**
   * Retorna a voz mais natural disponível no sistema
   */
  getVozMaisNatural() {
    if (!this.voices || this.voices.length === 0) {
      return this.voiceSelecionada;
    }
    
    // Prefere vozes com características 'neural'/'natural'/'expressive' em pt-BR
    const preferenciaTokens = ['neural', 'natural', 'expressive', 'premium', 'wave', 'google', 'microsoft', 'azure'];
    const nomesVozesVelhas = ['antonio', 'antônio', 'george', 'thomas', 'joseph', 'jose'];

    // Vozes JOVENS em pt-BR - prioridade máxima
    const vozesJovens = ['felipe', 'daniel', 'ricardo', 'bruno', 'lucas', 'rafael', 'thiago'];
    const vozJovem = this.voices.find(v => 
      vozesJovens.some(nj => v.name.toLowerCase().includes(nj)) &&
      v.lang.startsWith('pt')
    );
    if (vozJovem) return vozJovem;

    // Vozes neurais pt-BR que NÃO sejam velhas (evita Antonio)
    const vozNeuralMasculina = this.voices.find(v => 
      preferenciaTokens.some(t => v.name.toLowerCase().includes(t)) &&
      v.lang.startsWith('pt') &&
      !nomesVozesVelhas.some(nv => v.name.toLowerCase().includes(nv))
    );
    if (vozNeuralMasculina) return vozNeuralMasculina;

    // Qualquer voz neural/expressive global
    const qualquerNeural = this.voices.find(v => 
      preferenciaTokens.some(t => v.name.toLowerCase().includes(t))
    );
    if (qualquerNeural) return qualquerNeural;
    
    // Fallback: usa a voz selecionada (que SEMPRE deve existir)
    return this.voiceSelecionada;
  }

  /**
   * Fala um texto em voz alta com entonação natural e jovem (voz masculina)
   * @param {string} texto Texto a ser falado
   */
  falar(texto) {
    if (!voiceSupport.speechSynthesis) {
      console.warn('[Voice] Síntese de fala não suportada');
      return;
    }
    
    if (!texto || texto.trim() === '') {
      console.warn('[Voice] Texto vazio, nada para falar');
      return;
    }
    
    // Para qualquer fala anterior e limpa estado pendente
    this.parar();

    const idFala = ++this.falaId;

    // Tenta pegar a voz mais natural disponível, ou a selecionada
    const vozNatural = this.getVozMaisNatural() || this.voiceSelecionada;
    
    // CORREÇÃO: Se ainda não tem voz, tenta carregar novamente
    if (!vozNatural && !this.voiceSelecionada) {
      console.log('[Voice] Voz não carregada ainda. Tentando carregar agora...');
      this.carregarVozes();
    }
    
    const vozFinal = vozNatural || this.voiceSelecionada;
    
    if (!vozFinal) {
      console.error('[Voice] ERRO CRÍTICO: Nenhuma voz disponível para TTS!');
      return;
    }
    
    const utterance = new SpeechSynthesisUtterance(texto);
    this.utteranceAtual = utterance;
    utterance.lang = 'pt-BR';
    
    // Parâmetros para voz mais humana e jovial
    const nomesFemininos = ['maria', 'francine', 'helena', 'zira', 'hazel'];
    const isFeminina = nomesFemininos.some(n => vozFinal.name.toLowerCase().includes(n));

    // Se a voz for neural/expressive, use parâmetros que soem mais naturais
    const nomeVoz = (vozFinal.name || '').toLowerCase();
    const isNeural = /neural|natural|expressive|premium|wave|azure|google|microsoft/.test(nomeVoz);

    // Ajusta pitch para soar mais jovem: 1.1 dá tom mais leve/masculino JOVEM
    const nomeVozLower = (vozFinal.name || '').toLowerCase();
    const isVozVelha = ['antonio', 'antônio', 'george', 'thomas'].some(n => nomeVozLower.includes(n));
    
    utterance.rate = isNeural ? 0.95 : 1.0;     // Leve desaceleração para naturalidade
    utterance.pitch = isFeminina ? 0.9 : (isVozVelha ? 1.25 : 1.1);  // Para vozes velhas, aumenta bem o pitch; demais: pitch juvenil
    utterance.volume = 1.0;   // Volume máximo

    utterance.voice = vozFinal;

    utterance.onstart = () => {
      if (idFala !== this.falaId) return;
      this.falando = true;
      if (this.onStart) this.onStart();
      
      // Dispatch event for lip-sync start
      const startEvent = new CustomEvent('tts:start', { detail: { id: idFala } });
      window.dispatchEvent(startEvent);
    };

    utterance.onend = () => {
      if (idFala !== this.falaId) return;
      this.finalizarFala();
      
      // Dispatch event for lip-sync end
      const endEvent = new CustomEvent('tts:end', { detail: { id: idFala } });
      window.dispatchEvent(endEvent);
    };

    utterance.onerror = (e) => {
      if (idFala !== this.falaId) return;
      console.error('[Voice] Erro na síntese de fala:', e.error);
      this.finalizarFala();
      
      // Dispatch event for lip-sync error
      const errorEvent = new CustomEvent('tts:error', { detail: { id: idFala, error: e.error } });
      window.dispatchEvent(errorEvent);
    };

    // Watchdog para evitar travamento caso o navegador não dispare onend/onerror
    // Aumentado para suportar respostas mais longas sem cancelar prematuramente
    const tempoEstimado = Math.min(120000, 3000 + (texto.length * 80));
    this.falaTimeout = setTimeout(() => {
      if (idFala !== this.falaId) return;
      console.warn('[Voice] Watchdog acionado: encerrando fala travada');
      speechSynthesis.cancel();
      this.finalizarFala();
      
      // Dispatch event for lip-sync watchdog
      const watchdogEvent = new CustomEvent('tts:end', { detail: { id: idFala } });
      window.dispatchEvent(watchdogEvent);
    }, tempoEstimado);

    console.log('[Voice] Falando com voz:', vozFinal.name, '| Pitch:', utterance.pitch);
    setTimeout(() => {
      if (idFala !== this.falaId) return;
      speechSynthesis.speak(utterance);
    }, 40);
  }

  /**
   * Para a fala atual
   */
  parar() {
    if (voiceSupport.speechSynthesis) {
      this.falaId += 1;
      this.limparWatchdog();
      this.utteranceAtual = null;
      speechSynthesis.cancel();
      this.falando = false;
      
      // Dispatch event for lip-sync stop
      const stopEvent = new CustomEvent('tts:stop', { detail: { id: this.falaId } });
      window.dispatchEvent(stopEvent);
    }
  }

  limparWatchdog() {
    if (this.falaTimeout) {
      clearTimeout(this.falaTimeout);
      this.falaTimeout = null;
    }
  }

  finalizarFala() {
    this.limparWatchdog();
    this.utteranceAtual = null;
    this.falando = false;
    if (this.onEnd) this.onEnd();
  }

  /**
 * Verifica se está falando
 */
  estaFalando() {
    return this.falando;
  }
}

// ============ EXPORTAÇÃO ============

// Cria instâncias globais
const voiceRecognition = new VoiceRecognition();
const voiceSynthesis = new VoiceSynthesis();
