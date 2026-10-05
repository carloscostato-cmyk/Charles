/**
 * llm-client.js
 *
 * Cliente principal de LLM - versão 4.2 (State of the Art 2026).
 * Integra: RAG, Tool Calling, Agent Router, Modern Memory,
 * Smart Model Selection, Observabilidade (Tracing) + Cache Redis.
 *
 * Arquitetura: Clean Architecture + SOLID
 * - Cache Redis + fallback em memória LRU
 * - Todas as funcionalidades v4.1 + melhorias
 */

const { getProvider, getProvidersStatus, selectSmartModel, getFallbackChain } = require('./llm-provider');
const { getRAGService } = require('./rag/rag-service');
const { getToolRegistry } = require('./tools/tool-registry');
const { getMemoryManager } = require('./memory/memory-manager');
const { getRouterAgent } = require('./agents/router-agent');
const { getTracer } = require('./observability/tracer');
const { getWebDataCenterSearch } = require('./tools/web-datacenter-search');
const { getKnowledgeBase } = require('./knowledge-base');
const { getResponseFormatter } = require('./agents/response-formatter');
const { getVoiceSpecialist } = require('./agents/voice-specialist');
const { getVoiceOrchestrator } = require('./agents/voice-orchestrator');
const { getDownloadSpecialist } = require('./agents/download-specialist');
const { getFeedbackManager } = require('./agents/feedback-manager');
const { getCacheManager, hashKey } = require('./cache/redis-cache');
const orchestrator = require('./agents/orchestrator');
const promptNaturalizer = require('./agents/prompt-naturalizer-agent');
const sentimentClassifier = require('./agents/sentiment-classifier');
const { getVoiceSessionManager } = require('./voice/voice-session-manager');
const qualityEnforcer = require('./agents/quality-enforcer');
const socialSpecialist = require('./agents/social-specialist');
const { gerarSaudacao, detectarPeriodo } = require('./agents/humanizer');

const TIMEOUT_LLM = 15000;
const cache = getCacheManager();

/**
 * Retorna o provider ativo
 */
function getProviderAtivo() {
  const providerName = process.env.LLM_PROVIDER || 'groq';
  return getProvider(providerName);
}

/**
 * Controle de knowledge gaps (perguntas respondidas SEM lastro documental).
 * Persiste em knowledge-gaps.json (ver agents/knowledge-gap.js) e alimenta
 * GET /api/knowledge-gaps. Nunca interrompe o fluxo de resposta.
 */

/** Fontes que indicam resposta gerada apenas pelo LLM (sem lastro documental). */
const FONTES_SO_LLM = new Set(['llm', 'llm-cache', 'llm-fallback', 'llm-stream']);
const NO_EVIDENCE_RESPONSE = 'Não encontrei evidência documental suficiente para confirmar essa orientação. Não vou completar a resposta com suposições. Valide o tema com o responsável pelo processo e forneça um documento, procedimento ou registro oficial para que eu possa responder com segurança.';

function temEvidenciaDocumental({ contextoKB, ragResult, resultadosFAQ, toolResults }) {
  if (ragResult?.hasContext) return true;
  if (String(contextoKB || '').includes('=== FAQ RELEVANTE ===')) return true;
  if (String(contextoKB || '').includes('=== DATA CENTERS RELEVANTES ===')) return true;
  if (Array.isArray(resultadosFAQ) && resultadosFAQ.some((item) => Number(item?.score || 0) >= 0.5)) {
    return true;
  }
  return Array.isArray(toolResults) && toolResults.some((item) =>
    item?.success && item?.result?.hasContext === true && item?.result?.canAnswer === true
  );
}

/**
 * Avalia se uma resposta carece de fonte documental (candidata a knowledge gap).
 * @param {Object} p
 * @param {string} p.fonte - fonte da resposta
 * @param {string} [p.contextoKB] - contexto da Knowledge Base injetado no prompt
 * @param {Object} [p.ragResult] - resultado do RAG ({hasContext})
 * @param {Array}  [p.resultadosFAQ] - matches fuzzy da FAQ ({score})
 * @returns {boolean} true se a resposta saiu sem lastro documental
 */
function semFonteDocumental({ fonte, contextoKB, ragResult, resultadosFAQ }) {
  if (!FONTES_SO_LLM.has(fonte)) return false;
  if (ragResult && ragResult.hasContext) return false;
  const kb = String(contextoKB || '');
  if (kb.includes('=== FAQ RELEVANTE ===') || kb.includes('=== DATA CENTERS RELEVANTES ===')) {
    return false;
  }
  const melhorFAQ = Array.isArray(resultadosFAQ) && resultadosFAQ.length > 0
    ? (resultadosFAQ[0].score || 0)
    : 0;
  if (melhorFAQ >= 0.5) return false;
  return true;
}

/** Registra gap sem derrubar a resposta (falhas viram warning). */
function registrarGapSilencioso(pergunta, detalhe) {
  try {
    const gap = orchestrator.knowledgeGap.registrarGap(pergunta, detalhe);
    if (gap) console.log(`[LLM-Client] 📝 Knowledge gap registrado: "${pergunta}"`);
  } catch (e) {
    console.warn(`[LLM-Client] Falha ao registrar knowledge gap: ${e.message}`);
  }
}

/**
 * Ao responder com fonte documental, fecha lacuna pendente equivalente.
 * Match exato normalizado (mesmo critério de deduplicação do registrarGap).
 * Limitação conhecida: considera no máximo 50 pendentes por chamada.
 */
function fecharGapSilencioso(pergunta, resposta) {
  try {
    const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const alvo = norm(pergunta);
    if (!alvo) return;
    const pendentes = orchestrator.knowledgeGap.listarPerguntasPendentes(50);
    const gap = pendentes.find((g) => norm(g.pergunta) === alvo);
    if (gap) {
      orchestrator.knowledgeGap.marcarRespondida(gap.id, resposta);
      console.log(`[LLM-Client] ✅ Knowledge gap #${gap.id} fechado`);
    }
  } catch (e) {
    console.warn(`[LLM-Client] Falha ao fechar knowledge gap: ${e.message}`);
  }
}

/**
 * Verifica se o provider ativo está configurado
 */
async function verificarLLM() {
  const provider = getProviderAtivo();
  if (!provider.disponivel) {
    return [];
  }
  return [{ name: provider.model, provider: provider.name }];
}

/**
 * Constrói o prompt do sistema com contexto RAG e memória (Fase 1 - Naturalizado)
 */
/**
 * Constrói o prompt do sistema com contexto RAG e memória.
 *
 * @param {string} contextoRAG
 * @param {string} contextoMemoria
 * @param {Array} fatosUsuario
 * @param {string} [contextoKB]
 * @param {string} [perguntaUsuario] - texto do usuário; habilita a adaptação
 *   de tom por sentimento. Sem ele, a resposta sai sempre neutra.
 */
function construirSystemPrompt(contextoRAG, contextoMemoria, fatosUsuario, contextoKB, perguntaUsuario) {
  // Análise de tom do usuário — alimenta a adaptation do prompt mestre
  const analise = sentimentClassifier.classificar(perguntaUsuario || '');
  const promptEmpatia = sentimentClassifier.gerarPromptEmpatia(analise);

  let prompt = promptNaturalizer.gerarPromptNaturalizado({ sentimento: analise.sentimento });

  if (promptEmpatia) {
    prompt += `\n\nAJUSTE DE TOM: ${promptEmpatia}`;
  }

  // Adiciona instruções específicas para evitar respostas genéricas
  prompt += `\n\nIMPORTANTE: Responda de forma única e específica para cada pergunta. Evite respostas genéricas ou repetitivas. Se a pergunta for sobre um Data Center específico, mencione o nome da cidade/unidade. Se for sobre um procedimento, seja específico sobre os passos. Cada resposta deve ser personalizada para a pergunta atual.\n`;

  // Adiciona Knowledge Base (FAQ + DataCenters)
  if (contextoKB && contextoKB.trim()) {
    prompt += `\n\nBASE DE CONHECIMENTO DISPONÍVEL:\n${contextoKB}`;
  }

  // Adiciona contexto RAG
  if (contextoRAG && contextoRAG.trim()) {
    prompt += `\n\nINFORMAÇÕES ADICIONAIS (RAG):\n${contextoRAG}`;
  }

  // Adiciona fatos do usuário (memória semântica)
  if (fatosUsuario && fatosUsuario.length > 0) {
    prompt += `\n\nSOBRE O USUÁRIO:\n`;
    for (const fato of fatosUsuario) {
      prompt += `- ${fato.fact}\n`;
    }
  }

  // Adiciona contexto de memória (histórico)
  if (contextoMemoria && contextoMemoria.trim()) {
    prompt += `\n\nHISTÓRICO:\n${contextoMemoria}`;
  }

  return prompt;
}

function selecionarRespostaFAQLiteral(pergunta, resultadosFAQ) {
  if (!Array.isArray(resultadosFAQ) || resultadosFAQ.length === 0) {
    return null;
  }

  const melhor = resultadosFAQ[0];
  const score = Number(melhor?.score || 0);
  const perguntaOriginal = String(pergunta || '').trim().toLowerCase();
  const perguntaFAQ = String(melhor?.pergunta || '').trim().toLowerCase();
  const textoResposta = String(melhor?.resposta || '').trim();

  if (!textoResposta) {
    return null;
  }

  const normalizar = (texto) => String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = (texto) => normalizar(texto)
    .split(' ')
    .filter(Boolean)
    .filter((token) => token.length > 2 && !['como','quer','quero','me','para','na','no','de','do','da','a','o','os','as','e','ou','por','com','um','uma','uns','umas','se','que','qual','quais','onde','quando','porque','por que'].includes(token));

  const perguntaNormalizada = normalizar(perguntaOriginal);
  const perguntaFAQNormalizada = normalizar(perguntaFAQ);

  const temSubstring = perguntaNormalizada.includes(perguntaFAQNormalizada) || perguntaFAQNormalizada.includes(perguntaNormalizada);
  const tokensPergunta = tokens(perguntaOriginal);
  const tokensFAQ = tokens(perguntaFAQ);
  const tokensComuns = tokensPergunta.filter((token) => tokensFAQ.includes(token));
  const overlap = tokensPergunta.length > 0 || tokensFAQ.length > 0
    ? tokensComuns.length / Math.max(tokensPergunta.length, tokensFAQ.length)
    : 0;

  const temMatchForte = score >= 0.75 || temSubstring || overlap >= 0.6 || (score >= 0.4 && overlap >= 0.5 && tokensComuns.length >= 2);

  if (!temMatchForte) {
    return null;
  }

  return textoResposta;
}

const SAUDACOES = /^(oi|olá|ola|bom dia|boa tarde|boa noite|tudo bem|como está|como vai|e ai|ei|hey|hello|hi|good morning|good afternoon|good evening|how are you|what's up|tudo certo|tudo bem\?|como vai\?|como está\?|tudo bem como está|estou bem|e com voce|e com você|e contigo|e ai\?|e aí\?|tudo bem\?|estou bem\?|como vai\?|como está\?)\b/i;
const AGRADECIMENTOS = /^(obrigado|obrigada|valeu|thanks|thank you|thx|grato|grata|obrigadão|obrigadão|muito obrigado|muito obrigada|agradeço|thanks!|thank you!)\b/i;
const DESPEDIDAS = /^(tchau|até logo|ate logo|até mais|ate mais|até breve|ate breve|goodbye|bye|see you|fui|tenho que ir|preciso ir|até logo!)\b/i;
const RESPOSTAS_SAUDACAO = [
  'Tudo ótimo por aqui! E com você?',
  'Tudo certo! Como posso ajudar?',
  'Tudo bem! Quer perguntar algo sobre Data Center?',
  'Oi! Tudo bem por aqui. Como posso ajudar?',
  'Olá! Tudo certo. Qual é a sua dúvida sobre Data Center?',
  'Tudo bem! Quer saber sobre nossos Data Centers?',
  'Oi! Tudo ótimo. Como posso ajudar?',
  'Tudo certo! Qual é a sua pergunta?'
];
const RESPOSTAS_AGRADECIMENTO = [
  'De nada! Se precisar de mais alguma coisa, é só perguntar.',
  'Por nada! Estou aqui para ajudar.',
  'Disponha! Qualquer dúvida, estou à disposição.',
  'De nada! Se precisar de mais informações, é só chamar.',
  'Por nada! Quer perguntar algo mais?'
];
const RESPOSTAS_DESPEDIDA = [
  'Até logo! Se precisar de mais alguma coisa, é só voltar.',
  'Tchau! Volte sempre que precisar.',
  'Até mais! Estarei aqui se precisar.',
  'Até breve! Qualquer dúvida, é só chamar.',
  'Tchau! Se precisar de mais informações, é só voltar.'
];

function detectarConversaSocial(pergunta) {
  const texto = String(pergunta || '').trim();
  if (!texto) return null;

  const social = socialSpecialist.avaliar(texto);
  if (social) {
    return { resposta: social.resposta, tipo: social.tipo };
  }

  const lower = texto.toLowerCase();
  if (SAUDACOES.test(lower)) {
    return { resposta: gerarSaudacao(detectarPeriodo()), tipo: 'saudacao' };
  }
  if (AGRADECIMENTOS.test(lower)) {
    return { resposta: RESPOSTAS_AGRADECIMENTO[0], tipo: 'agradecimento' };
  }
  if (DESPEDIDAS.test(lower)) {
    return { resposta: RESPOSTAS_DESPEDIDA[0], tipo: 'despedida' };
  }

  return null;
}

function detectarSaudacao(pergunta) {
  const conversa = detectarConversaSocial(pergunta);
  return conversa ? conversa.resposta : null;
}

function responderConsultaDataCenter(pergunta, userId, tracer, traceId) {
  const { getSpecialistLocator } = require('./agents/specialist-locator');
  const { getSpecialistContact } = require('./agents/specialist-contact');
  const { getSpecialistDirectory } = require('./agents/specialist-directory');
  const { getSpecialistRegion } = require('./agents/specialist-region');
  const { getSpecialistAvailability } = require('./agents/specialist-availability');

  const specialistLocator = getSpecialistLocator();
  if (specialistLocator.isLocationQuery(pergunta)) {
    const resposta = specialistLocator.responder(pergunta);
    return {
      resposta,
      fonte: 'specialist-locator',
      tipo: 'endereco',
      routing: {
        intent: 'datacenter_location',
        confidence: 0.98,
        agentsUsed: ['specialistLocator', 'voice-specialist'],
        reasoning: 'Consulta de endereço/localização de Data Center',
        duration: 5
      }
    };
  }

  const specialistContact = getSpecialistContact();
  if (specialistContact.isContactQuery(pergunta)) {
    return {
      resposta: specialistContact.responder(pergunta),
      fonte: 'specialist-contact',
      tipo: 'telefone',
      routing: {
        intent: 'datacenter_contact',
        confidence: 0.98,
        agentsUsed: ['specialistContact', 'voice-specialist'],
        reasoning: 'Consulta de contato de Data Center',
        duration: 5
      }
    };
  }

  const specialistDirectory = getSpecialistDirectory();
  if (specialistDirectory.isDirectoryQuery(pergunta)) {
    return {
      resposta: specialistDirectory.responder(pergunta),
      fonte: 'specialist-directory',
      tipo: 'informacao',
      routing: {
        intent: 'datacenter_directory',
        confidence: 0.98,
        agentsUsed: ['specialistDirectory', 'voice-specialist'],
        reasoning: 'Consulta de diretório de Data Centers',
        duration: 5
      }
    };
  }

  const specialistRegion = getSpecialistRegion();
  if (specialistRegion.isRegionQuery(pergunta)) {
    return {
      resposta: specialistRegion.responder(pergunta),
      fonte: 'specialist-region',
      tipo: 'informacao',
      routing: {
        intent: 'datacenter_region',
        confidence: 0.98,
        agentsUsed: ['specialistRegion', 'voice-specialist'],
        reasoning: 'Consulta regional de Data Centers',
        duration: 5
      }
    };
  }

  const specialistAvailability = getSpecialistAvailability();
  if (specialistAvailability.isAvailabilityQuery(pergunta)) {
    return {
      resposta: specialistAvailability.responder(pergunta),
      fonte: 'specialist-availability',
      tipo: 'informacao',
      routing: {
        intent: 'datacenter_availability',
        confidence: 0.98,
        agentsUsed: ['specialistAvailability', 'voice-specialist'],
        reasoning: 'Consulta de disponibilidade/infraestrutura de Data Center',
        duration: 5
      }
    };
  }

  return null;
}

async function responderConsultaDocumento(pergunta, userId, tracer, traceId) {
  const { getSpecialistDocument } = require('./agents/specialist-document');
  
  const specialistDocument = getSpecialistDocument();
  if (specialistDocument.isDocumentReadRequest(pergunta)) {
    console.log(`[LLM-Client] 📄 Requisição de leitura de documento detectada`);
    const resultado = await specialistDocument.responder(pergunta);
    
    return {
      resposta: resultado.resposta,
      fonte: resultado.fonte,
      tipo: resultado.tipo,
      sucesso: resultado.sucesso,
      thumbnailUrl: resultado.thumbnailUrl,
      downloadUrl: resultado.downloadUrl,
      metadata: resultado.metadata,
      routing: {
        intent: 'document_read',
        confidence: 0.98,
        agentsUsed: ['specialistDocument', 'rag-service'],
        reasoning: 'Requisição de leitura de documento específico',
        duration: 10
      }
    };
  }

  return null;
}

async function responderDownloadDocumento(pergunta, userId, tracer, traceId) {
  const downloadSpecialist = getDownloadSpecialist();
  
  if (downloadSpecialist.isDownloadRequest(pergunta)) {
    console.log(`[LLM-Client] 📥 Requisição de download de documento detectada`);
    const resultado = await downloadSpecialist.responder(pergunta);
    
    return {
      resposta: resultado.resposta,
      fonte: resultado.fonte,
      tipo: resultado.tipo,
      sucesso: resultado.sucesso,
      thumbnailUrl: resultado.thumbnailUrl,
      downloadUrl: resultado.downloadUrl,
      metadata: resultado.metadata,
      routing: {
        intent: 'document_download',
        confidence: 0.98,
        agentsUsed: ['downloadSpecialist', 'specialistDocument'],
        reasoning: 'Requisição de download de documento',
        duration: 5
      }
    };
  }

  return null;
}

/**
 * PROCESSA PERGUNTA - VERSÃO COMPLETAMENTE REESCRITA
  * NUNCA retorna "livro aberto" - SEMPRE usa FAQ + DataCenters
  * @param {string} pergunta - Pergunta do usuário
  * @param {Array} resultadosFAQ - Resultados da busca na FAQ
  * @param {string} userId - ID do usuário
  * @returns {Promise<Object>}
  */
async function aplicarVoiceGate(pergunta, userId, traceId) {
  try {
    const voiceSessionManager = getVoiceSessionManager();
    const turnResult = await voiceSessionManager.processTurn(pergunta, userId);

    if (turnResult.status === 'QUEUED' && turnResult.queuedResponse) {
      return {
        resposta: turnResult.queuedResponse.text,
        fonte: turnResult.queuedResponse.source || 'voice-gate',
        qualidade: turnResult.queuedResponse.confidence ? Math.round(turnResult.queuedResponse.confidence * 100) : 85,
        contexto: { voiceGate: true, enfileirado: true },
        routing: {
          intent: 'voice_gate_queued',
          confidence: turnResult.queuedResponse.confidence || 0.85,
          agentsUsed: ['voice-session-manager'],
          reasoning: 'Resposta enfileirada pelo voice gate',
          duration: 1
        },
        tools: [],
        ragContext: [],
        memory: { facts: 0, history: 0 },
        model: { provider: 'VoiceGate', model: 'gate', complexity: 'low' },
        trace: { traceId },
        tipoResposta: {
          tipo: 'conversacao',
          deveSerFalado: true,
          deveSerExibido: true,
          descricao: 'Resposta enfileirada pelo voice gate'
        },
        voice: {
          ssml: turnResult.queuedResponse.text,
          ssmlCompleto: turnResult.queuedResponse.text,
          parametrosVoz: {},
          sentimento: 'neutro',
          intencao: 'voice_gate',
          personalidade: 'charles-voice',
          metadados: {}
        }
      };
    }

    if (turnResult.status === 'COMPLETED' && turnResult.response && turnResult.response.text && turnResult.response.text.trim() && turnResult.response.source !== 'error-fallback') {
      return {
        resposta: turnResult.response.text,
        fonte: turnResult.response.source || 'voice-gate',
        qualidade: turnResult.response.confidence ? Math.round(turnResult.response.confidence * 100) : 85,
        contexto: { voiceGate: true },
        routing: {
          intent: 'voice_gate',
          confidence: turnResult.response.confidence || 0.85,
          agentsUsed: ['voice-session-manager'],
          reasoning: 'Resposta consolidada pelo voice gate',
          duration: 1
        },
        tools: [],
        ragContext: [],
        memory: { facts: 0, history: 0 },
        model: { provider: 'VoiceGate', model: 'gate', complexity: 'low' },
        trace: { traceId },
        tipoResposta: {
          tipo: 'conversacao',
          deveSerFalado: true,
          deveSerExibido: true,
          descricao: 'Resposta consolidada pelo voice gate'
        },
        voice: {
          ssml: turnResult.response.text,
          ssmlCompleto: turnResult.response.text,
          parametrosVoz: {},
          sentimento: 'neutro',
          intencao: 'voice_gate',
          personalidade: 'charles-voice',
          metadados: {}
        }
      };
    }

    return null;
  } catch (error) {
    console.warn('[LLM-Client] Erro ao aplicar voice gate:', error.message);
    return null;
  }
}

async function processarPergunta(pergunta, resultadosFAQ, userId = 'default') {
  const tracer = getTracer();
  const traceId = tracer.startTrace(userId, pergunta);

  try {
    console.log(`\n[LLM-Client] 🔍 PROCESSANDO: "${pergunta}"`);

    const conversaSocial = detectarConversaSocial(pergunta);
    if (conversaSocial) {
      console.log(`[LLM-Client] 💬 Conversa social detectada (${conversaSocial.tipo}). Retornando resposta curta.`);

      const respostaSaudacao = conversaSocial.resposta;

      const voiceSpecialist = getVoiceSpecialist();
      const vozIdeal = voiceSpecialist.detectarVozIdeal(pergunta);
      voiceSpecialist.setVoz(vozIdeal);
      const respostaComVoz = voiceSpecialist.aplicarVoz(respostaSaudacao);

      const memoryManager = getMemoryManager();
      await memoryManager.remember(userId, pergunta, respostaComVoz, {
        fonte: `social:${conversaSocial.tipo}`,
        qualidade: 95
      });

      await tracer.endTrace(traceId, respostaComVoz, {
        quality: 95,
        fonte: `social:${conversaSocial.tipo}`,
        success: true
      });

      return {
        resposta: respostaComVoz,
        fonte: `social:${conversaSocial.tipo}`,
        resultadosFAQ: [],
        qualidade: 95,
        contexto: { ehSaudacao: true, social: true },
        routing: {
          intent: conversaSocial.tipo,
          confidence: 1,
          agentsUsed: ['social-specialist', 'humanizer'],
          reasoning: `Conversa social detectada (${conversaSocial.tipo}) - resposta curta, sem formato técnico`,
          duration: 1
        },
        tools: [],
        ragContext: [],
        memory: { facts: 0, history: 0 },
        model: { provider: 'Local', model: 'social', complexity: 'low' },
        trace: { traceId },
        tipoResposta: {
          tipo: 'conversacao',
          deveSerFalado: true,
          deveSerExibido: true,
          descricao: 'Resposta de conversa social'
        },
        voice: {
          ssml: respostaComVoz,
          ssmlCompleto: respostaComVoz,
          parametrosVoz: {},
          sentimento: 'neutro',
          intencao: conversaSocial.tipo,
          personalidade: 'charles-voice',
          metadados: {}
        }
      };
    }

    // FAQ com correspondência forte é uma fonte explícita do usuário e tem prioridade.
    // Isso evita que uma resposta de especialista substitua a resposta validada da FAQ.
    // Verificamos PRIMEIRO a correspondência literal da FAQ antes de entrar no voice gate,
    // para garantir que a resposta validada do usuário tenha prioridade sobre o gate.
    const respostaLiteralFAQ = selecionarRespostaFAQLiteral(pergunta, resultadosFAQ);

    if (respostaLiteralFAQ) {
      console.log(`[LLM-Client] 🎯 FAQ com match forte detectado antes do voice gate: ${pergunta}`);

      // Resposta com lastro documental: fecha lacuna pendente equivalente, se houver
      fecharGapSilencioso(pergunta, respostaLiteralFAQ);

      const voiceSpecialist = getVoiceSpecialist();
      const vozIdeal = voiceSpecialist.detectarVozIdeal(pergunta);
      voiceSpecialist.setVoz(vozIdeal);
      const respostaEspecialista = voiceSpecialist.aplicarVoz(respostaLiteralFAQ);

      const voiceOrchestrator = getVoiceOrchestrator();
      const respostaComVoz = voiceOrchestrator.processarRespostaComVoz(respostaEspecialista, pergunta, {
        respostaAnterior: null,
        fonte: 'faq'
      });

      const responseFormatter = getResponseFormatter();
      const tipagem = responseFormatter.detectarTipo(pergunta, respostaEspecialista);

      const memoryManager = getMemoryManager();
      await memoryManager.remember(userId, pergunta, respostaEspecialista, {
        fonte: 'faq-direto',
        qualidade: 98
      });

      await tracer.endTrace(traceId, respostaEspecialista, {
        quality: 98,
        fonte: 'faq',
        success: true
      });

      return {
        resposta: respostaComVoz.resposta,
        fonte: 'faq',
        resultadosFAQ: resultadosFAQ || [],
        qualidade: 98,
        contexto: { ehDataCenter: false },
        routing: {
          intent: 'faq_direto',
          confidence: 0.98,
          agentsUsed: ['faq-specialist', 'voice-specialist', 'voice-orchestrator'],
          reasoning: 'FAQ com match forte - prioridade absoluta',
          duration: 5
        },
        tools: [],
        ragContext: [],
        memory: { facts: 0, history: 0 },
        model: { provider: 'FAQ', model: 'local', complexity: 'low' },
        trace: { traceId },
        tipoResposta: {
          tipo: tipagem.tipo,
          deveSerFalado: tipagem.deveSerFalado,
          deveSerExibido: tipagem.deveSerExibido || false,
          descricao: tipagem.descricao,
          formatacao: responseFormatter._determinarFormatacao(tipagem.tipo, respostaEspecialista)
        },
        voice: {
          ssml: respostaComVoz.ssml,
          ssmlCompleto: respostaComVoz.ssmlCompleto,
          parametrosVoz: respostaComVoz.parametrosVoz,
          sentimento: respostaComVoz.sentimento,
          intencao: respostaComVoz.intencao,
          personalidade: respostaComVoz.personalidade,
          metadados: respostaComVoz.metadados
        }
      };
    }

    // Consulta aos Especialistas de Data Center (Localização, Contato, Diretório, Região)
    const specialistResponse = responderConsultaDataCenter(pergunta, userId, tracer, traceId);
    if (specialistResponse) {
      console.log(`[LLM-Client] 🏢 Especialista de Data Center acionado: ${specialistResponse.fonte}`);

      const voiceOrchestrator = getVoiceOrchestrator();
      const respostaComVoz = voiceOrchestrator.processarRespostaComVoz(specialistResponse.resposta, pergunta, {
        fonte: specialistResponse.fonte
      });

      const memoryManager = getMemoryManager();
      await memoryManager.remember(userId, pergunta, specialistResponse.resposta, {
        fonte: specialistResponse.fonte,
        qualidade: 98
      });

      await tracer.endTrace(traceId, specialistResponse.resposta, {
        quality: 98,
        fonte: specialistResponse.fonte,
        success: true
      });

      return {
        resposta: respostaComVoz.resposta,
        fonte: specialistResponse.fonte,
        resultadosFAQ: [],
        qualidade: 98,
        contexto: { ehDataCenter: true },
        routing: specialistResponse.routing || {
          intent: specialistResponse.tipo,
          confidence: 0.98,
          agentsUsed: [specialistResponse.fonte],
          reasoning: 'Resposta direta do especialista de Data Center',
          duration: 5
        },
        tools: [],
        ragContext: [],
        memory: { facts: 0, history: 0 },
        model: { provider: 'DataCenterSpecialist', model: 'local', complexity: 'low' },
        trace: { traceId },
        tipoResposta: {
          tipo: 'conversacao',
          deveSerFalado: true,
          deveSerExibido: true,
          descricao: 'Resposta de especialista de Data Center'
        },
        voice: {
          ssml: respostaComVoz.ssml,
          ssmlCompleto: respostaComVoz.ssmlCompleto,
          parametrosVoz: respostaComVoz.parametrosVoz,
          sentimento: 'neutro',
          intencao: specialistResponse.tipo,
          personalidade: 'charles-voice',
          metadados: {}
        }
      };
    }

    // PRIORIDADE 0: Feedback Manager verifica as fontes quando não há FAQ forte.
    if (!respostaLiteralFAQ) {
      const feedbackManager = getFeedbackManager();
      const resultadoFeedback = await feedbackManager.verificarTodasFontes(pergunta, userId);
    
    if (resultadoFeedback.resposta && resultadoFeedback.confianca >= 0.5) {
      console.log(`[LLM-Client] ✅ Feedback Manager encontrou resposta: ${resultadoFeedback.fonte} (confiança: ${resultadoFeedback.confianca})`);
      
      const voiceOrchestrator = getVoiceOrchestrator();
      const respostaComVoz = voiceOrchestrator.processarRespostaComVoz(resultadoFeedback.resposta, pergunta, {
        respostaAnterior: null,
        fonte: resultadoFeedback.fonte
      });

      await tracer.endTrace(traceId, resultadoFeedback.resposta, {
        quality: resultadoFeedback.confianca * 100,
        fonte: resultadoFeedback.fonte,
        success: true
      });

      return {
        resposta: respostaComVoz.resposta,
        fonte: resultadoFeedback.fonte,
        thumbnailUrl: resultadoFeedback.thumbnailUrl,
        downloadUrl: resultadoFeedback.downloadUrl,
        metadata: resultadoFeedback.metadata,
        qualidade: resultadoFeedback.confianca * 100,
        routing: {
          intent: resultadoFeedback.metodo,
          confidence: resultadoFeedback.confianca,
          agentsUsed: ['feedback-manager', 'voice-orchestrator'],
          reasoning: 'Feedback Manager encontrou resposta direta',
          duration: 10
        },
        tools: [],
        ragContext: [],
        memory: { facts: 0, history: 0 },
        model: { provider: 'Feedback', model: 'local', complexity: 'low' },
        trace: { traceId },
        tipoResposta: {
          tipo: 'informacao',
          deveSerFalado: true,
          deveSerExibido: true,
          descricao: 'Resposta informativa'
        },
        voice: {
          ssml: respostaComVoz.ssml,
          ssmlCompleto: respostaComVoz.ssmlCompleto,
          parametrosVoz: respostaComVoz.parametrosVoz,
          sentimento: respostaComVoz.sentimento,
          intencao: respostaComVoz.intencao,
          personalidade: respostaComVoz.personalidade,
          metadados: respostaComVoz.metadados
        }
      };
      }
    }

    // Verifica se é requisição de download (prioridade alta)
    const resultadoDownload = await responderDownloadDocumento(pergunta, userId, tracer, traceId);
    if (resultadoDownload) {
      console.log(`[LLM-Client] 📥 Requisição de download processada`);
      
      const voiceOrchestrator = getVoiceOrchestrator();
      const respostaComVoz = voiceOrchestrator.processarRespostaComVoz(resultadoDownload.resposta, pergunta, {
        respostaAnterior: null,
        fonte: 'download'
      });

      await tracer.endTrace(traceId, resultadoDownload.resposta, {
        quality: 95,
        fonte: 'download',
        success: true
      });

      return {
        resposta: respostaComVoz.resposta,
        fonte: resultadoDownload.fonte,
        tipo: resultadoDownload.tipo,
        sucesso: resultadoDownload.sucesso,
        thumbnailUrl: resultadoDownload.thumbnailUrl,
        downloadUrl: resultadoDownload.downloadUrl,
        metadata: resultadoDownload.metadata,
        qualidade: 95,
        contexto: { ehDataCenter: false },
        routing: resultadoDownload.routing,
        tools: [],
        ragContext: [],
        memory: { facts: 0, history: 0 },
        model: { provider: 'Download', model: 'local', complexity: 'low' },
        trace: { traceId },
        tipoResposta: {
          tipo: 'download',
          deveSerFalado: true,
          deveSerExibido: true,
          descricao: 'Download de documento',
          formatacao: 'download-box'
        },
        voice: {
          ssml: respostaComVoz.ssml,
          ssmlCompleto: respostaComVoz.ssmlCompleto,
          parametrosVoz: respostaComVoz.parametrosVoz,
          sentimento: respostaComVoz.sentimento,
          intencao: respostaComVoz.intencao,
          personalidade: respostaComVoz.personalidade,
          metadados: respostaComVoz.metadados
        }
      };
    }

    if (respostaLiteralFAQ) {
      console.log(`[LLM-Client] 🎯 Resposta literal da FAQ tem prioridade absoluta para: ${pergunta}`);

      const voiceSpecialist = getVoiceSpecialist();
      const vozIdeal = voiceSpecialist.detectarVozIdeal(pergunta);
      voiceSpecialist.setVoz(vozIdeal);
      const respostaEspecialista = voiceSpecialist.aplicarVoz(respostaLiteralFAQ);

      // Aplicar Voice Orchestrator para SSML e prosódia avançada
      const voiceOrchestrator = getVoiceOrchestrator();
      const respostaComVoz = voiceOrchestrator.processarRespostaComVoz(respostaEspecialista, pergunta, {
        respostaAnterior: null,
        fonte: 'faq'
      });

      const responseFormatter = getResponseFormatter();
      const tipagem = responseFormatter.detectarTipo(pergunta, respostaEspecialista);

      const memoryManager = getMemoryManager();
      await memoryManager.remember(userId, pergunta, respostaEspecialista, {
        fonte: 'faq-direto',
        qualidade: 98
      });

      await tracer.endTrace(traceId, respostaEspecialista, {
        quality: 98,
        fonte: 'faq',
        success: true
      });

      return {
        resposta: respostaComVoz.resposta,
        fonte: 'faq',
        resultadosFAQ: resultadosFAQ || [],
        qualidade: 98,
        contexto: { ehDataCenter: false },
        routing: {
          intent: 'faq_direto',
          confidence: 0.98,
          agentsUsed: ['faq-specialist', 'voice-specialist', 'voice-orchestrator'],
          reasoning: 'FAQ com match forte - prioridade absoluta',
          duration: 5
        },
        tools: [],
        ragContext: [],
        memory: { facts: 0, history: 0 },
        model: { provider: 'FAQ', model: 'local', complexity: 'low' },
        trace: { traceId },
        tipoResposta: {
          tipo: tipagem.tipo,
          deveSerFalado: tipagem.deveSerFalado,
          deveSerExibido: tipagem.deveSerExibido || false,
          descricao: tipagem.descricao,
          formatacao: responseFormatter._determinarFormatacao(tipagem.tipo, respostaEspecialista)
        },
        voice: {
          ssml: respostaComVoz.ssml,
          ssmlCompleto: respostaComVoz.ssmlCompleto,
          parametrosVoz: respostaComVoz.parametrosVoz,
          sentimento: respostaComVoz.sentimento,
          intencao: respostaComVoz.intencao,
          personalidade: respostaComVoz.personalidade,
          metadados: respostaComVoz.metadados
        }
      };
    }

    // ============ VERIFICAÇÃO: ESPECIALISTA DE DOCUMENTOS ============
    const documentResponse = await responderConsultaDocumento(pergunta, userId, tracer, traceId);
    if (documentResponse) {
      console.log(`[LLM-Client] 📄 Resposta do especialista de documentos para: ${pergunta}`);

      const voiceSpecialist = getVoiceSpecialist();
      const vozIdeal = voiceSpecialist.detectarVozIdeal(pergunta);
      voiceSpecialist.setVoz(vozIdeal);
      const respostaEspecialista = voiceSpecialist.aplicarVoz(documentResponse.resposta);

      const voiceOrchestrator = getVoiceOrchestrator();
      const respostaComVoz = voiceOrchestrator.processarRespostaComVoz(respostaEspecialista, pergunta, {
        respostaAnterior: null,
        fonte: 'documento'
      });

      const responseFormatter = getResponseFormatter();
      const tipagem = responseFormatter.detectarTipo(pergunta, respostaEspecialista);

      const memoryManager = getMemoryManager();
      await memoryManager.remember(userId, pergunta, respostaEspecialista, {
        fonte: documentResponse.fonte,
        qualidade: documentResponse.sucesso ? 95 : 50
      });

      await tracer.endTrace(traceId, respostaEspecialista, {
        quality: documentResponse.sucesso ? 95 : 50,
        fonte: documentResponse.fonte,
        success: documentResponse.sucesso
      });

      return {
        resposta: respostaComVoz.resposta,
        fonte: documentResponse.fonte,
        resultadosFAQ: resultadosFAQ || [],
        qualidade: documentResponse.sucesso ? 95 : 50,
        contexto: { ehDocumento: true },
        routing: documentResponse.routing,
        tools: [],
        ragContext: [],
        memory: { facts: 0, history: 0 },
        model: { provider: 'specialist', model: 'document-reader', complexity: 'low' },
        trace: { traceId },
        thumbnailUrl: documentResponse.thumbnailUrl,
        downloadUrl: documentResponse.downloadUrl,
        metadata: documentResponse.metadata,
        tipoResposta: {
          tipo: documentResponse.tipo,
          deveSerFalado: false, // Documentos não devem ser falados
          deveSerExibido: true,
          descricao: 'Leitura de documento específico',
          formatacao: responseFormatter._determinarFormatacao('informacao', respostaEspecialista)
        },
        voice: {
          ssml: respostaComVoz.ssml,
          ssmlCompleto: respostaComVoz.ssmlCompleto,
          parametrosVoz: respostaComVoz.parametrosVoz,
          sentimento: respostaComVoz.sentimento,
          intencao: respostaComVoz.intencao,
          personalidade: respostaComVoz.personalidade,
          metadados: respostaComVoz.metadados
        }
      };
    }

    // ============ ETAPA 1: BUSCA NA FAQ - PRIORIDADE #1 ============
    let respostaFAQ = null;
    let scoreFAQ = 0;
    
    if (resultadosFAQ && resultadosFAQ.length > 0) {
      respostaFAQ = resultadosFAQ[0].resposta;
      scoreFAQ = resultadosFAQ[0].score || 0;
      console.log(`[LLM-Client] ✅ FAQ encontrou: score=${(scoreFAQ * 100).toFixed(0)}%`);
    }

    // SE FAQ ENCONTROU COM SCORE ALTO, RETORNA DIRETO (sem chamar LLM)
    if (respostaLiteralFAQ) {
      console.log(`[LLM-Client] 🎯 FAQ com match forte! Retornando resposta literal do FAQ (sem reescrever)`);

      // Resposta com lastro documental: fecha lacuna pendente equivalente, se houver
      fecharGapSilencioso(pergunta, respostaLiteralFAQ);

      // Aplica voz especialista mesmo no FAQ
      const voiceSpecialist = getVoiceSpecialist();
      const vozIdeal = voiceSpecialist.detectarVozIdeal(pergunta);
      voiceSpecialist.setVoz(vozIdeal);
      const respostaComVoz = voiceSpecialist.aplicarVoz(respostaLiteralFAQ);

      // Salva na memória
      const memoryManager = getMemoryManager();
      await memoryManager.remember(userId, pergunta, respostaComVoz, {
        fonte: 'faq-direto',
        qualidade: 98
      });

      // Registra no tracer
      await tracer.endTrace(traceId, respostaComVoz, {
        quality: 95,
        fonte: 'faq',
        success: true,
        shortCircuit: true
      });

      return {
        resposta: respostaComVoz,
        fonte: 'faq',
        resultadosFAQ: resultadosFAQ || [],
        qualidade: 98,
        contexto: { ehDataCenter: false },
        routing: {
          intent: 'faq_direto',
          confidence: scoreFAQ,
          agentsUsed: ['faq-specialist', 'voice-specialist'],
          reasoning: 'FAQ com match forte - retorno literal',
          duration: 10
        },
        tools: [],
        ragContext: [],
        memory: { facts: 0, history: 0 },
        model: { provider: 'FAQ', model: 'local', complexity: 'low' },
        trace: { traceId },
        tipoResposta: {
          tipo: 'conversacao',
          deveSerFalado: true,
          deveSerExibido: false,
          descricao: 'Resposta literal da FAQ',
          formatacao: null
        }
      };
    }

    // ============ ETAPA 2: BUSCA NA KNOWLEDGE BASE (FAQ + DataCenters) ============
    console.log(`[LLM-Client] 📚 Consultando Knowledge Base...`);
    const knowledgeBase = await getKnowledgeBase();
    let contextoKB = knowledgeBase.getContextoOtimizado(pergunta);
    console.log(`[LLM-Client] ✅ Knowledge Base carregado (${contextoKB.length} bytes)`);

    // ============ ETAPA 3: SMART MODEL SELECTION ============
    const smartModel = selectSmartModel(pergunta);
    console.log(`[LLM-Client] 🤖 Modelo selecionado: ${smartModel.provider}/${smartModel.model} (complexidade: ${smartModel.complexity.level})`);
    tracer.recordModel(traceId, smartModel.provider, smartModel.model, 0, 0);
    tracer.recordIntent(traceId, smartModel.complexity.level);

    // ============ ETAPA 4: RAG - recupera contexto semanticamente ============
    const ragService = getRAGService();
    
    // Extrai termos-chave para busca mais precisa (remove stopwords, mas mantém siglas)
    const stopwords = new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'é', 'são', 'foi', 'foram', 'ser', 'estar', 'ter', 'haver', 'que', 'quem', 'qual', 'quais', 'onde', 'quando', 'como', 'por', 'para', 'com', 'sem', 'em', 'no', 'na', 'nos', 'nas', 'do', 'da', 'dos', 'das', 'de', 'e', 'ou', 'mas', 'se', 'não', 'sim', 'pode', 'poder', 'deve', 'saber', 'fazer', 'dar', 'ver', 'dizer', 'falar', 'qual', 'o', 'que', 'é', 'isto', 'isso', 'aquilo', 'seu', 'sua', 'seus', 'suas', 'meu', 'minha', 'meus', 'minhas', 'nosso', 'nossa', 'nossos', 'nossas']);
    
    const termosChave = pergunta
      .replace(/[^\w\sà-úÀ-Ú]/g, ' ')
      .split(/\s+/)
      .filter(w => {
        // Mantém se: tem mais de 2 caracteres OU é uma sigla (maiúsculas e curto)
        const isSigla = w.length >= 2 && w === w.toUpperCase();
        const isLongEnough = w.length > 2;
        const isNotStopword = !stopwords.has(w.toLowerCase());
        return (isLongEnough || isSigla) && isNotStopword;
      })
      .join(' ');
    
    // Usa termos-chave se tiver conteúdo suficiente, senão usa original
    const queryRAG = termosChave.length > 3 ? termosChave : pergunta;
    console.log(`[LLM-Client] 📄 Query RAG original: "${pergunta}"`);
    console.log(`[LLM-Client] 📄 Query RAG otimizada: "${queryRAG}"`);
    
    const ragResult = await ragService.retrieveContextForPrompt(queryRAG, 5);
    console.log(`[LLM-Client] 📄 RAG encontrou ${(ragResult.sources || []).length} documentos`);
    console.log(`[LLM-Client] 📄 RAG hasContext: ${ragResult.hasContext}, canAnswer: ${ragResult.validation?.canAnswer}`);
    if (ragResult.context) {
      console.log(`[LLM-Client] 📄 RAG context length: ${ragResult.context.length}`);
    }
    if (ragResult.sources && ragResult.sources.length > 0) {
      console.log(`[LLM-Client] 📄 RAG sources:`);
      ragResult.sources.forEach((s, i) => {
        console.log(`   Source ${i+1}: ${s.metadata?.fileName || s.metadata?.source} (score: ${s.score})`);
      });
    }

    // Fail closed: sem evidência validada, não há chamada ao LLM. Isso impede
    // que conhecimento geral ou uma resposta plausível seja apresentada como
    // fato corporativo.
    // ============ ETAPA 5: MEMORY - recupera memória do usuário ============
    const memoryManager = getMemoryManager();
    const memory = await memoryManager.recall(userId, pergunta);
    console.log(`[LLM-Client] 🧠 Memória: ${(memory.facts || []).length} fatos, ${(memory.history || []).length} histórico`);

    // ============ ETAPA 6: TOOL CALLING - executa ferramentas ============
    const toolRegistry = getToolRegistry();
    const toolResults = await toolRegistry.autoExecute(pergunta);
    console.log(`[LLM-Client] 🔧 Ferramentas executadas: ${toolResults.results.length}`);

    const evidenciaComFerramentas = temEvidenciaDocumental({
      contextoKB,
      ragResult,
      resultadosFAQ,
      toolResults: toolResults.results
    });

    for (const result of toolResults.results) {
      tracer.recordTool(traceId, result.tool, result.duration);
    }

    // ============ ETAPA 7: CONSTRUIR PROMPT FINAL COM TODA A INTELIGÊNCIA ============
    let contextoFinal = '';
    
    // Prioriza Knowledge Base (FAQ + DataCenters)
    if (contextoKB && contextoKB.trim()) {
      contextoFinal += contextoKB + '\n\n';
    }

    // Adiciona FAQ detalhada se houver
    if (respostaFAQ) {
      contextoFinal += `[FAQ Relacionado]\n${respostaFAQ}\n\n`;
    }

    // Adiciona RAG se houver
    if (ragResult.context && ragResult.context.trim()) {
      contextoFinal += `[Contexto Semântico Adicional]\n${ragResult.context}\n\n`;
    }

    const systemPrompt = construirSystemPrompt(contextoFinal, memory.summary || '', memory.facts || [], contextoKB, pergunta);

    // Adiciona contexto de ferramentas
    let toolContext = '';
    if (toolResults.results.length > 0) {
      toolContext = '\n\n[Resultados de Ferramentas Executadas]\n';
      for (const result of toolResults.results) {
        if (result.success && result.result) {
          toolContext += `- ${result.tool}: ${JSON.stringify(result.result).substring(0, 200)}\n`;
        }
      }
    }

    // ============ ETAPA 8: CHAMAR LLM ============
    let respostaLLM = '';
    let fonte = 'llm';
    const provider = getProviderAtivo();

    if (!evidenciaComFerramentas) {
      respostaLLM = NO_EVIDENCE_RESPONSE;
      fonte = 'no-evidence';
      console.warn('[LLM-Client] 🛡️ Sem evidência validada; chamada ao LLM bloqueada');
    } else if (provider.disponivel) {
      try {
        const cacheKey = hashKey('llm', `${smartModel.provider}:${smartModel.model}:${pergunta}`);
        const cached = await cache.get(cacheKey);
        if (cached && userId === 'default') {
          console.log(`[LLM-Client] ⚡ Cache HIT para LLM`);
          respostaLLM = cached;
          fonte = 'llm-cache';
        } else {
          console.log(`[LLM-Client] 📡 Chamando LLM (${smartModel.provider})...`);
          respostaLLM = await provider.chat(systemPrompt + toolContext, pergunta, TIMEOUT_LLM);
          fonte = ragResult.hasContext ? 'rag+llm' : 'llm';
          console.log(`[LLM-Client] ✅ LLM respondeu`);

          if (userId === 'default' && respostaLLM) {
            await cache.set(cacheKey, respostaLLM, 10 * 60 * 1000);
          }
        }

        // VALIDAÇÃO: Se LLM retornar "livro aberto", é erro - substituir por Knowledge Base
        if (respostaLLM && respostaLLM.toLowerCase().includes('livro aberto')) {
          console.warn(`[LLM-Client] ⚠️  LLM retornou "livro aberto" - usando Knowledge Base direto`);
          // Extrai resposta mais relevante da Knowledge Base
          const linhas = contextoKB.split('\n').filter(l => l.trim() && !l.startsWith('='));
          if (linhas.length > 0) {
            // Pega uma resposta mais direta da KB
            respostaLLM = linhas.slice(0, 5).join(' ').substring(0, 300);
          } else {
            respostaLLM = 'Desculpe, não encontrei a informação solicitada na base de conhecimento.';
          }
          fonte = 'knowledge-base-fallback';
        }
      } catch (llmError) {
        console.warn(`[LLM-Client] ❌ Erro com ${smartModel.provider}: ${llmError.message}`);
        console.log(`[LLM-Client] 🔄 Tentando fallback...`);
        
        // Fallback chain
        const fallbackChain = getFallbackChain(smartModel.provider);
        for (const fallbackProvider of fallbackChain.slice(1)) {
          try {
            const fallback = getProvider(fallbackProvider);
            if (fallback.disponivel) {
              respostaLLM = await fallback.chat(systemPrompt + toolContext, pergunta, TIMEOUT_LLM);
              fonte = 'llm-fallback';
              console.log(`[LLM-Client] ✅ Fallback bem-sucedido com ${fallbackProvider}`);
              break;
            }
          } catch (e) {
            console.warn(`[LLM-Client] Fallback ${fallbackProvider} falhou: ${e.message}`);
          }
        }
      }
    }

    // Se LLM ainda falhou, usa os ESPECIALISTAS DE DATA CENTER
    if (!respostaLLM || respostaLLM.trim() === '') {
      console.warn(`[LLM-Client] ⚠️  LLM falhou completamente - testando especialistas de Data Center...`);
      
      // Carrega os especialistas
      const { getSpecialistLocator } = require('./agents/specialist-locator');
      const { getSpecialistContact } = require('./agents/specialist-contact');
      const { getSpecialistDirectory } = require('./agents/specialist-directory');
      const { getSpecialistRegion } = require('./agents/specialist-region');
      const { getSpecialistAvailability } = require('./agents/specialist-availability');

      // Tenta cada especialista na ordem
      const specialistLocator = getSpecialistLocator();
      if (specialistLocator.isLocationQuery(pergunta)) {
        respostaLLM = specialistLocator.responder(pergunta);
        fonte = 'specialist-locator';
        console.log(`[LLM-Client] ✅ Especialista de Localização respondeu`);
      } else {
        const specialistContact = getSpecialistContact();
        if (specialistContact.isContactQuery(pergunta)) {
          respostaLLM = specialistContact.responder(pergunta);
          fonte = 'specialist-contact';
          console.log(`[LLM-Client] ✅ Especialista de Contato respondeu`);
        } else {
          const specialistDirectory = getSpecialistDirectory();
          if (specialistDirectory.isDirectoryQuery(pergunta)) {
            respostaLLM = specialistDirectory.responder(pergunta);
            fonte = 'specialist-directory';
            console.log(`[LLM-Client] ✅ Especialista de Diretório respondeu`);
          } else {
            const specialistRegion = getSpecialistRegion();
            if (specialistRegion.isRegionQuery(pergunta)) {
              respostaLLM = specialistRegion.responder(pergunta);
              fonte = 'specialist-region';
              console.log(`[LLM-Client] ✅ Especialista Regional respondeu`);
            } else {
              const specialistAvailability = getSpecialistAvailability();
              if (specialistAvailability.isAvailabilityQuery(pergunta)) {
                respostaLLM = specialistAvailability.responder(pergunta);
                fonte = 'specialist-availability';
                console.log(`[LLM-Client] ✅ Especialista de Disponibilidade respondeu`);
              } else {
                // Nenhum especialista se aplica - usa FAQ da Knowledge Base
                console.log(`[LLM-Client] ℹ️  Nenhum especialista se aplica, usando FAQ`);
                const faqItens = contextoKB.split('\n').filter(l => l.trim() && !l.startsWith('='));
                respostaLLM = faqItens.slice(0, 3).join(' ').substring(0, 500);
                if (!respostaLLM) {
                  respostaLLM = 'Desculpe, não consegui encontrar a informação solicitada no momento. Pode tentar novamente?';
                }
                fonte = 'knowledge-base-fallback-final';
              }
            }
          }
        }
      }
    }

    // ============ KNOWLEDGE GAP: registra resposta sem lastro documental ============
    // Critério: só-LLM + RAG sem contexto + KB sem trecho específico + FAQ fuzzy fraca
    if (semFonteDocumental({ fonte, contextoKB, ragResult, resultadosFAQ })) {
      registrarGapSilencioso(
        pergunta,
        `Resposta gerada apenas pelo LLM (fonte=${fonte}), sem contexto específico da KB ou RAG.`
      );
    }

    // ============ QUALITY ENFORCER v4.1: Valida e força compliance com prompt-master ============
    console.log(`[LLM-Client] 🔍 Quality Enforcer validando resposta...`);
    const qualityResult = await qualityEnforcer.enforceQuality({
      pergunta,
      resposta: respostaLLM,
      fonte,
      resultadosFAQ,
      ragResult,
      ragSources: ragResult?.sources,
      toolResults: toolResults?.results,
      specialistResults: [],
      contextoKB
    });
    
    respostaLLM = qualityResult.resposta;
    const enforcedQualityScore = qualityResult.qualityScore;
    const qualityWarnings = qualityResult.warnings;
    
    if (qualityWarnings.length > 0) {
      console.log(`[LLM-Client] ⚠️ Quality warnings: ${qualityWarnings.join(', ')}`);
    }
    console.log(`[LLM-Client] ✅ Quality Score: ${enforcedQualityScore}/100 | Citações: ${qualityResult.citationCount} | Estrutura: ${qualityResult.estrutura.isStructured ? 'OK' : 'FALTANDO'}`);

    // ============ ETAPA 9: AGENT ROUTER - roteamento inteligente ============
    const router = getRouterAgent();
    const resultadoOrquestrado = router.processar(
      pergunta,
      resultadosFAQ || [],
      respostaLLM,
      fonte
    );
    
    // Override qualidade com score forçado pelo enforcer
    resultadoOrquestrado.qualidade = enforcedQualityScore;

    // ============ ETAPA 10: WEB ENRICHMENT - enriquece com informações da web ============
    const webSearch = getWebDataCenterSearch();
    try {
      const deveIgnorarEnriquecimento = Boolean(respostaLiteralFAQ) && fonte === 'faq';
      if (!deveIgnorarEnriquecimento) {
        const respostaEnriquecida = await webSearch.enriquecerResposta(
          pergunta,
          resultadoOrquestrado.resposta
        );
        if (respostaEnriquecida) {
          resultadoOrquestrado.resposta = respostaEnriquecida;
        }
      }
    } catch (e) {
      console.warn(`[LLM-Client] Web enrichment falhou (não crítico): ${e.message}`);
    }

    // Registra agentes no tracer
    for (const agent of resultadoOrquestrado.routing?.agentsUsed || []) {
      tracer.recordAgent(traceId, agent);
    }

    // ============ ETAPA 11: MEMÓRIA - salva interação ============
    await memoryManager.remember(userId, pergunta, resultadoOrquestrado.resposta, {
      fonte: resultadoOrquestrado.fonte,
      qualidade: resultadoOrquestrado.qualidade
    });

    // ============ ETAPA 12: TRACE - finaliza tracing ============
    const traceResult = await tracer.endTrace(traceId, resultadoOrquestrado.resposta, {
      quality: resultadoOrquestrado.qualidade,
      fonte: resultadoOrquestrado.fonte,
      success: true
    });

    // ============ ETAPA 13: RESPONSE FORMATTING - detecta tipo de resposta ============
    const responseFormatter = getResponseFormatter();
    const tipagem = responseFormatter.detectarTipo(pergunta, resultadoOrquestrado.resposta);

    console.log(`[LLM-Client] ✅ Processamento concluído`);
    console.log(`   Fonte: ${resultadoOrquestrado.fonte}`);
    console.log(`   Qualidade: ${resultadoOrquestrado.qualidade}%`);
    console.log(`   Tipo: ${tipagem.tipo}`);
    console.log(`   Deve falar: ${tipagem.deveSerFalado}`);

    // Aplicar Voice Orchestrator para SSML e prosódia avançada em todas as respostas
    const voiceOrchestrator = getVoiceOrchestrator();
    const respostaComVoz = voiceOrchestrator.processarRespostaComVoz(resultadoOrquestrado.resposta, pergunta, {
      respostaAnterior: null,
      fonte: resultadoOrquestrado.fonte
    });

    return {
      resposta: respostaComVoz.resposta,
      fonte: resultadoOrquestrado.fonte,
      resultadosFAQ: resultadosFAQ || [],
      qualidade: resultadoOrquestrado.qualidade,
      contexto: resultadoOrquestrado.contexto,
      routing: resultadoOrquestrado.routing,
      tools: toolResults.toolsExecuted,
      ragContext: ragResult.sources || [],
      memory: {
        facts: (memory.facts || []).length,
        history: (memory.history || []).length
      },
      model: {
        provider: smartModel.provider,
        model: smartModel.model,
        complexity: smartModel.complexity
      },
      trace: traceResult,
      // Tipagem de resposta para controlar TTS e formatação
      tipoResposta: {
        tipo: tipagem.tipo,
        deveSerFalado: tipagem.deveSerFalado,
        deveSerExibido: tipagem.deveSerExibido || false,
        descricao: tipagem.descricao,
        formatacao: responseFormatter._determinarFormatacao(tipagem.tipo, resultadoOrquestrado.resposta)
      },
      voice: {
        ssml: respostaComVoz.ssml,
        ssmlCompleto: respostaComVoz.ssmlCompleto,
        cues: respostaComVoz.cues,
        parametrosVoz: respostaComVoz.parametrosVoz,
        sentimento: respostaComVoz.sentimento,
        intencao: respostaComVoz.intencao,
        personalidade: respostaComVoz.personalidade,
        metadados: respostaComVoz.metadados
      }
    };

  } catch (error) {
    console.error(`[LLM-Client] ❌ ERRO CRÍTICO: ${error.message}`);
    console.error(error.stack);

    // FALLBACK DE EMERGÊNCIA - nunca falha
    const resultadoOrquestrado = orchestrator.processar(
      pergunta,
      resultadosFAQ || [],
      'Desculpe, ocorreu um erro ao processar sua pergunta. Por favor, tente novamente.',
      'fallback'
    );

    await tracer.endTrace(traceId, resultadoOrquestrado.resposta, {
      quality: resultadoOrquestrado.qualidade,
      fonte: 'fallback',
      success: false,
      error: error.message
    });

    return {
      resposta: resultadoOrquestrado.resposta,
      fonte: 'fallback',
      resultadosFAQ: resultadosFAQ || [],
      qualidade: 50,
      contexto: resultadoOrquestrado.contexto,
      error: error.message,
      tipoResposta: {
        tipo: 'conversacao',
        deveSerFalado: true,
        deveSerExibido: false,
        descricao: 'Resposta de erro'
      }
    };
  }
}

/**
 * Processa uma pergunta com streaming SSE REAL
 * Tokens são emitidos ao cliente conforme chegam do LLM (stream: true).
 * Suporta Native Function Calling via tool_calls do LLM.
 *
 * @param {string} pergunta
 * @param {Object} res - Response object do Express
 * @param {Array} resultadosFAQ
 * @param {string} userId
 * @param {Object} req - Request object do Express (para AbortController)
 */
async function processarPerguntaStream(pergunta, res, resultadosFAQ, userId = 'default', req = null) {
  const { getSSEHandler } = require('./streaming/sse-handler');
  const { TOOL_SCHEMAS, TOOL_NAME_MAP } = require('./tools/tool-schemas');
  const sse = getSSEHandler();

  sse.setupSSE(res);
  const heartbeat = sse.startHeartbeat(res);

  // AbortController para cancelamento quando o cliente desconecta
  const abortController = new AbortController();
  let clientDisconnected = false;

  if (req) {
    req.on('close', () => {
      clientDisconnected = true;
      abortController.abort();
    });
  }

  try {
    const tracer = getTracer();
    const traceId = tracer.startTrace(pergunta, userId);

    // ============ PREPARAÇÃO: Contexto, Memória, RAG ============
    // Emite frase humana imediata — usuário ouve/lê antes de esperar
    sse.sendThinking(res, 'analisando', 'Processando sua solicitação...');

    // Smart Model Selection
    const { selectSmartModel } = require('./llm-provider');
    const smartModel = selectSmartModel(pergunta);

    // Knowledge Base
    const kb = await getKnowledgeBase();
    const contextoKB = kb.getContextoOtimizado ? kb.getContextoOtimizado(pergunta) : (kb.getContext ? kb.getContext(pergunta) : '');

    // FAQ
    const respostaFAQ = selecionarRespostaFAQLiteral(pergunta, resultadosFAQ);
    if (respostaFAQ) {
      // FAQ literal - streama diretamente sem chamar LLM
      fecharGapSilencioso(pergunta, respostaFAQ); // fecha lacuna pendente equivalente, se houver
      sse.sendMetadata(res, { fonte: 'faq-literal', qualidade: 100 });
      await sse.streamText(res, respostaFAQ, 20);
      sse.end(res, { fonte: 'faq-literal', qualidade: 100 });
      await tracer.endTrace(traceId, respostaFAQ, { quality: 100, fonte: 'faq-literal', success: true });
      return;
    }

    // Especialistas de Data Center
    const specialistDC = responderConsultaDataCenter(pergunta, userId, tracer, traceId);
    if (specialistDC && specialistDC.resposta) {
      sse.sendMetadata(res, { fonte: specialistDC.fonte, qualidade: 98 });
      await sse.streamText(res, specialistDC.resposta, 20);
      sse.end(res, { fonte: specialistDC.fonte, qualidade: 98 });
      await tracer.endTrace(traceId, specialistDC.resposta, { quality: 98, fonte: specialistDC.fonte, success: true });
      return;
    }

    sse.sendThinking(res, 'buscando contexto', 'Buscando informações na base de conhecimento...');

    // RAG
    const ragService = getRAGService();
    const ragResult = await ragService.search(pergunta);

    const evidenciaRAG = temEvidenciaDocumental({
      contextoKB,
      ragResult,
      resultadosFAQ,
      toolResults: []
    });

    // Memory
    const memoryManager = getMemoryManager();
    const memory = await memoryManager.recall(userId, pergunta);

    // ============ CONSTRUIR PROMPT ============
    let contextoFinal = '';
    if (contextoKB && contextoKB.trim()) {
      contextoFinal += contextoKB + '\n\n';
    }
    if (ragResult.context && ragResult.context.trim()) {
      contextoFinal += `[Contexto Semântico]\n${ragResult.context}\n\n`;
    }

    const systemPrompt = construirSystemPrompt(contextoFinal, memory.summary || '', memory.facts || [], contextoKB, pergunta);

    // Envia metadados ao cliente
    sse.sendMetadata(res, {
      fonte: 'streaming',
      qualidade: ragResult.hasContext ? 85 : 70,
      model: smartModel.model
    });

    if (ragResult.sources && ragResult.sources.length > 0) {
      sse.sendContext(res, { sources: ragResult.sources });
    }

    // ============ STREAMING REAL DO LLM ============
    const provider = getProviderAtivo();

    if (!evidenciaRAG) {
      sse.sendMetadata(res, { fonte: 'no-evidence', qualidade: 40 });
      await sse.streamText(res, NO_EVIDENCE_RESPONSE, 20);
      sse.end(res, { fonte: 'no-evidence', qualidade: 40 });
      await tracer.endTrace(traceId, NO_EVIDENCE_RESPONSE, {
        quality: 40,
        fonte: 'no-evidence',
        success: true
      });
      return;
    }

    // Para LocalProvider (sem streaming real), usa fallback
    if (!provider.disponivel || provider.name === 'Local Fallback') {
      const resultado = await processarPergunta(pergunta, resultadosFAQ, userId);
      await sse.streamText(res, resultado.resposta, 25);
      
      // Passa metadados de download se disponível
      const endMetadata = { 
        fonte: resultado.fonte, 
        qualidade: resultado.qualidade 
      };
      
      if (resultado.thumbnailUrl) {
        endMetadata.thumbnailUrl = resultado.thumbnailUrl;
      }
      if (resultado.downloadUrl) {
        endMetadata.downloadUrl = resultado.downloadUrl;
      }
      if (resultado.metadata) {
        endMetadata.metadata = resultado.metadata;
      }
      
      sse.end(res, endMetadata);
      return;
    }

    sse.sendThinking(res, 'gerando resposta', 'Gerando resposta...');

    const userMessages = [{ role: 'user', content: pergunta }];

    // Primeira chamada ao LLM com tools e streaming
    let stream = await provider.chatStream(systemPrompt, userMessages, {
      tools: TOOL_SCHEMAS,
      tool_choice: 'auto',
      model: smartModel.model,
      signal: abortController.signal
    });

    // Processa o stream real
    let streamResult = await sse.processRealStream(res, stream);

    // ============ LOOP DE TOOL CALLING ============
    // Se o LLM pediu tool_calls, executa e re-invoca
    let toolLoopCount = 0;
    const MAX_TOOL_LOOPS = 3;

    while (streamResult.toolCalls.length > 0 && toolLoopCount < MAX_TOOL_LOOPS) {
      toolLoopCount++;

      if (clientDisconnected) break;

      const toolRegistry = getToolRegistry();
      const toolMessages = [...userMessages];

      // Adiciona a resposta do assistente com tool_calls
      toolMessages.push({
        role: 'assistant',
        content: streamResult.fullText || null,
        tool_calls: streamResult.toolCalls
      });

      // Executa cada ferramenta e adiciona resultado como mensagem
      for (const tc of streamResult.toolCalls) {
        const toolName = TOOL_NAME_MAP[tc.function.name] || tc.function.name;
        let toolParams = {};

        try {
          toolParams = JSON.parse(tc.function.arguments || '{}');
        } catch (e) {
          toolParams = {};
        }

        sse.sendToolCall(res, { name: tc.function.name, params: toolParams });

        const toolResult = await toolRegistry.executeTool(toolName, toolParams);
        tracer.recordTool(traceId, toolName, toolResult.duration || 0);

        toolMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(toolResult.success ? toolResult.result : { error: toolResult.error })
        });
      }

      // Re-invoca o LLM com os resultados das ferramentas (streaming)
      stream = await provider.chatStream(systemPrompt, toolMessages, {
        tools: TOOL_SCHEMAS,
        tool_choice: 'auto',
        model: smartModel.model,
        signal: abortController.signal
      });

      streamResult = await sse.processRealStream(res, stream);
    }

    // ============ FINALIZAÇÃO ============
    const respostaFinal = streamResult.fullText || '';
    const fonte = ragResult.hasContext ? 'rag+llm-stream' : 'llm-stream';

    // Knowledge gap: resposta em streaming sem lastro documental
    if (semFonteDocumental({ fonte, contextoKB, ragResult, resultadosFAQ })) {
      registrarGapSilencioso(
        pergunta,
        `Resposta streaming gerada apenas pelo LLM (fonte=${fonte}), sem contexto específico da KB ou RAG.`
      );
    }

    // Salva na memória
    memoryManager.memorize(userId, pergunta, respostaFinal);

    // Finaliza SSE
    sse.end(res, {
      fonte,
      qualidade: ragResult.hasContext ? 85 : 70,
      trace: traceId
    });

    await tracer.endTrace(traceId, respostaFinal, {
      quality: ragResult.hasContext ? 85 : 70,
      fonte,
      success: true,
      streaming: true,
      toolLoops: toolLoopCount
    });

  } catch (error) {
    if (clientDisconnected) return; // Cliente já desconectou, nada a fazer

    console.error('[LLM-Client] Erro no streaming:', error.message);

    // Tenta fallback para resposta síncrona
    try {
      const resultado = await processarPergunta(pergunta, resultadosFAQ, userId);
      await sse.streamText(res, resultado.resposta, 25);
      
      const endMetadata = { 
        fonte: resultado.fonte + '-fallback', 
        qualidade: resultado.qualidade 
      };
      
      if (resultado.thumbnailUrl) {
        endMetadata.thumbnailUrl = resultado.thumbnailUrl;
      }
      if (resultado.downloadUrl) {
        endMetadata.downloadUrl = resultado.downloadUrl;
      }
      if (resultado.metadata) {
        endMetadata.metadata = resultado.metadata;
      }
      
      sse.end(res, endMetadata);
    } catch (fallbackError) {
      sse.sendError(res, 'Não consegui processar sua pergunta no momento. Por favor, tente novamente.');
    }
  } finally {
    sse.stopHeartbeat(heartbeat);
  }
}

/**
 * Limpa o histórico de conversa
 */
function limparHistorico() {
  const memoryManager = getMemoryManager();
  memoryManager.newSession('default');
}

module.exports = {
  verificarLLM,
  processarPergunta,
  processarPerguntaStream,
  limparHistorico,
  selecionarRespostaFAQLiteral,
  semFonteDocumental,
  temEvidenciaDocumental
};
