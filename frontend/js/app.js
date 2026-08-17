/**
 * app.js
 * 
 * Lógica principal do Chatbot Charles.
 * Fluxo:
 * 1. Tela inicial: robô flutuando + microfone (sem caixa)
 * 2. Primeira pergunta: Charles se apresenta e depois responde
 * 3. Perguntas seguintes: responde normalmente
 * 4. "Caixa de diálogo" por voz ou "Digitar pergunta": abre o chat
 * 5. **Sincronização labial (lip-sync) visual**
 */

// ============ ESTADO DO CHAT ============
const state = {
  mensagens: [],
  processando: false,
  servidorOnline: false,
  llmDisponivel: false,
  escutando: false,
  aguardandoResposta: false,
  jaApresentou: false,
  modoTexto: false,
  estiloFallback: 'profissional',
  voiceClient: null
};

// ============ MENSAGENS DE FALLBACK POR ESTILO ============
const FALLBACK_MESSAGES = {
  profissional: [
    "Estou verificando essa informação para você.",
    "Vou consultar os dados e já retorno com uma resposta.",
    "Permita-me confirmar essa informação.",
    "Estou analisando sua solicitação neste momento.",
    "Um momento, vou buscar essa informação.",
    "Só um minuto, estou consultando a base de dados.",
    "Processando sua solicitação, aguarde um instante.",
    "Buscando os detalhes para você agora mesmo.",
    "Deixe-me verificar os registros do sistema para você."
  ],
  amigavel: [
    "Já estou conferindo isso para você! 😊",
    "Deixe-me dar uma olhada.",
    "Estou verificando os detalhes, só um instante.",
    "Já volto com a informação.",
    "Só um segundinho, já te respondo!",
    "Buscando rapidinho aqui na base, aguente aí.",
    "Um minutinho, já trago a resposta!"
  ],
  moderna: [
    "Processando sua solicitação...",
    "Buscando as informações necessárias.",
    "Consultando os dados disponíveis.",
    "Estou localizando a melhor resposta para você.",
    "Aguarde enquanto analiso sua solicitação.",
    "Verificando na base de conhecimento...",
    "Realizando a pesquisa, um instante."
  ],
  premium: [
    "Vou validar essa informação para garantir a resposta mais precisa.",
    "Estou realizando uma verificação rápida e já lhe atualizo.",
    "Aguarde um momento enquanto confirmo os detalhes.",
    "Estou consultando os registros para atendê-lo da melhor forma.",
    "Permita-me um momento para extrair a melhor resposta.",
    "Processando os dados para lhe entregar a informação exata.",
    "Acessando os protocolos necessários, por favor aguarde."
  ]
};

/**
 * Retorna uma mensagem de fallback aleatória do estilo atual
 */
function getFallbackMessage() {
  const messages = FALLBACK_MESSAGES[state.estiloFallback] || FALLBACK_MESSAGES.profissional;
  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
}

/**
 * Define o estilo de fallback (profissional, amigavel, moderna, premium)
 */
function setEstiloFallback(estilo) {
  if (FALLBACK_MESSAGES[estilo]) {
    state.estiloFallback = estilo;
    console.log(`[Charles] Estilo de fallback alterado para: ${estilo}`);
  }
}

// ============ ELEMENTOS DOM ============
const elements = {
  // Tela de voz
  voiceScreen: document.getElementById('voiceScreen'),
  robotIcon: document.getElementById('robotIcon'),
  soundWaves: document.getElementById('soundWaves'),
  voiceHint: document.getElementById('voiceHint'),
  voiceMicBtn: document.getElementById('voiceMicBtn'),
  voiceTextBtn: document.getElementById('voiceTextBtn'),

  // Chat
  chatContainer: document.getElementById('chatContainer'),
  messages: document.getElementById('chatMessages'),
  input: document.getElementById('mensagemInput'),
  sendBtn: document.getElementById('enviarBtn'),
  microfoneBtn: document.getElementById('microfoneBtn'),
  somBtn: document.getElementById('somBtn'),
  stopSpeechBtn: document.getElementById('stopSpeechBtn'),
  backToVoiceBtn: document.getElementById('backToVoiceBtn'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),

  // Lip-sync elements
  mouth: document.getElementById('mouth')
};

// ============ MAPA DE VISIMES (Fonema -> Forma de boca) ============
const visemeMap = {
  // Fonemas que fecham a boca
  'b': 'mouth-viseme-m',
  'p': 'mouth-viseme-m',
  'm': 'mouth-viseme-m',
  'f': 'mouth-viseme-f',
  'v': 'mouth-viseme-v',
  
  // Fonemas que abrem a boca amplamente
  'a': 'mouth-viseme-a',
  'e': 'mouth-viseme-e',
  'i': 'mouth-viseme-i',
  'o': 'mouth-viseme-o',
  'u': 'mouth-viseme-u',
  
  // Fonemas laterais e aproximantes
  'l': 'mouth-viseme-l',
  'n': 'mouth-viseme-n',
  's': 'mouth-viseme-s',
  'z': 'mouth-viseme-z',
  'sh': 'mouth-viseme-sh',
  'ch': 'mouth-viseme-ch',
  'j': 'mouth-viseme-j',
  'r': 'mouth-viseme-r',
  'd': 'mouth-viseme-l', // Similar a L
  't': 'mouth-viseme-t', // Padrão fechado
  'g': 'mouth-viseme-g',
  'k': 'mouth-viseme-k'
};

/**
 * Ativa o viseme correspondente ao fonema
 * @param {string} fonema - O fonema detectado
 */
function ativarViseme(fonema) {
  // Remove todos os visemes ativos
  const visemes = document.querySelectorAll('.mouth-viseme.active');
  visemes.forEach(v => v.classList.remove('active'));
  
  // Mapeia o fonema para o viseme
  const visemeClass = visemeMap[fonema.toLowerCase()] || 'mouth-viseme-a';
  const visemeElement = document.getElementById(visemeClass);
  
  if (visemeElement) {
    visemeElement.classList.add('active');
  }
}

/**
 * Processa o texto para detectar fonemas e atualizar visemes
 * @param {string} texto - O texto a ser processado
 */
function processarViseme(texto) {
  if (!texto) return;
  
  // Remove visemes anteriores primeiro
  const visemes = document.querySelectorAll('.mouth-viseme.active');
  visemes.forEach(v => v.classList.remove('active'));
  
  // Divide o texto em caracteres e dispara visemes
  for (let i = 0; i < texto.length; i++) {
    const char = texto[i];
    const proximo = texto[i + 1];
    const dupla = char + proximo;
    
    // Verifica combinações especiais (digrafos)
    let fonema;
    if (dupla === 'ss' || dupla === 'll' || dupla === 'rr') {
      fonema = dupla;
    } else if (dupla === 'sh' || dupla === 'ch' || dupla === 'lh' || dupla === 'nh') {
      fonema = dupla;
    } else {
      fonema = char;
    }
    
    // Pequena delay para criar efeito de animação sequencial
    setTimeout(() => {
      ativarViseme(fonema);
    }, i * 30); // 30ms por caracter para efeito suave
  }
}

/**
 * Mostra feedback de "ouvindo resposta" enquanto o TTS fala
 */
function setEstadoFalando(falando) {
  if (falando) {
    elements.soundWaves.classList.add('active');
    elements.voiceHint.textContent = '🔊 Respondendo...';
  } else {
    elements.soundWaves.classList.remove('active');
    // Remove todos os visemes ativos
    const visemes = document.querySelectorAll('.mouth-viseme.active');
    visemes.forEach(v => v.classList.remove('active'));
    elements.voiceHint.textContent = 'Fale no microfone ou clique em Digitar';
  }
}

// ============ TELA DE VOZ ==========

/**
 * Estado de escuta: ativa/desativa ondas sonoras e animações
 */
function setEstadoEscuta(escutando) {
  state.escutando = escutando;
  elements.soundWaves.classList.toggle('active', escutando);
  elements.robotIcon.classList.toggle('listening', escutando);
  elements.voiceMicBtn.classList.toggle('listening', escutando);
  elements.voiceHint.classList.toggle('listening', escutando);
  elements.voiceHint.textContent = escutando 
    ? '🎤 Ouvindo... fale sua pergunta' 
    : 'Fale no microfone ou clique em Digitar';
}

/**
 * Mostra feedback de "processando" na tela de voz
 */
function setEstadoProcessando(processando) {
  state.aguardandoResposta = processando;
  if (processando) {
    elements.voiceHint.textContent = '⏳ Processando...';
    elements.voiceHint.classList.remove('listening');
    elements.robotIcon.classList.remove('listening');
    elements.soundWaves.classList.remove('active');
  } else {
    elements.voiceHint.textContent = 'Fale no microfone ou clique em Digitar';
  }
}

/**
 * Inicia a captura de voz pela tela inicial
 */
function iniciarCapturaVozTelaInicial() {
  if (!voiceSupport.speechRecognition) {
    abrirChatParaDigitacao();
    return;
  }

  if (state.processando || state.aguardandoResposta) return;

  // Para qualquer fala em andamento
  pararFala();

  setEstadoEscuta(true);
  
  voiceRecognition.onResult = (texto) => {
    setEstadoEscuta(false);
    processarPerguntaVoz(texto);
  };
  
  voiceRecognition.onEnd = () => {
    if (!state.aguardandoResposta) {
      setEstadoEscuta(false);
    }
  };
  
  voiceRecognition.onError = (mensagem) => {
    setEstadoEscuta(false);
    elements.voiceHint.textContent = '⚠️ ' + mensagem;
    setTimeout(() => {
      elements.voiceHint.textContent = 'Fale no microfone ou clique em Digitar';
    }, 3000);
  };
  
  voiceRecognition.iniciar();
}

/**
 * Processa a pergunta vinda do microfone
 * Se a resposta contém informação operacional, abre o chat E fala
 * Jamais responde somente por voz - informação operacional sempre visível no chat
 */
async function processarPerguntaVoz(texto) {
  if (!texto || state.processando) return;
  
  const textoLower = texto.toLowerCase().trim();
  
  // COMANDO ESPECIAL: "caixa de diálogo" abre o chat
  if (textoLower.includes('caixa de dialogo') || textoLower.includes('caixa de diálogo')) {
    abrirChatParaDigitacao();
    setTimeout(() => {
      elements.input.focus();
    }, 500);
    return;
  }
  
  // Reset de segurança - limpa timeout anterior
  if (window.__charlesTimeout) {
    clearTimeout(window.__charlesTimeout);
    window.__charlesTimeout = null;
  }
  
  // Processa a pergunta
  state.processando = true;
  setEstadoProcessando(true);
  
  // Feedback visual mínimo - não bloqueia com TTS
  if (voiceSupport.speechSynthesis) {
    elements.voiceHint.textContent = '⏳ Processando...';
  }
  
  try {
    // Busca resposta no backend
    const resposta = await chatAPI.enviarMensagem(texto);
    console.log('[Voice] Resposta recebida:', resposta.resposta?.substring(0, 100));
    
    setEstadoProcessando(false);
    
    // Verifica se a resposta deve ser exibida no chat
    const deveExibir = resposta.tipoResposta?.deveSerExibido || 
                       contemInformacaoOperacional(resposta.resposta);
    
    if (deveExibir) {
      // Abre o chat e exibe a resposta
      elements.voiceScreen.classList.add('hidden');
      elements.chatContainer.style.display = 'flex';
      
      renderMensagem('user', texto);
      renderMensagem('bot', resposta.resposta, resposta.fonte, resposta.thumbnailUrl, resposta.downloadUrl, resposta.metadata);
      state.mensagens.push({ 
        tipo: 'bot', 
        texto: resposta.resposta,
        fonte: resposta.fonte 
      });
      
      if (resposta.sugestoes && resposta.sugestoes.length > 0) {
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'suggestions';
        suggestionsDiv.id = `sugestoes-${Date.now()}`;
        elements.messages.appendChild(suggestionsDiv);
        renderSugestoes(resposta.sugestoes, suggestionsDiv.id);
      }
      
      scrollParaFinal();
    }
    
    // FALA A RESPOSTA VIA TTS
    if (voiceSupport.speechSynthesis && resposta.resposta && resposta.resposta.trim()) {
      // Timeout de segurança
      window.__charlesTimeout = setTimeout(() => {
        console.log('[Voice] Timeout TTS - reset');
      }, 10000);
      
      console.log('[Voice] Chamando TTS para:', resposta.resposta.substring(0, 50));
      voiceSynthesis.falar(resposta.resposta);
    }
    
  } catch (error) {
    console.error('[Charles] Erro:', error);
    setEstadoProcessando(false);
    elements.voiceHint.textContent = '⚠️ Erro';
    setTimeout(() => {
      elements.voiceHint.textContent = 'Fale no microfone ou clique em Digitar';
    }, 2000);
  } finally {
    state.processando = false;
  }
}

/**
 * Detecta se a resposta contém informação operacional que deve ser exibida no chat
 */
function contemInformacaoOperacional(resposta) {
  const lower = resposta.toLowerCase();
  const padroes = [
    /endereço|rua |avenida|bairro|cep/i,
    /\(\d{2}\)|telefone|contato/i,
    /\d{5}-\d{3}/,
    /data ?center|datacenter/i,
    /^\d+\./m,
    /passo|etapa|procedimento/i,
    /http|www\.|\.com|\.br/i,
    /lista|itens|relação/i
  ];
  return padroes.some(p => p.test(resposta));
}

/**
 * Abre o chat para digitar
 * @param {boolean} modoTexto - Se true, respostas serão apenas em texto (sem TTS)
 */
function abrirChatParaDigitacao(modoTexto = false) {
  state.modoTexto = modoTexto;
  elements.voiceScreen.classList.add('hidden');
  elements.chatContainer.style.display = 'flex';
  renderTelaInicialChat();
  setTimeout(() => elements.input.focus(), 500);
}

/**
 * Volta para a tela de voz
 */
function voltarParaVoz() {
  pararFala();
  state.modoTexto = false;
  elements.messages.innerHTML = '';
  state.mensagens = [];
  elements.voiceScreen.classList.remove('hidden');
  elements.chatContainer.style.display = 'none';
}

// ============ SÍNTESE DE VOZ ============

/**
 * Fala um texto com callbacks de estado visual, usando o VoiceClient seguro
 */
function falarRespostaAutomatica(texto) {
  if (!voiceSupport.speechSynthesis || !texto || !texto.trim()) return;
  
  const client = state.voiceClient;
  
  // Se temos VoiceClient com suporte a TTS, usa ele
  if (client && typeof client.playTTS === 'function') {
    // Timeout de segurança
    setTimeout(() => {
      try {
        client.playTTS(texto).catch(() => {});
      } catch(e) {}
    }, 100);
    return;
  }
  
  // Caso contrário, usa Web Speech API diretamente
  if (speechSynthesis) {
    try { speechSynthesis.cancel(); } catch(e) {}
  }
  
  voiceSynthesis.falar(texto);
}

function pararFala() {
  const client = state.voiceClient;

  if (client && typeof client.handleUserStop === 'function') {
    client.handleUserStop().then(atualizarEstadoFala).catch(atualizarEstadoFala);
    return;
  }

  if (!voiceSynthesis.estaFalando()) {
    atualizarEstadoFala(false);
    return;
  }

  voiceSynthesis.parar();
  atualizarEstadoFala(false);
}

function atualizarEstadoFala(falando) {
  elements.somBtn.classList.toggle('active', falando);
  elements.somBtn.title = falando ? 'Parar leitura' : 'Ler resposta';

  if (elements.stopSpeechBtn) {
    elements.stopSpeechBtn.disabled = !falando;
    elements.stopSpeechBtn.classList.toggle('active', falando);
  }

  if (elements.chatContainer.style.display === 'none') {
    setEstadoFalando(falando);
  }
}

// ============ RENDERIZAÇÃO DO CHAT ============

function renderTelaInicialChat() {
  elements.messages.innerHTML = '';
  
  const welcomeDiv = document.createElement('div');
  welcomeDiv.className = 'welcome-message';
  welcomeDiv.innerHTML = `
    <div class="welcome-avatar"><img src="assets/charles-removebg-preview.png" alt="Charles"></div>
    <h2>Olá! Eu sou o Charles</h2>
    <p>Seu assistente virtual do Departamento de Data Center da Claro Empresas. Pergunte sobre processos, normas e procedimentos!</p>
  `;
  elements.messages.appendChild(welcomeDiv);
  
  carregarSugestoes();
}

function renderMensagem(tipo, conteudo, fonte = null, thumbnailUrl = null, downloadUrl = null, metadata = null) {
  const div = document.createElement('div');
  div.className = `message ${tipo}`;
  
  const avatar = tipo === 'bot' ? 'C' : 'U';
  
  let badgeHTML = '';
  if (fonte) {
    const labels = {
      llm: 'IA',
      faq: 'Base de Conhecimento',
      fallback: 'Não encontrado',
      'specialist-document': 'Documento',
      'download-specialist': 'Download'
    };
    badgeHTML = `<span class="source-badge ${fonte}">${labels[fonte] || fonte}</span>`;
  }
  
  // Renderiza box de download se disponível
  let downloadBoxHTML = '';
  if (downloadUrl && metadata) {
    const thumbnailSrc = thumbnailUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiByeD0iOCIgZmlsbD0iI0Y1RjVGNiIvPgo8cGF0aCBkPSJNMjAgMTZIMzVWMjBIMjBWMTZaTTIwIDI0SDM1VjI4SDIwVjI0Wk0yMCAzMkgzNVYzNkgyMFYzMloiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+';
    downloadBoxHTML = `
      <div class="download-box">
        <div class="download-thumbnail">
          <img src="${thumbnailSrc}" alt="Thumbnail do documento" loading="lazy" />
        </div>
        <div class="download-info">
          <div class="download-filename">${escapeHTML(metadata.nome || metadata.fileName || 'Documento')}</div>
          <div class="download-size">${escapeHTML(metadata.tipo || 'PDF')}</div>
          <a href="${downloadUrl}" class="download-btn" download>
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
            Baixar Arquivo
          </a>
        </div>
      </div>
    `;
  }
  
  div.innerHTML = `
    <div class="avatar">${avatar}</div>
    <div class="bubble">
      ${escapeHTML(conteudo)}
      ${badgeHTML}
      ${downloadBoxHTML}
      <span class="time">${getHoraAtual()}</span>
    </div>
  `;
  
  elements.messages.appendChild(div);
  scrollParaFinal();
}

function renderTyping() {
  const div = document.createElement('div');
  div.className = 'typing-indicator';
  div.id = 'typingIndicator';
  div.innerHTML = '<span></span><span></span><span></span>';
  elements.messages.appendChild(div);
  scrollParaFinal();
}

function removeTyping() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) indicator.remove();
}

function renderSugestoes(sugestoes, containerId = 'sugestoesIniciais') {
  const container = document.getElementById(containerId) || elements.messages.querySelector('.suggestions');
  if (!container) return;
  
  container.innerHTML = '';
  
  sugestoes.forEach(sugestao => {
    const btn = document.createElement('button');
    btn.className = 'suggestion-btn';
    btn.textContent = sugestao;
    btn.addEventListener('click', () => {
      elements.input.value = sugestao;
      enviarMensagemChat();
    });
    container.appendChild(btn);
  });
}

function renderErro(mensagem) {
  const div = document.createElement('div');
  div.className = 'message bot';
  const mensagemAmigavel = mensagem.includes('tempo limite') 
    ? 'Estou demorando um pouco para processar... 😅 Pode tentar novamente?'
    : mensagem.includes('Failed to fetch') || mensagem.includes('NetworkError')
      ? 'Não estou conseguindo me conectar ao servidor. 🛑 Verifique se o backend está rodando!'
      : mensagem;
  div.innerHTML = `
    <div class="avatar">C</div>
    <div class="bubble" style="background: #fff5f5; border-color: #ffcccc;">
      ⚠️ ${escapeHTML(mensagemAmigavel)}
      <span class="time">${getHoraAtual()}</span>
    </div>
  `;
  elements.messages.appendChild(div);
  scrollParaFinal();
  console.error('[Charles] Erro:', mensagem);
}

function scrollParaFinal() {
  setTimeout(() => {
    elements.messages.scrollTop = elements.messages.scrollHeight;
  }, 50);
}

// ============ UTILITÁRIOS ============

function getHoraAtual() {
  return new Date().toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

function escapeHTML(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============ COMUNICAÇÃO COM API ============

async function verificarStatus() {
  try {
    const status = await chatAPI.getStatus();
    state.servidorOnline = true;
    state.llmDisponivel = status.llm?.disponivel || false;
    const providerNome = status.llm?.provider || 'Groq';
    
    elements.statusDot.style.background = '#00cc44';
    elements.statusText.textContent = state.llmDisponivel 
      ? `Online · ${providerNome} Ativo` 
      : `Online · ${status.faq.total} perguntas (FAQ)`;
    
  } catch (error) {
    state.servidorOnline = false;
    elements.statusDot.style.background = '#ff4444';
    elements.statusText.textContent = 'Servidor offline';
  }
}

async function carregarSugestoes() {
  try {
    const data = await chatAPI.getSugestoes(4);
    if (data.sugestoes && data.sugestoes.length > 0) {
      let container = document.getElementById('sugestoesIniciais');
      if (!container) {
        container = document.createElement('div');
        container.className = 'suggestions';
        container.id = 'sugestoesIniciais';
        elements.messages.appendChild(container);
      }
      renderSugestoes(data.sugestoes, 'sugestoesIniciais');
    }
  } catch (error) {
    console.warn('[Charles] Erro ao carregar sugestões:', error.message);
  }
}

/**
 * FASE 5: Envia mensagem pelo chat com streaming SSE (token-by-token)
 * Na primeira resposta, Charles se apresenta antes de responder
 */
async function enviarMensagemChat() {
  const texto = elements.input.value.trim();
  
  if (!texto || state.processando) return;
  
  elements.input.value = '';
  pararFala();
  
  renderMensagem('user', texto);
  state.mensagens.push({ tipo: 'user', texto });
  
  // Fala mensagem de fallback aleatória do estilo atual para feedback (SEMPRE)
  const fallbackMessage = getFallbackMessage();
  console.log(`[Charles] Fallback: "${fallbackMessage}"`);
  if (voiceSupport.speechSynthesis) {
    voiceSynthesis.parar();
    voiceSynthesis.falar(fallbackMessage);
  }
  
  state.processando = true;
  renderTyping();
  
  // Cria bubble do bot para streaming
  removeTyping();
  const botBubble = createStreamingBubble();
  let streamedText = '';
  let metadata = {};
  
  try {
    // FASE 5: Usa streaming SSE
    await chatAPI.enviarMensagemStream(texto, 'default', {
      onMetadata: (data) => {
        metadata = data;
        // Atualiza badge da fonte
        if (metadata.fonte) {
          const badge = botBubble.querySelector('.source-badge') || createBadge(botBubble, metadata.fonte);
        }
      },
      onToken: (token) => {
        streamedText += token;
        updateStreamingBubble(botBubble, streamedText);
      },
      onDone: (data) => {
        console.log('[Frontend] onDone recebido:', data);
        
        // Atualiza metadata com dados do onDone
        if (data) {
          metadata = { ...metadata, ...data };
        }
        
        console.log('[Frontend] Metadata final:', metadata);
        
        finalizeStreamingBubble(botBubble, streamedText, metadata.fonte, metadata.thumbnailUrl, metadata.downloadUrl, metadata.metadata);
        
        state.mensagens.push({ 
          tipo: 'bot', 
          texto: streamedText,
          fonte: metadata.fonte 
        });
        
        // Fala a resposta automaticamente
        falarRespostaAutomatica(streamedText);
        
        // Carrega sugestões
        if (metadata.fonte) {
          carregarSugestoesAposResposta();
        }
      },
      onError: (error) => {
        removeTyping();
        renderErro(`Desculpe, não consegui processar sua pergunta. ${error}`);
      }
    });
    
  } catch (error) {
    // Fallback: usa API normal sem streaming
    try {
      removeTyping();
      const resposta = await chatAPI.enviarMensagem(texto);
      
      renderMensagem('bot', resposta.resposta, resposta.fonte, resposta.thumbnailUrl, resposta.downloadUrl, resposta.metadata);
      state.mensagens.push({ 
        tipo: 'bot', 
        texto: resposta.resposta,
        fonte: resposta.fonte 
      });
      
      // Fala a resposta automaticamente
      falarRespostaAutomatica(resposta.resposta);
      
      if (resposta.sugestoes && resposta.sugestoes.length > 0) {
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'suggestions';
        suggestionsDiv.id = `sugestoes-${Date.now()}`;
        elements.messages.appendChild(suggestionsDiv);
        renderSugestoes(resposta.sugestoes, suggestionsDiv.id);
        scrollParaFinal();
      }
    } catch (fallbackError) {
      removeTyping();
      renderErro(`Desculpe, não consegui processar sua pergunta. ${fallbackError.message}`);
      console.error('[Charles] Erro:', fallbackError);
    }
  } finally {
    state.processando = false;
  }
}

/**
 * Cria bubble do bot para streaming token-by-token
 */
function createStreamingBubble() {
  const div = document.createElement('div');
  div.className = 'message bot streaming';
  div.innerHTML = `
    <div class="avatar">C</div>
    <div class="bubble">
      <span class="streaming-cursor">▋</span>
      <span class="time">${getHoraAtual()}</span>
    </div>
  `;
  elements.messages.appendChild(div);
  scrollParaFinal();
  return div;
}

/**
 * Atualiza bubble de streaming com novo token
 */
function updateStreamingBubble(bubble, text) {
  const bubbleContent = bubble.querySelector('.bubble');
  const cursor = bubbleContent.querySelector('.streaming-cursor');
  if (cursor) {
    cursor.remove();
  }
  bubbleContent.insertBefore(document.createTextNode(text), bubbleContent.firstChild);
  bubbleContent.appendChild(cursor || document.createTextNode(''));
  
  // Re-adiciona cursor
  const newCursor = document.createElement('span');
  newCursor.className = 'streaming-cursor';
  newCursor.textContent = '▋';
  bubbleContent.appendChild(newCursor);
  
  scrollParaFinal();
}

/**
 * Finaliza bubble de streaming
 */
function finalizeStreamingBubble(bubble, text, fonte, thumbnailUrl = null, downloadUrl = null, metadata = null) {
  bubble.classList.remove('streaming');
  const bubbleContent = bubble.querySelector('.bubble');
  const cursor = bubbleContent.querySelector('.streaming-cursor');
  if (cursor) cursor.remove();
  
  bubbleContent.innerHTML = escapeHTML(text);
  
  if (fonte) {
    const labels = {
      'llm': 'IA',
      'rag+llm': 'RAG + IA',
      'faq': 'Base de Conhecimento',
      'fallback': 'Não encontrado',
      'knowledge-gap': 'Lacuna de Conhecimento',
      'llm-fallback': 'IA (Fallback)',
      'hardcoded': 'Sistema'
    };
    const badge = document.createElement('span');
    badge.className = `source-badge ${fonte}`;
    badge.textContent = labels[fonte] || fonte;
    bubbleContent.appendChild(badge);
  }

  // Renderiza box de download se disponível
  if (downloadUrl && metadata) {
    const thumbnailSrc = thumbnailUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiByeD0iOCIgZmlsbD0iI0Y1RjVGNiIvPgo8cGF0aCBkPSJNMjAgMTZIMzVWMjBIMjBWMTZaTTIwIDI0SDM1VjI4SDIwVjI0Wk0yMCAzMkgzNVYzNkgyMFYzMloiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+';
    const downloadBox = document.createElement('div');
    downloadBox.className = 'download-box';
    downloadBox.innerHTML = `
      <div class="download-thumbnail">
        <img src="${thumbnailSrc}" alt="Thumbnail do documento" loading="lazy" />
      </div>
      <div class="download-info">
        <div class="download-filename">${escapeHTML(metadata.nome || metadata.fileName || 'Documento')}</div>
        <div class="download-size">${escapeHTML(metadata.tipo || 'PDF')}</div>
        <a href="${downloadUrl}" class="download-btn" download>
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
          </svg>
          Baixar Arquivo
        </a>
      </div>
    `;
    bubbleContent.appendChild(downloadBox);
  }
  
  const time = document.createElement('span');
  time.className = 'time';
  time.textContent = getHoraAtual();
  bubbleContent.appendChild(time);
  
  scrollParaFinal();
}

/**
 * Carrega sugestões após resposta
 */
async function carregarSugestoesAposResposta() {
  try {
    const data = await chatAPI.getSugestoes(3);
    if (data.sugestoes && data.sugestoes.length > 0) {
      const suggestionsDiv = document.createElement('div');
      suggestionsDiv.className = 'suggestions';
      suggestionsDiv.id = `sugestoes-${Date.now()}`;
      elements.messages.appendChild(suggestionsDiv);
      renderSugestoes(data.sugestoes, suggestionsDiv.id);
      scrollParaFinal();
    }
  } catch {}
}

// ============ VOZ (Chat interno) ============

function atualizarIconeMicrofone(ativo) {
  elements.microfoneBtn.classList.toggle('active', ativo);
  elements.microfoneBtn.title = ativo ? 'Ouvindo... clique para parar' : 'Falar (clique e fale)';
}

function iniciarCapturaVozChat() {
  if (!voiceSupport.speechRecognition) {
    renderErro('Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.');
    return;
  }

  atualizarIconeMicrofone(true);
  elements.input.placeholder = '🎤 Ouvindo...';
  
  voiceRecognition.onResult = (texto) => {
    atualizarIconeMicrofone(false);
    elements.input.placeholder = 'Digite sua pergunta...';
    elements.input.value = texto;
    enviarMensagemChat();
  };
  
  voiceRecognition.onEnd = () => {
    atualizarIconeMicrofone(false);
    elements.input.placeholder = 'Digite sua pergunta...';
  };
  
  voiceRecognition.onError = (mensagem) => {
    atualizarIconeMicrofone(false);
    elements.input.placeholder = 'Digite sua pergunta...';
    renderErro(mensagem);
  };
  
  voiceRecognition.iniciar();
}

function alternarSom() {
  if (voiceSynthesis.estaFalando()) {
    pararFala();
    return;
  }
  
  const ultimaBot = [...state.mensagens].reverse().find(m => m.tipo === 'bot');
  if (!ultimaBot) {
    renderErro('Nenhuma resposta para ler. Faça uma pergunta primeiro!');
    return;
  }
  
  falarRespostaAutomatica(ultimaBot.texto);
}

function toggleMicrofone() {
  if (voiceRecognition.estaOuvindo()) {
    voiceRecognition.parar();
    atualizarIconeMicrofone(false);
    elements.input.placeholder = 'Digite sua pergunta...';
  } else {
    iniciarCapturaVozChat();
  }
}

// ============ EVENTOS ============

function configurarEventos() {
  // TELA DE VOZ
  elements.voiceMicBtn.addEventListener('click', iniciarCapturaVozTelaInicial);
  elements.voiceTextBtn.addEventListener('click', () => abrirChatParaDigitacao(true));
  
  // CHAT
  elements.sendBtn.addEventListener('click', enviarMensagemChat);
  elements.microfoneBtn.addEventListener('click', toggleMicrofone);
  elements.somBtn.addEventListener('click', alternarSom);
  if (elements.stopSpeechBtn) {
    elements.stopSpeechBtn.addEventListener('click', pararFala);
  }
  elements.backToVoiceBtn.addEventListener('click', voltarParaVoz);
  
  elements.input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      enviarMensagemChat();
    }
  });
}

// ============ INICIALIZAÇÃO ============

async function inicializar() {
  console.log('=================================');
  console.log('  Chatbot Charles v4.2');
  console.log('  State of the Art 2026');
  console.log('  RAG + Tools + Router + Memory + SSE');
  console.log('  Streaming: Token-by-token (SSE)');
  console.log('  Voice Gate: Anti-interrupção');
  console.log('  Lip-sync: Viseme-based mouth animation');
  console.log('=================================');

  configurarEventos();
  await verificarStatus();

  if (window.VoiceClient) {
    state.voiceClient = new VoiceClient();
  }

  elements.chatContainer.style.display = 'none';
  elements.voiceScreen.classList.remove('hidden');

  setInterval(verificarStatus, 30000);
}

document.addEventListener('DOMContentLoaded', inicializar);