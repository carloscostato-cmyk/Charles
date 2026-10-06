/**
 * server.js
 *
 * Servidor principal do Chatbot Charles - versão 4.2 (State of the Art 2026).
 * API REST + SSE que gerencia as requisições do chatbot.
 *
 * Arquitetura: Clean Architecture + SOLID
 * - RAG Enterprise (FASE 1)
 * - Tool Calling (FASE 2)
 * - Agent Router (FASE 3)
 * - Modern Memory (FASE 4)
 * - Streaming SSE (FASE 5)
 * - Multimodalidade (FASE 6)
 * - Observabilidade (FASE 7)
 * - Smart Model Selection (FASE 8)
 * - SEGURANÇA: Microsoft Entra ID (FASE 9)
 * - Cache Redis + fallback em memória (FASE 10)
 * - VOICE ORCHESTRATOR v2.0 (SSML dinâmico, prosódia adaptativa)
 * - ESPECIALISTAS (Locator, Contact, Directory, Region, Availability)
 * - KNOWLEDGE BASE (FAQ + DataCenters unificados)
 * - TTS NEURAL (ElevenLabs / OpenAI / Azure)
 *
 * Endpoints:
 * - GET  /api/status          - Status do servidor
 * - GET  /api/faq             - Retorna a FAQ
 * - POST /api/chat            - Processa uma pergunta
 * - POST /api/chat/stream     - Processa com streaming SSE
 * - GET  /api/sugestoes       - Retorna sugestões
 * - GET  /api/agentes         - Status dos agentes
 * - GET  /api/guardians       - Relatório dos guardiões
 * - GET  /api/rag/stats       - Estatísticas do RAG
 * - POST /api/rag/index      - Indexa arquivo no RAG
 * - POST /api/rag/index-url   - Indexa URL no RAG
 * - POST /api/rag/index-text  - Indexa texto no RAG
 * - DELETE /api/rag/clear     - Limpa base RAG
 * - GET  /api/tools           - Lista ferramentas
 * - GET  /api/tools/stats     - Estatísticas de ferramentas
 * - POST /api/tools/execute   - Executa ferramenta
 * - GET  /api/memory/stats    - Estatísticas de memória
 * - GET  /api/memory/facts    - Fatos do usuário
 * - POST /api/memory/reset    - Reseta memória
 * - GET  /api/observability/dashboard - Dashboard
 * - GET  /api/observability/traces    - Traces recentes
 * - POST /api/upload          - Upload de arquivo multimodal
 * - GET  /api/model/complexity - Analisa complexidade
 * - GET  /api/cache/stats     - Estatísticas do cache
 * - POST /api/cache/clear     - Limpa cache (admin)
 */

const express = require('express');
const path = require('path');
const multer = require('multer');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// TLS: verificação ativa por padrão. Só desativa com ALLOW_INSECURE_TLS=true
// (proxy/firewall corporativo com MITM). Em produção, mantenha false.
if (process.env.ALLOW_INSECURE_TLS === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.warn('[Security] ⚠️ Verificação TLS DESATIVADA (ALLOW_INSECURE_TLS=true)');
}

const { lerFAQ, getEstruturaFAQ } = require('./faq-reader');
const { buscarNaFAQ, getSugestoes } = require('./faq-search');
const { verificarLLM, processarPergunta, processarPerguntaStream, limparHistorico } = require('./llm-client');
const { getProvidersStatus, getProvidersDisponiveis, classifyComplexity, selectSmartModel } = require('./llm-provider');
const orchestrator = require('./agents/orchestrator');
const knowledgeGuardian = require('./guardians/knowledge-guardian');
const codeGuardian = require('./guardians/code-guardian');
const systemGuardian = require('./guardians/system-guardian');

// FASE 1 - RAG
const { getRAGService } = require('./rag/rag-service');

// FASE 3.5 - Data Center Loader
const { getDataCenterLoader } = require('./rag/datacenter-loader');

// FASE 2 - Tool Calling
const { getToolRegistry } = require('./tools/tool-registry');

// FASE 4 - Modern Memory
const { getMemoryManager } = require('./memory/memory-manager');

// FASE 6 - Multimodalidade
const { getFileProcessor } = require('./multimodal/file-processor');
const { getPDFThumbnailService } = require('./services/pdf-thumbnail-service');

// FASE 7 - Observabilidade
const { getMetricsCollector } = require('./observability/metrics');
const { getTracer } = require('./observability/tracer');

// FASE 11 - TTS Neural (ElevenLabs / OpenAI / Azure)
const { synthesize, getStatus: getTTSStatus } = require('./tts/neural-tts-service');

// FASE 3 - Agent Router
const { getRouterAgent } = require('./agents/router-agent');

// KNOWLEDGE BASE - FAQ + DataCenters combinados
const { getKnowledgeBase } = require('./knowledge-base');

// ============ SEGURANÇA - AUTENTICAÇÃO MICROSOFT ENTRA ID ============
const {
  authenticationMiddleware,
  roleGuard,
  userRateLimiterMiddleware,
  personalizationMiddleware,
  externalUsersBlocker,
  mfaMiddleware,
  config: authConfig
} = require('./middleware/entra-id-auth');

// Security Middleware existente
const {
  corsMiddleware,
  apiLimiter,
  inputValidationMiddleware,
  securityHeadersMiddleware,
  auditLogMiddleware,
  getSecurityStatus
} = require('./middleware/security-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Endpoints públicos (sem autenticação)
const PUBLIC_API_PATHS = new Set([
  '/status',
  '/providers',
  '/sugestoes',
  '/upload/supported-types'
]);

// ============ MIDDLEWARES DE SEGURANÇA ============
app.use(corsMiddleware);
app.use(securityHeadersMiddleware);
app.use(auditLogMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(inputValidationMiddleware);

// Rate limit + Auth + RBAC na API
app.use('/api', apiLimiter);
app.use('/api', (req, res, next) => {
  if (PUBLIC_API_PATHS.has(req.path)) return next();
  return authenticationMiddleware(req, res, next);
});
app.use('/api', (req, res, next) => {
  if (PUBLIC_API_PATHS.has(req.path)) return next();
  return externalUsersBlocker(req, res, next);
});
app.use('/api', (req, res, next) => {
  if (PUBLIC_API_PATHS.has(req.path)) return next();
  return mfaMiddleware(req, res, next);
});
app.use('/api', userRateLimiterMiddleware);
app.use('/api', personalizationMiddleware);

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

// Mock SharePoint Data Center SD (demonstração, sem links) — mesma origem do Charles
app.get(['/sharepoint', '/datacenter', '/demo'], (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index-datacenter.html'));
});

// Configuração do Multer para upload de arquivos
const fileProcessor = getFileProcessor();
fileProcessor.ensureUploadDir();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, fileProcessor.ensureUploadDir());
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    if (fileProcessor.isSupported(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não suportado'));
    }
  }
});

// ============ INICIALIZAÇÃO ============

let faq = [];
let llmDisponivel = false;
let providerInfo = { nome: 'Groq', modelo: 'llama-3.3-70b-versatile' };

/**
 * Inicializa o servidor: carrega FAQ, verifica LLM, indexa FAQ no RAG
 */
async function inicializar() {
  console.log('=================================');
  console.log('  Chatbot Charles v4.2 - Inicializando');
  console.log('  State of the Art 2026');
  console.log('=================================');

  // Carrega a FAQ do Excel
  console.log('\n[Server] Carregando base de conhecimento...');
  faq = lerFAQ();
  const estrutura = getEstruturaFAQ();
  if (estrutura.length > 0) {
    console.log(`[Server] Estrutura do arquivo: ${estrutura.join(', ')}`);
  }

  // FASE 3.5 - Carrega Data Centers na memória
  console.log('\n[Server] Carregando Data Centers na memória...');
  try {
    const dataCenterLoader = getDataCenterLoader();
    const dataCenterPath = path.join(__dirname, '..', 'sites_data_center.xlsx');
    
    if (require('fs').existsSync(dataCenterPath)) {
      const datacenters = dataCenterLoader.loadFromExcel(dataCenterPath);
      const stats = dataCenterLoader.getStats();
      console.log(`[Server] Data Centers carregados: ${stats.totalDataCenters} centros`);
      console.log(`         Cidades: ${stats.cidades} | Estados: ${stats.ufs}`);
      console.log(`         Localização: ${stats.listaCidades.join(', ')}`);
    } else {
      console.warn('[Server] Arquivo sites_data_center.xlsx não encontrado. Data Centers não carregados.');
    }
  } catch (error) {
    console.warn('[Server] Erro ao carregar Data Centers:', error.message);
  }

  // ✅ NOVA ETAPA: Inicializa Knowledge Base (FAQ + DataCenters unificados)
  console.log('\n[Server] Inicializando Knowledge Base (FAQ + DataCenters)...');
  try {
    const knowledgeBase = await getKnowledgeBase();
    const stats = knowledgeBase.getStats();
    console.log(`[Server] ✅ Knowledge Base pronta!`);
    console.log(`         FAQ: ${stats.faq.total} itens`);
    console.log(`         Data Centers: ${stats.datacenters.total} unidades`);
    console.log(`         Contexto: ${(stats.contextoByte / 1024).toFixed(1)} KB`);
  } catch (error) {
    console.warn('[Server] Erro ao inicializar Knowledge Base:', error.message);
  }

  // Verifica disponibilidade do LLM
  const providerEscolhido = process.env.LLM_PROVIDER || 'groq';
  console.log(`\n[Server] Verificando conexão com LLM (provider: ${providerEscolhido})...`);
  try {
    const modelos = await verificarLLM();
    if (modelos.length > 0) {
      llmDisponivel = true;
      providerInfo = {
        nome: modelos[0].provider || providerEscolhido,
        modelo: modelos[0].name || 'desconhecido'
      };
      console.log(`[Server] LLM disponível! Provider: ${providerInfo.nome} | Modelo: ${providerInfo.modelo}`);
    } else {
      console.log(`[Server] ${providerEscolhido} não configurado. Configure a chave da API.`);
    }
  } catch (error) {
    console.log(`[Server] LLM não disponível. Usando apenas FAQ + RAG + Data Centers.`);
  }

  // FASE 1: Indexa a FAQ no RAG
  console.log('\n[Server] Inicializando RAG...');
  try {
    const ragService = getRAGService();
    await ragService.initialize();

    const ragStats = await ragService.getStats();
    if (ragStats.totalDocuments > 0) {
      console.log(`[Server] RAG já possui ${ragStats.totalDocuments} documentos indexados. Pulando indexação...`);
    } else {
      // Indexa a FAQ se houver itens
      if (faq.length > 0) {
        const faqItems = faq.map(item => ({
          pergunta: item.pergunta,
          resposta: item.resposta
        }));
        await ragService.indexFAQItems(faqItems, { source: 'faq-excel' });
        console.log(`[Server] FAQ indexada no RAG: ${faq.length} itens`);
      }

      // Indexa o arquivo Excel original no RAG
      const excelPath = path.join(__dirname, '..', 'FQ_DATA_CENTER.xls');
      if (require('fs').existsSync(excelPath)) {
        await ragService.indexFile(excelPath, { source: 'excel-original' });
        console.log('[Server] Arquivo Excel original indexado no RAG');
      }

      // Indexa Data Centers no RAG para busca semântica
      try {
        const dataCenterLoader = getDataCenterLoader();
        const dcContexto = dataCenterLoader.gerarContextoRAG();
        if (dcContexto.length > 0) {
          for (const dc of dcContexto) {
            await ragService.indexText(dc.content, { ...dc.metadata, source: 'datacenters' });
          }
          console.log(`[Server] Data Centers indexados no RAG: ${dcContexto.length} centros`);
        }
      } catch (e) {
        console.warn('[Server] Erro ao indexar Data Centers no RAG:', e.message);
      }

      // Indexa arquivos PDF do Workspace no RAG automaticamente
      try {
        const { getPDFWorkspaceIndexer } = require('./rag/pdf-workspace-indexer');
        const pdfIndexer = getPDFWorkspaceIndexer();
        const pdfResult = await pdfIndexer.indexAllWorkspacePDFs();
        console.log(`[Server] PDFs do Workspace: ${pdfResult.totalFiles} arquivos detectados (${pdfResult.totalChunks} novos chunks indexados)`);
      } catch (e) {
        console.warn('[Server] Erro ao indexar PDFs do Workspace:', e.message);
      }

      const ragStatsAfter = await ragService.getStats();
      console.log(`[Server] RAG: ${ragStatsAfter.totalDocuments} documentos indexados`);
    }
  } catch (error) {
    console.warn('[Server] Erro ao inicializar RAG:', error.message);
  }

  // FASE 7: Inicializa observabilidade
  try {
    const tracer = getTracer();
    await tracer.initialize();
    console.log('[Server] Sistema de tracing inicializado');
  } catch (error) {
    console.warn('[Server] Erro ao inicializar tracer:', error.message);
  }

  // FASE 8: Inicializa cache (Redis + fallback em memória)
  try {
    const cacheManager = require('./cache/redis-cache').getCacheManager();
    await cacheManager.initialize();
    console.log('[Server] Cache inicializado');
  } catch (error) {
    console.warn('[Server] Erro ao inicializar cache:', error.message);
  }

  console.log(`\n[Server] FAQ carregada: ${faq.length} perguntas`);
  console.log(`[Server] LLM (${providerInfo.nome}): ${llmDisponivel ? '✅ Disponível' : '❌ Indisponível'}`);
  console.log('[Server] Data Centers: ✅ Carregados na memória (Especialistas Ativos)');
  console.log('[Server] Knowledge Base: ✅ Inicializada (FAQ + DataCenters unificados)');
  const sec = getSecurityStatus(authConfig);
  console.log(`[Server] Segurança: ✅ ${sec.resumo} (nível ${sec.nivel}/10)`);
  console.log('=================================\n');
}

// ============ ROTAS DA API ============

/**
 * GET /api/status
 * Retorna o status do servidor e serviços (PÚBLICO)
 */
app.get('/api/status', async (req, res) => {
  const providers = getProvidersStatus();

  // FASE 7: Inclui métricas
  let metrics = {};
  try {
    const metricsCollector = getMetricsCollector();
    metrics = await metricsCollector.getSummary();
  } catch {}

  // FASE 1: Inclui stats do RAG
  let ragStats = {};
  try {
    const ragService = getRAGService();
    ragStats = await ragService.getStats();
  } catch {}

  res.json({
    servidor: 'online',
    chatbot: 'Charles',
    versao: '4.1.0',
    seguranca: getSecurityStatus(authConfig),
    faq: {
      total: faq.length,
      carregada: faq.length > 0
    },
    llm: {
      provider: providerInfo.nome,
      modelo: providerInfo.modelo,
      disponivel: llmDisponivel,
      providersDisponiveis: providers,
      provedorAtivo: process.env.LLM_PROVIDER || 'groq'
    },
    rag: ragStats,
    metrics
  });
});

/**
 * GET /api/providers
 * Retorna a lista de provedores de LLM disponíveis (PÚBLICO)
 */
app.get('/api/providers', (req, res) => {
  const providers = getProvidersDisponiveis();
  const status = getProvidersStatus();
  res.json({
    provedorAtivo: process.env.LLM_PROVIDER || 'groq',
    llmDisponivel,
    provedores: providers,
    status: status
  });
});

/**
 * GET /api/faq
 * Retorna toda a base de conhecimento FAQ (PÚBLICO)
 */
app.get('/api/faq', (req, res) => {
  res.json({
    total: faq.length,
    dados: faq.map((item, index) => ({
      id: index + 1,
      pergunta: item.pergunta,
      resposta: item.resposta
    }))
  });
});

/**
 * GET /api/sugestoes
 * Retorna perguntas sugeridas para o usuário (PÚBLICO)
 */
app.get('/api/sugestoes', (req, res) => {
  const quantidade = Math.min(parseInt(req.query.q) || 4, 10);
  const sugestoes = getSugestoes(faq, quantidade);

  res.json({
    sugestoes,
    total: sugestoes.length
  });
});

// ============ ROTAS PROTEGIDAS (requerem autenticação) ============

/**
 * POST /api/chat
 * Processa uma pergunta do usuário (PÚBLICO - sem autenticação)
 * Body: { mensagem: string, userId?: string }
 */
app.post('/api/chat', async (req, res) => {
  const { mensagem, userId } = req.body;

  if (!mensagem || typeof mensagem !== 'string') {
    return res.status(400).json({
      erro: 'Mensagem é obrigatória',
      resposta: 'Por favor, digite uma mensagem para que eu possa ajudar.',
      tipoResposta: { tipo: 'conversacao', deveSerFalado: true }
    });
  }

  const pergunta = mensagem.trim();
  const user = userId || 'default';
  console.log('[Chat] Hmm... deixa eu conferir isso para você.');

  // FASE 7: Registra início da requisição
  const metricsCollector = getMetricsCollector();
  metricsCollector.recordRequestStart();

try {
    // 1. Busca na FAQ (compatibilidade)
    const resultadosFAQ = buscarNaFAQ(pergunta, faq);
    console.log(`[Chat] Resultados FAQ: ${resultadosFAQ.length}`);

    // 2. Processa com LLM + RAG + Tools + Memory + Router
    const resultado = await processarPergunta(pergunta, resultadosFAQ, user);

    console.log('[Chat] Encontrei o que você precisou.');
    console.log(`[Chat] Tipo: ${resultado.tipoResposta?.tipo || 'conversacao'}`);
    console.log(`[Chat] Deve falar: ${resultado.tipoResposta?.deveSerFalado}`);
    console.log(`[Chat] Resposta: "${resultado.resposta.substring(0, 100)}..."`);

    // 3. Retorna resposta com tipagem
    const responseData = {
      pergunta: pergunta,
      resposta: resultado.resposta,
      fonte: resultado.fonte,
      qualidade: resultado.qualidade,
      thumbnailUrl: resultado.thumbnailUrl,
      downloadUrl: resultado.downloadUrl,
      metadata: resultado.metadata,
      sugestoes: getSugestoes(faq, 3),
      faqRelacionada: resultadosFAQ.map(r => ({
        pergunta: r.pergunta,
        score: Math.round(r.score * 100)
      })),
      routing: resultado.routing,
      tools: resultado.tools,
      model: resultado.model,
      trace: resultado.trace,
      tipoResposta: resultado.tipoResposta,
      voice: resultado.voice
    };
    
    //ativa TTS automaticamente
    if (resultado.tipoResposta?.deveSerFalado) {
      try {
        const audio = await synthesize(resultado.resposta, {
          sentimento: resultado.voice?.sentimento,
          parametrosVoz: resultado.voice?.parametrosVoz,
          intencao: resultado.voice?.intencao
        });
        responseData.audio = {
          provider: audio.provider,
          mimeType: audio.mimeType,
          audioBase64: audio.audioBase64,
          fallback: audio.fallback
        };
        
        // Para streaming SSE, também envia o audio no evento 'done' via metadata
        // (o frontend streaming usa chamada separada /api/tts)
      } catch (ttsError) {
        console.warn(`[Chat] TTS falhou: ${ttsError.message}`);
        responseData.audio = { fallback: true, error: ttsError.message };
      }
    }
    
    res.json(responseData);

  } catch (error) {
    console.error('[Chat] Erro:', error.message);
    
    const errorResponse = {
      pergunta: pergunta,
      resposta: 'Desculpe, ocorreu um erro ao processar sua pergunta. Por favor, tente novamente.',
      fonte: 'erro',
      sugestoes: getSugestoes(faq, 3),
      faqRelacionada: [],
      tipoResposta: { tipo: 'conversacao', deveSerFalado: true }
    };
    
    try {
      const audio = await synthesize(errorResponse.resposta, {});
      errorResponse.audio = {
        provider: audio.provider,
        mimeType: audio.mimeType,
        audioBase64: audio.audioBase64,
        fallback: audio.fallback
      };
    } catch (ttsError) {
      errorResponse.audio = { fallback: true, error: ttsError.message };
    }
    
    res.json(errorResponse);
  } finally {
    metricsCollector.recordRequestEnd();
  }
});

/**
 * POST /api/chat/stream
 * Processa uma pergunta com streaming SSE (token-by-token) (PÚBLICO - sem autenticação)
 * Body: { mensagem: string, userId?: string }
 */
app.post('/api/chat/stream', async (req, res) => {
  const { mensagem, userId } = req.body;

  if (!mensagem || typeof mensagem !== 'string') {
    return res.status(400).json({
      erro: 'Mensagem é obrigatória'
    });
  }

  const pergunta = mensagem.trim();
  const user = userId || 'default';
  console.log(`[Chat-Stream] Pergunta: "${pergunta}" (user: ${user})`);

  // Busca na FAQ (compatibilidade)
  const resultadosFAQ = buscarNaFAQ(pergunta, faq);

  // Processa com streaming
  await processarPerguntaStream(pergunta, res, resultadosFAQ, user);
});

// ============ BOAS-VINDAS (saudação proativa por horário + nome) ============

/**
 * GET /api/chat/welcome
 *
 * Saudação de abertura de sessão, coerente com o horário real e
 * personalizada com o nome do usuário autenticado (Entra ID).
 * Chamado pelo frontend ao abrir a conversa.
 */
app.get('/api/chat/welcome', (req, res) => {
  try {
    const { gerarBoasVindas } = require('./agents/welcome-agent');

    // Nome vem do middleware de autenticação/personalização do Entra ID.
    const nomeUsuario = req.user?.displayName
      || res.locals.userInfo?.nome
      || null;

    const boasVindas = gerarBoasVindas({ nomeUsuario });

    res.json({
      mensagem: boasVindas.mensagem,
      saudacao: boasVindas.saudacao,
      periodo: boasVindas.periodo,
      comNome: boasVindas.comNome,
      autenticado: Boolean(req.user?.authenticated)
    });
  } catch (error) {
    console.error('[Welcome] Erro ao gerar boas-vindas:', error.message);
    res.status(500).json({ erro: 'Não foi possível gerar a saudação inicial.' });
  }
});

// ============ ROTAS DOS AGENTES ESPECIALISTAS (PÚBLICO) ============

app.get('/api/agentes', (req, res) => {
  const status = orchestrator.getStatusAgentes();

  // FASE 3: Inclui stats do router
  try {
    const router = getRouterAgent();
    status.router = router.getStats();
  } catch {}

  res.json(status);
});

// ============ ROTAS DE VOZ/PERSONALIDADE (PÚBLICO) ============

app.get('/api/knowledge-base/stats', async (req, res) => {
  try {
    const { getKnowledgeBase } = require('./knowledge-base');
    const kb = await getKnowledgeBase();
    res.json(kb.getStats());
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.get('/api/knowledge-base/contexto', async (req, res) => {
  try {
    const { getKnowledgeBase } = require('./knowledge-base');
    const kb = await getKnowledgeBase();
    const tipo = req.query.tipo || 'resumido'; // completo, resumido, otimizado
    const pergunta = req.query.q || '';

    let contexto;
    if (tipo === 'completo') {
      contexto = kb.getContextoCompleto();
    } else if (tipo === 'otimizado' && pergunta) {
      contexto = kb.getContextoOtimizado(pergunta);
    } else {
      contexto = kb.getContextoResumido();
    }

    res.json({
      tipo,
      contextoByte: contexto.length,
      contexto: contexto.substring(0, 5000) + (contexto.length > 5000 ? '...[truncado]' : '')
    });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.get('/api/voice/list', (req, res) => {
  try {
    const { getVoiceSpecialist } = require('./agents/voice-specialist');
    const voiceSpecialist = getVoiceSpecialist();
    res.json({
      vozes: voiceSpecialist.listVozes(),
      vozAtual: voiceSpecialist.getVozAtual()
    });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.post('/api/voice/set', (req, res) => {
  try {
    const { voz } = req.body;
    if (!voz) {
      return res.status(400).json({ erro: 'Parâmetro voz é obrigatório' });
    }
    
    const { getVoiceSpecialist } = require('./agents/voice-specialist');
    const voiceSpecialist = getVoiceSpecialist();
    const sucesso = voiceSpecialist.setVoz(voz);
    
    if (sucesso) {
      res.json({ 
        sucesso: true, 
        vozAtual: voiceSpecialist.getVozAtual(),
        info: voiceSpecialist.getVozInfo(voz)
      });
    } else {
      res.status(400).json({ erro: 'Voz não encontrada' });
    }
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.get('/api/voice/current', (req, res) => {
  try {
    const { getVoiceSpecialist } = require('./agents/voice-specialist');
    const voiceSpecialist = getVoiceSpecialist();
    const vozAtual = voiceSpecialist.getVozAtual();
    
    res.json({
      vozAtual,
      info: voiceSpecialist.getVozInfo(vozAtual)
    });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.post('/api/voice/orquestrator/process', (req, res) => {
  try {
    const { texto, contexto } = req.body;
    if (!texto) {
      return res.status(400).json({ erro: 'Parâmetro texto é obrigatório' });
    }
    
    const { getVoiceOrchestrator } = require('./agents/voice-orchestrator');
    const voiceOrchestrator = getVoiceOrchestrator();
    
    const resultado = voiceOrchestrator.processarRespostaComVoz(texto, texto, contexto || {});
    
    res.json({
      sucesso: true,
      resposta: resultado.resposta,
      ssml: resultado.ssml,
      ssmlCompleto: resultado.ssmlCompleto,
      cues: resultado.cues,
      parametrosVoz: resultado.parametrosVoz,
      sentimento: resultado.sentimento,
      intencao: resultado.intencao,
      personalidade: resultado.personalidade,
      metadados: resultado.metadados
    });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.get('/api/voice/orquestrator/diagnostico', (req, res) => {
  try {
    const { getVoiceOrchestrator } = require('./agents/voice-orchestrator');
    const voiceOrchestrator = getVoiceOrchestrator();
    
    const diagnostico = voiceOrchestrator.diagnosticar();
    
    res.json({
      sucesso: true,
      diagnostico
    });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

/**
 * POST /api/voice/tts
 * Sintetiza áudio neural (ElevenLabs / OpenAI / Azure) com fallback metadata.
 * Body: { texto, sentimento?, parametrosVoz?, intencao? }
 */
app.post('/api/voice/tts', async (req, res) => {
  try {
    const { texto, sentimento, parametrosVoz, intencao } = req.body || {};
    if (!texto || typeof texto !== 'string' || !texto.trim()) {
      return res.status(400).json({ erro: 'texto é obrigatório' });
    }
    if (texto.length > 5000) {
      return res.status(400).json({ erro: 'texto excede 5000 caracteres' });
    }

    const neuralTTS = require('./tts/neural-tts-service');
    const { gerarCuesFala } = require('./agents/tts-specialist');

    const contexto = { sentimento, parametrosVoz, intencao };
    const cuesData = gerarCuesFala(texto, contexto);
    const audio = await neuralTTS.synthesize(texto, contexto);

    res.json({
      sucesso: true,
      ...audio,
      cues: cuesData.cues,
      parametrosVoz: cuesData.parametros,
      sentimento: cuesData.sentimento,
      status: neuralTTS.getStatus()
    });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

/**
 * POST /api/tts
 * Alias para /api/voice/tts para consumo direto do frontend.
 * Recebe texto e retorna áudio gerado pelo neural-tts-service.
 */
app.post('/api/tts', async (req, res) => {
  try {
    const { texto, sentimento, parametrosVoz, intencao } = req.body || {};
    if (!texto || typeof texto !== 'string' || !texto.trim()) {
      return res.status(400).json({ erro: 'texto é obrigatório' });
    }
    if (texto.length > 5000) {
      return res.status(400).json({ erro: 'texto excede 5000 caracteres' });
    }

    const neuralTTS = require('./tts/neural-tts-service');
    let cuesData = { cues: [], parametros: parametrosVoz, sentimento };
    try {
      const { gerarCuesFala } = require('./agents/tts-specialist');
      if (gerarCuesFala) {
        cuesData = gerarCuesFala(texto, { sentimento, parametrosVoz, intencao });
      }
    } catch(e) {}

    const audio = await neuralTTS.synthesize(texto, { sentimento, parametrosVoz, intencao });

    res.json({
      sucesso: true,
      ...audio,
      status: neuralTTS.getStatus()
    });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.get('/api/voice/tts/status', (req, res) => {
  try {
    const neuralTTS = require('./tts/neural-tts-service');
    res.json({ sucesso: true, ...neuralTTS.getStatus() });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.post('/api/voice/orquestrator/personalidade', (req, res) => {
  try {
    const { personalidade } = req.body;
    if (!personalidade) {
      return res.status(400).json({ erro: 'Parâmetro personalidade é obrigatório' });
    }
    
    const { getVoiceOrchestrator } = require('./agents/voice-orchestrator');
    const voiceOrchestrator = getVoiceOrchestrator();
    
    const sucesso = voiceOrchestrator.alterarPersonalidade(personalidade);
    
    if (sucesso) {
      res.json({
        sucesso: true,
        personalidadeAtual: voiceOrchestrator.getPersonalidadeAtual()
      });
    } else {
      res.status(400).json({ erro: 'Personalidade não encontrada' });
    }
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

// ============ ROTAS DO DATA CENTER (PÚBLICO) ============

app.get('/api/datacenters', (req, res) => {
  try {
    const dataCenterLoader = getDataCenterLoader();
    const todos = dataCenterLoader.getAll();
    const stats = dataCenterLoader.getStats();
    
    res.json({
      datacenters: todos.map(dc => ({
        id: dc.id,
        titulo: dc.titulo,
        endereco: dc.endereco,
        numero: dc.numero,
        complemento: dc.complemento,
        bairro: dc.bairro,
        cep: dc.cep,
        cidade: dc.cidade,
        uf: dc.uf,
        telefone: dc.telefone
      })),
      stats,
      total: todos.length
    });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.get('/api/datacenters/by-cidade/:cidade', (req, res) => {
  try {
    const dataCenterLoader = getDataCenterLoader();
    const resultados = dataCenterLoader.findByCidade(req.params.cidade);
    
    res.json({
      cidade: req.params.cidade,
      datacenters: resultados.map(dc => ({
        id: dc.id,
        titulo: dc.titulo,
        endereco: dc.endereco,
        cidade: dc.cidade,
        uf: dc.uf,
        telefone: dc.telefone
      })),
      total: resultados.length
    });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.get('/api/datacenters/by-uf/:uf', (req, res) => {
  try {
    const dataCenterLoader = getDataCenterLoader();
    const resultados = dataCenterLoader.findByUF(req.params.uf);
    
    res.json({
      uf: req.params.uf,
      datacenters: resultados.map(dc => ({
        id: dc.id,
        titulo: dc.titulo,
        cidade: dc.cidade,
        uf: dc.uf,
        telefone: dc.telefone
      })),
      total: resultados.length
    });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.get('/api/datacenters/search', (req, res) => {
  try {
    const query = req.query.q || '';
    const dataCenterLoader = getDataCenterLoader();
    const resultados = dataCenterLoader.search(query);
    
    res.json({
      query,
      datacenters: resultados.map(dc => ({
        id: dc.id,
        titulo: dc.titulo,
        endereco: dc.endereco,
        cidade: dc.cidade,
        uf: dc.uf,
        telefone: dc.telefone,
        match: dc.enderecoCompleto
      })),
      total: resultados.length
    });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.get('/api/knowledge-gaps', (req, res) => {
  const limite = Math.min(parseInt(req.query.limite) || 10, 50);
  const pendentes = orchestrator.knowledgeGap.listarPerguntasPendentes(limite);
  const estatisticas = orchestrator.knowledgeGap.getEstatisticas();
  res.json({
    total: estatisticas.total,
    pendentes: estatisticas.pendentes,
    respondidas: estatisticas.respondidas,
    perguntas: pendentes.map(p => ({
      id: p.id,
      pergunta: p.pergunta,
      vezesPerguntada: p.vezesPerguntada,
      dataRegistro: p.dataRegistro
    }))
  });
});

// ============ QUALITY IMPROVEMENT AGENT (PÚBLICO) ============

app.get('/api/quality/dashboard', async (req, res) => {
  try {
    const dashboard = await orchestrator.qualityAgent.getDashboard();
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.post('/api/quality/evaluate', roleGuard(['admin', 'gerente']), async (req, res) => {
  try {
    const result = await orchestrator.qualityAgent.runEvaluation();
    res.json({ sucesso: true, ...result });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.post('/api/quality/config', roleGuard(['admin']), async (req, res) => {
  try {
    const agent = require('./agents/quality-improvement-agent').getQualityImprovementAgent();
    const newConfig = agent.updateConfig(req.body);
    res.json({ sucesso: true, config: newConfig });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

// ============ ROTAS DOS GUARDIÕES (PÚBLICO) ============

app.get('/api/guardians', (req, res) => {
  const relatorio = systemGuardian.gerarRelatorio({
    servidorOnline: true,
    faq: faq.length,
    llmDisponivel,
    providerNome: providerInfo.nome
  });

  const integridadeFAQ = knowledgeGuardian.verificarIntegridade(faq);
  const snapshotCodigo = codeGuardian.gerarSnapshot();

  res.json({
    guardian1: {
      nome: 'Knowledge Guardian',
      descricao: 'Protege a base de conhecimento',
      relatorio: integridadeFAQ
    },
    guardian2: {
      nome: 'Code Guardian',
      descricao: 'Protege a qualidade do código',
      relatorio: snapshotCodigo
    },
    guardian3: {
      nome: 'System Guardian',
      descricao: 'Protege a arquitetura do sistema',
      relatorio: relatorio
    }
  });
});

app.get('/api/faq/integridade', (req, res) => {
  const integridade = knowledgeGuardian.verificarIntegridade(faq);
  res.json(integridade);
});

app.post('/api/chat/reset', roleGuard(['admin', 'gerente']), (req, res) => {
  limparHistorico();
  res.json({ mensagem: 'Histórico da conversa resetado com sucesso!' });
});

// ============ FASE 1: ROTAS DO RAG (PÚBLICO) ============

app.get('/api/rag/stats', async (req, res) => {
  try {
    const ragService = getRAGService();
    const stats = await ragService.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.post('/api/rag/index', roleGuard(['admin']), async (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) {
      return res.status(400).json({ erro: 'filePath é obrigatório' });
    }
    const ragService = getRAGService();
    const result = await ragService.indexFile(filePath);
    res.json({ sucesso: true, ...result });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.post('/api/rag/index-url', roleGuard(['admin']), async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ erro: 'url é obrigatório' });
    }
    const ragService = getRAGService();
    const result = await ragService.indexURL(url);
    res.json({ sucesso: true, ...result });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.post('/api/rag/index-text', roleGuard(['admin']), async (req, res) => {
  try {
    const { text, metadata } = req.body;
    if (!text) {
      return res.status(400).json({ erro: 'text é obrigatório' });
    }
    const ragService = getRAGService();
    const result = await ragService.indexText(text, metadata);
    res.json({ sucesso: true, ...result });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.post('/api/rag/search', async (req, res) => {
  try {
    const { query, topK } = req.body;
    if (!query) {
      return res.status(400).json({ erro: 'query é obrigatório' });
    }
    const ragService = getRAGService();
    const { results, validation } = await ragService.retrieve(query, topK || 5);
    res.json({ results, total: results.length, validation });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

// ============ ROTAS DE CONSULTA E INDEXAÇÃO DE PDF (PÚBLICO) ============

app.post('/api/pdf/index', roleGuard(['admin']), async (req, res) => {
  try {
    const { getPDFWorkspaceIndexer } = require('./rag/pdf-workspace-indexer');
    const indexer = getPDFWorkspaceIndexer();
    const result = await indexer.indexAllWorkspacePDFs();
    res.json({ sucesso: true, ...result });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.post('/api/pdf/ask', async (req, res) => {
  try {
    const pergunta = req.body.pergunta || req.body.query || req.body.question;
    if (!pergunta) {
      return res.status(400).json({ erro: 'O parâmetro "pergunta" é obrigatório.' });
    }
    const { getPDFWorkspaceIndexer } = require('./rag/pdf-workspace-indexer');
    const indexer = getPDFWorkspaceIndexer();
    const resultado = await indexer.askPDF(pergunta);
    res.json({ sucesso: true, ...resultado });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.get('/api/pdf/list', async (req, res) => {
  try {
    const { getPDFWorkspaceIndexer } = require('./rag/pdf-workspace-indexer');
    const indexer = getPDFWorkspaceIndexer();
    const files = indexer.findPDFFiles();
    res.json({
      totalFiles: files.length,
      files: files.map(f => ({
        fileName: path.basename(f),
        filePath: f,
        sizeBytes: require('fs').statSync(f).size
      }))
    });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.delete('/api/rag/clear', roleGuard(['admin']), async (req, res) => {
  try {
    const ragService = getRAGService();
    await ragService.clear();
    res.json({ sucesso: true, mensagem: 'Base RAG limpa' });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

// ============ FASE 2: ROTAS DE TOOLS (PÚBLICO) ============

app.get('/api/tools', (req, res) => {
  const toolRegistry = getToolRegistry();
  res.json({
    tools: toolRegistry.getToolDefinitions(),
    stats: toolRegistry.getStats()
  });
});

app.get('/api/tools/stats', (req, res) => {
  const toolRegistry = getToolRegistry();
  res.json(toolRegistry.getStats());
});

app.post('/api/tools/execute', async (req, res) => {
  try {
    const { tool, params } = req.body;
    if (!tool) {
      return res.status(400).json({ erro: 'tool é obrigatório' });
    }
    const toolRegistry = getToolRegistry();
    const result = await toolRegistry.executeTool(tool, params || {});
    res.json(result);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

// ============ FASE 4: ROTAS DE MEMÓRIA (PÚBLICO) ============

app.get('/api/memory/stats', async (req, res) => {
  try {
    const memoryManager = getMemoryManager();
    const stats = await memoryManager.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.get('/api/memory/facts', async (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    const memoryManager = getMemoryManager();
    const facts = await memoryManager.recallFacts(userId, '');
    res.json({ userId, facts, total: facts.length });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.post('/api/memory/reset', roleGuard(['admin', 'gerente']), async (req, res) => {
  try {
    const userId = req.body.userId || 'default';
    const memoryManager = getMemoryManager();
    await memoryManager.newSession(userId);
    res.json({ sucesso: true, mensagem: `Memória resetada para usuário ${userId}` });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

// ============ FASE 6: ROTAS DE MULTIMODALIDADE (PÚBLICO) ============

app.post('/api/upload', roleGuard(['admin', 'gerente']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
    }

    const fileProcessor = getFileProcessor();
    const result = await fileProcessor.processFile(req.file);

    res.json({
      sucesso: true,
      fileName: req.file.originalname,
      size: req.file.size,
      indexed: result.indexed,
      chunks: result.chunks || 0,
      metadata: result.metadata,
      contentPreview: result.content ? result.content.substring(0, 500) : ''
    });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.get('/api/upload/supported-types', (req, res) => {
  const fileProcessor = getFileProcessor();
  res.json({ types: fileProcessor.getSupportedTypes() });
});

// ============ ROTAS DE DOCUMENTOS (THUMBNAIL E DOWNLOAD) ============

app.get('/api/documents/:filename/thumbnail', async (req, res) => {
  try {
    const { filename } = req.params;
    const { page } = req.query || { page: 1 };
    
    // Decodifica o nome do arquivo
    const decodedFilename = decodeURIComponent(filename);
    
    // Busca o caminho do documento no RAG
    const { getRAGService } = require('./rag/rag-service');
    const ragService = getRAGService();
    const stats = await ragService.getStats();
    const sources = stats.sources || {};
    
    // Encontra o documento pelo nome
    let pdfPath = null;
    for (const sourcePath of Object.keys(sources)) {
      const sourceName = sourcePath.split(/[\/\\]/).pop();
      if (sourceName === decodedFilename || sourceName.toLowerCase() === decodedFilename.toLowerCase()) {
        pdfPath = sourcePath;
        break;
      }
    }
    
    if (!pdfPath) {
      return res.status(404).json({ erro: 'Documento não encontrado' });
    }
    
    // Verifica se o arquivo existe
    if (!require('fs').existsSync(pdfPath)) {
      return res.status(404).json({ erro: 'Arquivo não encontrado no servidor' });
    }
    
    // Gera thumbnail
    const thumbnailService = getPDFThumbnailService();
    const thumbnailBuffer = await thumbnailService.generateThumbnailBuffer(pdfPath, parseInt(page) || 1);
    
    // Retorna a imagem
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400'); // Cache por 24 horas
    res.send(thumbnailBuffer);
    
  } catch (error) {
    console.error('[Server] Erro ao gerar thumbnail:', error.message);
    res.status(500).json({ erro: error.message });
  }
});

app.get('/api/documents/:filename/download', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Decodifica o nome do arquivo
    const decodedFilename = decodeURIComponent(filename);
    
    // Busca o caminho do documento no RAG
    const { getRAGService } = require('./rag/rag-service');
    const ragService = getRAGService();
    const stats = await ragService.getStats();
    const sources = stats.sources || {};
    
    // Encontra o documento pelo nome
    let pdfPath = null;
    for (const sourcePath of Object.keys(sources)) {
      const sourceName = sourcePath.split(/[\/\\]/).pop();
      if (sourceName === decodedFilename || sourceName.toLowerCase() === decodedFilename.toLowerCase()) {
        pdfPath = sourcePath;
        break;
      }
    }
    
    if (!pdfPath) {
      return res.status(404).json({ erro: 'Documento não encontrado' });
    }
    
    // Verifica se o arquivo existe
    if (!require('fs').existsSync(pdfPath)) {
      return res.status(404).json({ erro: 'Arquivo não encontrado no servidor' });
    }
    
    // Retorna o arquivo para download
    res.download(pdfPath, decodedFilename);
    
  } catch (error) {
    console.error('[Server] Erro ao fazer download:', error.message);
    res.status(500).json({ erro: error.message });
  }
});

// ============ FASE 7: ROTAS DE OBSERVABILIDADE (PÚBLICO) ============

app.get('/api/observability/dashboard', roleGuard(['admin']), async (req, res) => {
  try {
    const metricsCollector = getMetricsCollector();
    const dashboard = await metricsCollector.getDashboard();
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.get('/api/observability/traces', roleGuard(['admin']), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const tracer = getTracer();
    const traces = await tracer.getRecentTraces(limit);
    res.json({ traces, total: traces.length });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.get('/api/observability/stats', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const tracer = getTracer();
    const stats = await tracer.getStats(hours);
    
    let cacheStats = {};
    try {
      const cacheManager = require('./cache/redis-cache').getCacheManager();
      cacheStats = cacheManager.getStats();
    } catch {}
    
    res.json({ ...stats, cache: cacheStats });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

// ============ FASE 8.1: CACHE STATS (PÚBLICO) ============

app.get('/api/cache/stats', async (req, res) => {
  try {
    const cacheManager = require('./cache/redis-cache').getCacheManager();
    res.json(cacheManager.getStats());
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.post('/api/cache/clear', roleGuard(['admin']), async (req, res) => {
  try {
    const cacheManager = require('./cache/redis-cache').getCacheManager();
    await cacheManager.clear();
    res.json({ sucesso: true, mensagem: 'Cache limpo' });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

// ============ FASE 8: ROTAS DE SMART MODEL SELECTION (PÚBLICO) ============

app.get('/api/model/complexity', (req, res) => {
  const query = req.query.q || '';
  if (!query) {
    return res.status(400).json({ erro: 'Parâmetro q é obrigatório' });
  }
  const complexity = classifyComplexity(query);
  const smartModel = selectSmartModel(query);
  res.json({ query, complexity, recommendation: smartModel });
});

// ============ FALLBACK PARA SPA ============

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// ============ INICIALIZA O SERVIDOR ============

/**
 * Detecta IPs da rede local para exibir URLs acessíveis
 */
function getNetworkIPs() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Ignora IPv6 e endereços internos (loopback)
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

if (require.main === module) {
  inicializar().then(() => {
    const HOST = process.env.HOST || '0.0.0.0';
    app.listen(PORT, HOST, () => {
      const networkIPs = getNetworkIPs();

       console.log('\n🚀 Chatbot Charles v4.2 rodando!');
      console.log(`\n   📌 Acesso local:    http://localhost:${PORT}`);

      if (networkIPs.length > 0) {
        console.log('   🌐 Acesso na rede:');
        networkIPs.forEach(ip => {
          console.log(`      http://${ip}:${PORT}`);
        });
        console.log('\n   💡 Compartilhe um dos endereços acima com outros');
        console.log('      computadores da mesma rede local (LAN/Wi-Fi).');
      }

      console.log(`\n📊 API:        http://localhost:${PORT}/api/status`);
      console.log(`📈 Dashboard:  http://localhost:${PORT}/api/observability/dashboard`);
      console.log(`🔧 Tools:      http://localhost:${PORT}/api/tools`);
      console.log(`🧠 Memory:     http://localhost:${PORT}/api/memory/stats`);
      console.log(`📚 RAG:        http://localhost:${PORT}/api/rag/stats`);
      const secBoot = getSecurityStatus(authConfig);
      console.log(`🔐 Segurança:  nível ${secBoot.nivel}/10 — ${secBoot.resumo}\n`);
    });
  });
}

module.exports = { app, inicializar };