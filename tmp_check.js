/**
 * app.js
 * 
 * LÃ³gica principal do Chatbot Charles.
 * Fluxo:
 * 1. Tela inicial: robÃ´ flutuando + microfone (sem caixa)
 * 2. Primeira pergunta: Charles se apresenta e depois responde
 * 3. Perguntas seguintes: responde normalmente
 * 4. "Caixa de diÃ¡logo" por voz ou "Digitar pergunta": abre o chat
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
    "Estou verificando essa informaÃ§Ã£o para vocÃª.",
    "Vou consultar os dados e jÃ¡ retorno com uma resposta.",
    "Permita-me confirmar essa informaÃ§Ã£o.",
    "Estou analisando sua solicitaÃ§Ã£o neste momento.",
    "Um momento, vou buscar essa informaÃ§Ã£o.",
    "SÃ³ um minuto, estou consultando a base de dados.",
    "Processando sua solicitaÃ§Ã£o, aguarde um instante.",
    "Buscando os detalhes para vocÃª agora mesmo.",
    "Deixe-me verificar os registros do sistema para vocÃª."
  ],
  amigavel: [
    "JÃ¡ estou conferindo isso para vocÃª! ðŸ˜Š",
    "Deixe-me dar uma olhada.",
    "Estou verificando os detalhes, sÃ³ um instante.",
    "JÃ¡ volto com a informaÃ§Ã£o.",
    "SÃ³ um segundinho, jÃ¡ te respondo!",
    "Buscando rapidinho aqui na base, aguente aÃ­.",
    "Um minutinho, jÃ¡ trago a resposta!"
  ],
  moderna: [
    "Processando sua solicitaÃ§Ã£o...",
    "Buscando as informaÃ§Ãµes necessÃ¡rias.",
    "Consultando os dados disponÃ­veis.",
    "Estou localizando a melhor resposta para vocÃª.",
    "Aguarde enquanto analiso sua solicitaÃ§Ã£o.",
    "Verificando na base de conhecimento...",
    "Realizando a pesquisa, um instante."
  ],
  premium: [
    "Vou validar essa informaÃ§Ã£o para garantir a resposta mais precisa.",
    "Estou realizando uma verificaÃ§Ã£o rÃ¡pida e jÃ¡ lhe atualizo.",
    "Aguarde um momento enquanto confirmo os detalhes.",
    "Estou consultando os registros para atendÃª-lo da melhor forma.",
    "Permita-me um momento para extrair a melhor resposta.",
    "Processando os dados para lhe entregar a informaÃ§Ã£o exata.",
    "Acessando os protocolos necessÃ¡rios, por favor aguarde."
  ]
};

/**
 * Retorna uma mensagem de fallback aleatÃ³ria do estilo atual
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
  statusText: document.getElementById('statusText')
};

// ============ APRESENTAÃ‡ÃƒO ============

/**
 * Charles NÃƒO se apresenta mais - responde de forma humanizada
 * NÃ£o hÃ¡ apresentaÃ§Ã£o automÃ¡tica - apenas respostas diretas
 */
function getApresentacaoSePrimeiraVez() {
  return ''; // Sem apresentaÃ§Ã£o - apenas responda
}

// ============ TELA DE VOZ ============

/**
 * Estado de escuta: ativa/desativa ondas sonoras e animaÃ§Ãµes
 */
function setEstadoEscuta(escutando) {
  state.escutando = escutando;
  elements.soundWaves.classList.toggle('active', escutando);
  elements.robotIcon.classList.toggle('listening', escutando);
  elements.voiceMicBtn.classList.toggle('listening', escutando);
  elements.voiceHint.classList.toggle('listening', escutando);
  elements.voiceHint.textContent = escutando 
    ? 'ðŸŽ¤ Ouvindo... fale sua pergunta' 
    : 'Fale no microfone ou clique em Digitar';
}

/**
 * Mostra feedback de "processando" na tela de voz
 */
function setEstadoProcessando(processando) {
  state.aguardandoResposta = processando;
  if (processando) {
    elements.voiceHint.textContent = 'â³ Processando...';
    elements.voiceHint.classList.remove('listening');
    elements.robotIcon.classList.remove('listening');
    elements.soundWaves.classList.remove('active');
  } else {
    elements.voiceHint.textContent = 'Fale no microfone ou clique em Digitar';
  }
}

/**
 * Mostra feedback de "ouvindo resposta" enquanto o TTS fala
 */
function setEstadoFalando(falando) {
  if (falando) {
    elements.soundWaves.classList.add('active');
    elements.voiceHint.textContent = 'ðŸ”Š Respondendo...';
  } else {
    elements.soundWaves.classList.remove('active');
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
    elements.voiceHint.textContent = 'âš ï¸ ' + mensagem;
    setTimeout(() => {
      elements.voiceHint.textContent = 'Fale no microfone ou clique em Digitar';
    }, 3000);
  };
  
  voiceRecognition.iniciar();
}

/**
 * Processa a pergunta vinda do microfone
 * Se a resposta contÃ©m informaÃ§Ã£o operacional, abre o chat E fala
 * Jamais responde somente por voz - informaÃ§Ã£o operacional sempre visÃ­vel no chat
 */
async function processarPerguntaVoz(texto) {
  if (!texto || state.processando) return;
  
  const textoLower = texto.toLowerCase().trim();
  
  // COMANDO ESPECIAL: "caixa de diÃ¡logo" abre o chat
  if (textoLower.includes('caixa de dialogo') || textoLower.includes('caixa de diÃ¡logo')) {
    abrirChatParaDigitacao();
    setTimeout(() => {
      elements.input.focus();
    }, 500);
    return;
  }
  
  // Processa a pergunta normalmente
  state.processando = true;
  setEstadoProcessando(true);
  
  // Fala feedback imediatamente com uma frase aleatÃ³ria
  if (voiceSupport.speechSynthesis) {
    voiceSynthesis.parar();
    voiceSynthesis.falar(getFallbackMessage());
  }
  
  try {
    const resposta = await chatAPI.enviarMensagem(texto);
    
    setEstadoProcessando(false);
    
    // Verifica se a resposta deve ser exibida no chat (informaÃ§Ã£o operacional)
    const deveExibir = resposta.tipoResposta?.deveSerExibido || 
                       contemInformacaoOperacional(resposta.resposta);
    
    if (deveExibir) {
      // Abre o chat e exibe a resposta (informaÃ§Ã£o operacional deve ficar visÃ­vel)
      elements.voiceScreen.classList.add('hidden');
      elements.chatContainer.style.display = 'flex';
      
      // Renderiza a pergunta do usuÃ¡rio
      renderMensagem('user', texto);
      
      // Renderiza a resposta do bot
      renderMensagem('bot', resposta.resposta, resposta.fonte, resposta.thumbnailUrl, resposta.downloadUrl, resposta.metadata);
      state.mensagens.push({ 
        tipo: 'bot', 
        texto: resposta.resposta,
        fonte: resposta.fonte 
      });
      
      // Carrega sugestÃµes
      if (resposta.sugestoes && resposta.sugestoes.length > 0) {
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'suggestions';
        suggestionsDiv.id = `sugestoes-${Date.now()}`;
        elements.messages.appendChild(suggestionsDiv);
        renderSugestoes(resposta.sugestoes, suggestionsDiv.id);
      }
      
      scrollParaFinal();
    } else {
      // Resposta simples - apenas feedback visual rÃ¡pido
      elements.voiceHint.textContent = 'âœ… Respondido!';
    }
    
    // SEMPRE fala a resposta via TTS (voz + chat simultaneamente)
    if (voiceSupport.speechSynthesis) {
      voiceSynthesis.onStart = () => {
        if (deveExibir) {
          // Chat aberto - atualiza estado de fala no chat
          elements.somBtn.classList.add('active');
        } else {
          setEstadoFalando(true);
        }
      };
      voiceSynthesis.onEnd = () => {
        if (deveExibir) {
          elements.somBtn.classList.remove('active');
        } else {
          setEstadoFalando(false);
        }
      };
      
      const apresentacao = getApresentacaoSePrimeiraVez();
      voiceSynthesis.falar(apresentacao + resposta.resposta);
    } else if (!deveExibir) {
      setTimeout(() => {
        elements.voiceHint.textContent = 'Fale no microfone ou clique em Digitar';
      }, 1500);
    }
    
  } catch (error) {
    setEstadoProcessando(false);
    elements.voiceHint.textContent = 'âš ï¸ Erro ao processar';
    console.error('[Charles] Erro:', error);
    setTimeout(() => {
      elements.voiceHint.textContent = 'Fale no microfone ou clique em Digitar';
    }, 3000);
  } finally {
    state.processando = false;
  }
}

/**
 * Detecta se a resposta contÃ©m informaÃ§Ã£o operacional que deve ser exibida no chat
 */
function contemInformacaoOperacional(resposta) {
  const lower = resposta.toLowerCase();
  const padroes = [
    /endereÃ§o|rua |avenida|bairro|cep/i,
    /\(\d{2}\)|telefone|contato/i,
    /\d{5}-\d{3}/,
    /data ?center|datacenter/i,
    /^\d+\./m,
    /passo|etapa|procedimento/i,
    /http|www\.|\.com|\.br/i,
    /lista|itens|relaÃ§Ã£o/i
  ];
  return padroes.some(p => p.test(resposta));
}

/**
 * Abre o chat para digitar
 * @param {boolean} modoTexto - Se true, respostas serÃ£o apenas em texto (sem TTS)
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

// ============ SÃNTESE DE VOZ ============

/**
 * Fala um texto com callbacks de estado visual, usando o VoiceClient seguro
 */
function falarRespostaAutomatica(texto) {
  if (!voiceSupport.speechSynthesis) return;

  const client = state.voiceClient;

  if (client && typeof client.playTTS === 'function') {
    voiceSynthesis.parar();
    atualizarEstadoFala(true);
    elements.somBtn.classList.add('active');
    elements.somBtn.title = 'Parar leitura';

    const speak = async () => {
      const result = await client.playTTS(texto);
      if (result.status === 'QUEUED') {
        elementosFala(true);
      } else {
        atualizarEstadoFala(false);
      }
    };

    speak().catch(() => atualizarEstadoFala(false));
    return;
  }

  voiceSynthesis.parar();
  atualizarEstadoFala(true);
  elements.somBtn.classList.add('active');
  elements.somBtn.title = 'Parar leitura';

  voiceSynthesis.onStart = () => {
    if (elements.chatContainer.style.display === 'none') {
      setEstadoFalando(true);
    }
  };

  voiceSynthesis.onEnd = () => {
    atualizarEstadoFala(false);
  };

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

// ============ RENDERIZAÃ‡ÃƒO DO CHAT ============

function renderTelaInicialChat() {
  elements.messages.innerHTML = '';
  
  const welcomeDiv = document.createElement('div');
  welcomeDiv.className = 'welcome-message';
  welcomeDiv.innerHTML = `
    <div class="welcome-avatar"><img src="assets/charles-removebg-preview.png" alt="Charles"></div>
    <h2>OlÃ¡! Eu sou o Charles</h2>
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
      fallback: 'NÃ£o encontrado',
      'specialist-document': 'Documento',
      'download-specialist': 'Download'
    };
    badgeHTML = `<span class="source-badge ${fonte}">${labels[fonte] || fonte}</span>`;
  }
  
  // Renderiza box de download se disponÃ­vel
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
    ? 'Estou demorando um pouco para processar... ðŸ˜… Pode tentar novamente?'
    : mensagem.includes('Failed to fetch') || mensagem.includes('NetworkError')
      ? 'NÃ£o estou conseguindo me conectar ao servidor. ðŸ›‘ Verifique se o backend estÃ¡ rodando!'
      : mensagem;
  div.innerHTML = `
    <div class="avatar">C</div>
    <div class="bubble" style="background: #fff5f5; border-color: #ffcccc;">
      âš ï¸ ${escapeHTML(mensagemAmigavel)}
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

// ============ UTILITÃRIOS ============

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

// ============ COMUNICAÃ‡ÃƒO COM API ============

async function verificarStatus() {
  try {
    const status = await chatAPI.getStatus();
    state.servidorOnline = true;
    state.llmDisponivel = status.llm?.disponivel || false;
    const providerNome = status.llm?.provider || 'Groq';
    
    elements.statusDot.style.background = '#00cc44';
    elements.statusText.textContent = state.llmDisponivel 
      ? `Online Â· ${providerNome} Ativo` 
      : `Online Â· ${status.faq.total} perguntas (FAQ)`;
    
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
    console.warn('[Charles] Erro ao carregar sugestÃµes:', error.message);
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
  
  // Fala mensagem de fallback aleatÃ³ria do estilo atual para feedback (SEMPRE)
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
        
        // Na primeira resposta, Charles se apresenta antes de responder
        const apresentacao = getApresentacaoSePrimeiraVez();
        const textoResposta = apresentacao + streamedText;
        
        console.log('[Frontend] Finalizando bubble com:', {
          text: textoResposta,
          fonte: metadata.fonte,
          thumbnailUrl: metadata.thumbnailUrl,
          downloadUrl: metadata.downloadUrl,
          metadata: metadata.metadata
        });
        
        finalizeStreamingBubble(botBubble, textoResposta, metadata.fonte, metadata.thumbnailUrl, metadata.downloadUrl, metadata.metadata);
        
        state.mensagens.push({ 
          tipo: 'bot', 
          texto: textoResposta,
          fonte: metadata.fonte 
        });
        
        // Fala a resposta automaticamente (sempre, independente do modo)
        falarRespostaAutomatica(textoResposta);
        
        // Carrega sugestÃµes
        if (metadata.fonte) {
          carregarSugestoesAposResposta();
        }
      },
      onError: (error) => {
        removeTyping();
        renderErro(`Desculpe, nÃ£o consegui processar sua pergunta. ${error}`);
      }
    });
    
  } catch (error) {
    // Fallback: usa API normal sem streaming
    try {
      removeTyping();
      const resposta = await chatAPI.enviarMensagem(texto);
      const apresentacao = getApresentacaoSePrimeiraVez();
      const textoResposta = apresentacao + resposta.resposta;
      
      renderMensagem('bot', textoResposta, resposta.fonte, resposta.thumbnailUrl, resposta.downloadUrl, resposta.metadata);
      state.mensagens.push({ 
        tipo: 'bot', 
        texto: textoResposta,
        fonte: resposta.fonte 
      });
      
      // Fala a resposta automaticamente (sempre, independente do modo)
      falarRespostaAutomatica(textoResposta);
      
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
      renderErro(`Desculpe, nÃ£o consegui processar sua pergunta. ${fallbackError.message}`);
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
      <span class="streaming-cursor">â–‹</span>
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
  newCursor.textContent = 'â–‹';
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
      'fallback': 'NÃ£o encontrado',
      'knowledge-gap': 'Lacuna de Conhecimento',
      'llm-fallback': 'IA (Fallback)',
      'hardcoded': 'Sistema'
    };
    const badge = document.createElement('span');
    badge.className = `source-badge ${fonte}`;
    badge.textContent = labels[fonte] || fonte;
    bubbleContent.appendChild(badge);
  }

  // Renderiza box de download se disponÃ­vel
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
 * Carrega sugestÃµes apÃ³s resposta
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
    renderErro('Seu navegador nÃ£o suporta reconhecimento de voz. Use Chrome ou Edge.');
    return;
  }

  atualizarIconeMicrofone(true);
  elements.input.placeholder = 'ðŸŽ¤ Ouvindo...';
  
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
    renderErro('Nenhuma resposta para ler. FaÃ§a uma pergunta primeiro!');
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

// ============ INICIALIZAÃ‡ÃƒO ============

async function inicializar() {
  console.log('=================================');
  console.log('  Chatbot Charles v4.2');
  console.log('  State of the Art 2026');
  console.log('  RAG + Tools + Router + Memory + SSE');
  console.log('  Streaming: Token-by-token (SSE)');
  console.log('  Voice Gate: Anti-interrupÃ§Ã£o');
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
