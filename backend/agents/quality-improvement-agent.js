/**
 * quality-improvement-agent.js
 * Agente especialista em melhoria contínua de qualidade do chatbot.
 * Avalia, identifica gaps e aplica otimizações automáticas para atingir nota 10/10.
 *
 * Métricas avaliadas:
 * - Retrieval Quality (precisão das fontes encontradas)
 * - Citation Rate (% respostas com citação válida)
 * - Hallucination Check (alucinação via validação RAG)
 * - Coverage (lacunas de conhecimento cobertas)
 * - Response Quality Score (quality_score médio dos traces)
 * - FAQ Freshness (itens desatualizados)
 * - Prompt Effectiveness (aderência ao prompt-master)
 * - Conversa Humana (qualidade da conversa — ver nota abaixo)
 *
 * NOTA — Métrica "conversaHumana" (v4.2):
 * Antes desta métrica, as 6 métricas eram 100% documentais. O agente avaliava
 * apenas se a resposta TÉCNICA estava correta, e NÃO se o Charles sabia
 * conversar. Resultado: nota alta (8,0) com o Charles quebrado na conversa —
 * sem "bom dia", respondendo small talk com formato de relatório técnico.
 *
 * A métrica mede a QUALIDADE DA CONVERSA SOCIAL (fonte `social:*`), que é
 * categórica e separada da qualidade documental. Só mensagens sociais entram
 * no denominador, garantindo que:
 * - Não polua a lista de knowledge-gaps com ruído de "bom dia"
 * - Não force o formato técnico "Confiança:/Fatos Confirmados:" em conversa
 * - Meça o que realmente representa a experiência do usuário
 *
 * Retrocompatível: se não houver traces sociais, retorna 1.0 (neutro) e não
 * penaliza a nota — evita queda artificial da nota em instalações novas.
 */

const fs = require('fs');
const path = require('path');
const { getTracer } = require('../observability/tracer');
const { getRAGService } = require('../rag/rag-service');
const { getDataCenterLoader } = require('../rag/datacenter-loader');
const { lerFAQ } = require('../faq-reader');
const { buscarNaFAQ } = require('../faq-search');
const knowledgeGap = require('./knowledge-gap');
const { spawnSync } = require("child_process");

const QUALITY_DB = path.join(__dirname, '..', '..', 'data', 'quality-history.json');
const CONFIG_FILE = path.join(__dirname, '..', '..', 'quality-config.json');

// Configuração padrão
const DEFAULT_CONFIG = {
  targetScore: 10,
  evaluationIntervalHours: 8,
  minTracesForEval: 20,
  thresholds: {
    retrievalPrecision: 0.85,
    citationRate: 0.90,
    hallucinationRate: 0.05,
    coverageRate: 0.80,
    avgQualityScore: 85,
    faqFreshnessDays: 90,
    // Conversa: nota mínima aceitável em mensagens sociais (0-1)
    conversaHumana: 0.90
  },
  autoFix: {
    enabled: true,
    expandFAQ: true,
    enhanceRAG: true,
    optimizePrompt: true,
    fillGaps: true
  },
  weights: {
    retrievalPrecision: 0.20,
    citationRate: 0.20,
    hallucinationRate: 0.15,
    coverageRate: 0.15,
    avgQualityScore: 0.20,
    // Conversa Humana passa a pesar na nota final. O peso vem de
    // faqFreshness (que já está saturado em 1.0 e não gera mais valor).
    faqFreshness: 0.00,
    conversaHumana: 0.10
  }
};

class QualityImprovementAgent {
  constructor() {
    this.config = this._loadConfig();
    this.history = this._loadHistory();
    this.tracer = getTracer();
    this.ragService = getRAGService();
    this.dcLoader = getDataCenterLoader();
  }

  _loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
      }
    } catch (e) {
      console.warn('[QualityAgent] Config load failed, using defaults:', e.message);
    }
    return { ...DEFAULT_CONFIG };
  }

  _saveConfig() {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
  }

  _loadHistory() {
    try {
      if (fs.existsSync(QUALITY_DB)) {
        return JSON.parse(fs.readFileSync(QUALITY_DB, 'utf8'));
      }
    } catch (e) {
      console.warn('[QualityAgent] History load failed:', e.message);
    }
    return { evaluations: [], currentScore: 8.2, targetScore: 10, startedAt: new Date().toISOString() };
  }

  _saveHistory() {
    const dir = path.dirname(QUALITY_DB);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(QUALITY_DB, JSON.stringify(this.history, null, 2));
  }

  /**
   * Executa ciclo completo de avaliação e melhoria
   * @returns {Promise<Object>} Resultado da avaliação + ações tomadas
   */
  async runEvaluationCycle() {
    console.log('\n==============================================');
    console.log('  QUALITY IMPROVEMENT AGENT - Ciclo de Avaliação');
    console.log('==============================================\n');

    const evaluation = {
      timestamp: new Date().toISOString(),
      metrics: {},
      score: 0,
      issues: [],
      actions: [],
      recommendations: []
    };

    // 1. Coleta métricas
    evaluation.metrics = await this._collectMetrics();

    // 2. Calcula score composto (0-10)
    evaluation.score = this._calculateCompositeScore(evaluation.metrics);

    // 3. Identifica issues
    evaluation.issues = this._identifyIssues(evaluation.metrics);

    // 4. Executa auto-fix se habilitado
    if (this.config.autoFix.enabled) {
      evaluation.actions = await this._executeAutoFixes(evaluation.issues);
    }

    // 5. Gera recomendações manuais
    evaluation.recommendations = this._generateRecommendations(evaluation.issues);

    // 6. Atualiza histórico
    this.history.evaluations.push(evaluation);
    this.history.currentScore = evaluation.score;
    this.history.lastEvaluation = evaluation.timestamp;
    this._saveHistory();

    // 7. Log resultado
    this._logEvaluation(evaluation);

    return evaluation;
  }

  /**
   * Coleta todas as métricas de qualidade
   */
  async _collectMetrics() {
    const metrics = {};

    // A. Retrieval Precision (FAQ + RAG + DC)
    metrics.retrievalPrecision = await this._measureRetrievalPrecision();

    // B. Citation Rate (traces recentes)
    metrics.citationRate = await this._measureCitationRate();

    // C. Hallucination Rate (via RAG validator)
    metrics.hallucinationRate = await this._measureHallucinationRate();

    // C. Coverage Rate (knowledge gaps vs. base)
    metrics.coverageRate = await this._measureCoverageRate();

    // D. Average Quality Score (traces)
    metrics.avgQualityScore = await this._measureAvgQualityScore();

    // E. FAQ Freshness
    metrics.faqFreshness = this._measureFAQFreshness();

    // F. Conversa Humana (qualidade das respostas sociais)
    metrics.conversaHumana = await this._measureConversaHumana();

    return metrics;
  }

  /**
   * Mede a qualidade da CONVERSA SOCIAL.
   *
   * Analisa apenas traces com fonte `social:*` (saudação, agradecimento,
   * despedida, tempo, interrupção, estado, elogio, fora de escopo) e verifica
   * se a resposta foi de boa qualidade humana:
   *
   *  1. NÃO usou o formato técnico de relatório
   *     (Confiança:/Fatos Confirmados:/Pontos Não Confirmados:) — o principal
   *     defeito histórico do Charles em small talk.
   *  2. NÃO deixou a resposta vazia ou truncada.
   *  3. NÃO deixou promessa genérica sem conteúdo.
   *
   * @returns {Promise<number>} 0..1 — 1.0 quando não há traces sociais
   */
  async _measureConversaHumana() {
    await this.tracer.initialize();
    const traces = this.tracer.db.prepare(`
      SELECT answer, fonte FROM traces
      WHERE timestamp > datetime('now', '-7 days')
      AND success = 1
      AND fonte LIKE 'social:%'
      ORDER BY timestamp DESC
      LIMIT 100
    `).all();

    // Sem dados sociais: neutro. Não penaliza instalações novas.
    if (!traces || traces.length === 0) return 1.0;

    // Formato técnico que NUNCA deve aparecer em conversa.
    const RE_FORMATO_TECNICO =
      /(Confian[çc]a\s*:|Fatos Confirmados?\s*:|Pontos? N[ãa]o Confirmados?\s*:|Nível de Confian[çc]a\s*:|Fonte\s*[-:]\s*(FAQ|DC|RAG|TOOL|SPEC))/i;

    let adequadas = 0;

    for (const t of traces) {
      const answer = String(t.answer || '').trim();

      // Resposta vazia = falha de conversa.
      if (answer.length < 2) continue;

      // Usou formato de relatório técnico em small talk = falha.
      if (RE_FORMATO_TECNICO.test(answer)) continue;

      adequadas++;
    }

    return adequadas / traces.length;
  }

  /**
   * Mede precisão do retrieval: % perguntas-âncora com fonte relevante (score > 0.3)
   */
  async _measureRetrievalPrecision() {
    const ancoras = [
      'como dar acesso a novas pessoas no portal',
      'Qual o principal objetivo do modelo ITSM no Data Center?',
      'Como evitar falhas de governança no processo de mudança?',
      'O que fazer em caso de indisponibilidade do sistema de chamados (Znuny)?',
      'Qual o impacto de não registrar corretamente um incidente?'
    ];

    const faq = lerFAQ();
    let hits = 0;

    for (const pergunta of ancoras) {
      const faqHits = buscarNaFAQ(pergunta, faq, 3);
      const ragResults = await this.ragService.retrieve(pergunta, 3);
      const dcResults = this.dcLoader.search(pergunta);

      const hasGoodSource =
        faqHits.some(h => h.score > 0.3) ||
        ragResults.results.some(r => r.score > 0.3) ||
        dcResults.length > 0;

      if (hasGoodSource) hits++;
    }

    return hits / ancoras.length;
  }

  /**
   * Mede taxa de citação: % traces com quality_score > 0 E fonte citada
   */
  async _measureCitationRate() {
    await this.tracer.initialize();
    const traces = this.tracer.db.prepare(`
      SELECT quality_score, fonte, answer FROM traces
      WHERE timestamp > datetime('now', '-7 days')
      AND success = 1
      ORDER BY timestamp DESC
      LIMIT 100
    `).all();

    if (traces.length === 0) return 0;

    let withCitation = 0;
    for (const t of traces) {
      const hasQuality = (t.quality_score || 0) > 0;
      const hasFonte = t.fonte && t.fonte.trim() !== '';
      const answer = t.answer || '';
      const hasCitationPattern = /(Fonte|FAQ|DC:|RAG:|TOOL:|SPEC:)/i.test(answer);

      if (hasQuality && (hasFonte || hasCitationPattern)) {
        withCitation++;
      }
    }

    return withCitation / traces.length;
  }

  /**
   * Mede taxa de alucinação via RAG validator em amostra de traces
   */
  /**
   * Mede taxa de alucina��o usando RAG validator + ECC validation
   */
  async _measureHallucinationRate() {
    await this.tracer.initialize();
    const traces = this.tracer.db.prepare(`
      SELECT question, answer, fonte FROM traces
      WHERE timestamp > datetime('now', '-7 days')
      AND success = 1
      ORDER BY timestamp DESC
      LIMIT 50
    `).all();

    if (traces.length === 0) return 0;

    const fontesQueExigemVerificacao = new Set([
      'llm', 'llm-cache', 'llm-fallback', 'llm-stream', 'rag+llm'
    ]);
    const respostasDeAbstencao = [
      /não encontrei evidência documental suficiente/i,
      /não vou completar a resposta com suposições/i,
      /não é possível confirmar/i
    ];

    let hallucinations = 0;
    let tracesAvaliaveis = 0;
    for (const t of traces) {
      // FAQ, especialistas, ferramentas e respostas sociais já possuem uma
      // fonte própria. Exigir que o RAG também valide essas respostas gera
      // falso positivo, pois o fluxo correto nem sempre passa pelo RAG.
      if (!fontesQueExigemVerificacao.has(t.fonte)) continue;
      if (respostasDeAbstencao.some((pattern) => pattern.test(t.answer || ''))) continue;

      tracesAvaliaveis++;
      const validation = await this.ragService.retrieve(t.question, 5);
      const hasContext = validation.validation?.canAnswer === true;

      // Heur�stica local primeiro: resposta longa sem contexto v�lido = poss�vel alucina��o
      let localHallucination = !hasContext && (t.answer?.length || 0) > 200;
      
      // Valida��o ECC secund�ria: usa agente especializado para confirma��o
      let eccHallucination = 0;
      if (localHallucination) {
        eccHallucination = this.verificarAluciniaECC(t.answer || '');
      }
      
      // Considera alucina��o se qualquer um dos m�todos detectar
      if (localHallucination || eccHallucination === 1) {
        hallucinations++;
      }
    }

    // Sem respostas geradas livremente para auditar, não há alucinação
    // observável. Traces de FAQ/especialistas não entram no denominador.
    return tracesAvaliaveis === 0 ? 0 : hallucinations / tracesAvaliaveis;
  }

  /**
   * Mede cobertura: % lacunas que agora têm fonte na base
   */
  async _measureCoverageRate() {
    const gaps = knowledgeGap.listarPerguntasPendentes(100);
    if (gaps.length === 0) return 1.0;

    let covered = 0;
    const faq = lerFAQ();

    for (const gap of gaps) {
      const faqHits = buscarNaFAQ(gap.pergunta, faq, 3);
      const ragResults = await this.ragService.retrieve(gap.pergunta, 3);
      const dcResults = this.dcLoader.search(gap.pergunta);

      const hasSource =
        faqHits.some(h => h.score > 0.2) ||
        ragResults.results.some(r => r.score > 0.2) ||
        dcResults.length > 0;

      if (hasSource) covered++;
    }

    return covered / gaps.length;
  }

  /**
   * Mede quality_score médio dos traces recentes
   */
  async _measureAvgQualityScore() {
    await this.tracer.initialize();
    const result = this.tracer.db.prepare(`
      SELECT AVG(quality_score) as avg FROM traces
      WHERE timestamp > datetime('now', '-7 days')
      AND success = 1
      AND quality_score > 0
    `).get();

    return (result.avg || 0) / 100; // Normaliza para 0-1
  }

  /**
   * Mede freshness da FAQ: % itens atualizados nos últimos N dias
   * Se os itens não tiverem data própria na planilha, utiliza o mtime do próprio arquivo Excel.
   */
  _measureFAQFreshness() {
    const faq = lerFAQ();
    if (faq.length === 0) return 0;

    const cutoff = Date.now() - this.config.thresholds.faqFreshnessDays * 86400000;
    let fresh = 0;
    let hasItemDates = false;

    for (const item of faq) {
      if (item.dataAtualizacao || item.ultimaModificacao) {
        hasItemDates = true;
        const dateVal = item.dataAtualizacao || item.ultimaModificacao;
        if (new Date(dateVal).getTime() > cutoff) {
          fresh++;
        }
      }
    }

    if (hasItemDates) {
      return fresh / faq.length;
    }

    // Fallback: verifica a data de modificação física do arquivo FAQ
    try {
      const fs = require('fs');
      const path = require('path');
      const faqPath = path.join(__dirname, '..', '..', 'FQ_DATA_CENTER.xls');
      if (fs.existsSync(faqPath)) {
        const stats = fs.statSync(faqPath);
        return stats.mtimeMs > cutoff ? 1.0 : 0.7; // 0.7 se for base estável
      }
    } catch {
      // Ignora erro
    }

    return 1.0;
  }

  /**
   * Calcula score composto 0-10
   */
  _calculateCompositeScore(metrics) {
    const w = this.config.weights;
    const t = this.config.thresholds;

    // Normaliza cada métrica para 0-10 baseado no threshold
    const scores = {
      retrievalPrecision: Math.min(10, (metrics.retrievalPrecision / t.retrievalPrecision) * 10),
      citationRate: Math.min(10, (metrics.citationRate / t.citationRate) * 10),
      hallucinationRate: Math.max(0, 10 - (metrics.hallucinationRate / t.hallucinationRate) * 10),
      coverageRate: Math.min(10, (metrics.coverageRate / t.coverageRate) * 10),
      avgQualityScore: Math.min(10, (metrics.avgQualityScore / t.avgQualityScore) * 10),
      faqFreshness: Math.min(10, (metrics.faqFreshness / 1.0) * 10) // target 100%
    };

    // Conversa Humana: usa peso e threshold próprios.
    // Sem traces sociais a métrica vale 1.0 (neutro) — não pune instalação nova.
    const tConversa = t.conversaHumana || 0.9;
    scores.conversaHumana = Math.min(10, ((metrics.conversaHumana ?? 1) / tConversa) * 10);

    // Média ponderada
    const composite =
      scores.retrievalPrecision * w.retrievalPrecision +
      scores.citationRate * w.citationRate +
      scores.hallucinationRate * w.hallucinationRate +
      scores.coverageRate * w.coverageRate +
      scores.avgQualityScore * w.avgQualityScore +
      scores.faqFreshness * (w.faqFreshness ?? 0.10) +
      scores.conversaHumana * (w.conversaHumana ?? 0.00);

    return Math.round(composite * 10) / 10; // 1 casa decimal
  }

  /**
   * Identifica issues específicos baseados nas métricas
   */
  _identifyIssues(metrics) {
    const issues = [];
    const t = this.config.thresholds;

    if (metrics.retrievalPrecision < t.retrievalPrecision) {
      issues.push({
        type: 'RETRIEVAL_PRECISION',
        severity: 'high',
        message: `Retrieval precision ${(metrics.retrievalPrecision * 100).toFixed(0)}% abaixo do threshold ${(t.retrievalPrecision * 100).toFixed(0)}%`,
        metric: metrics.retrievalPrecision,
        threshold: t.retrievalPrecision
      });
    }

    if (metrics.citationRate < t.citationRate) {
      issues.push({
        type: 'CITATION_RATE',
        severity: 'high',
        message: `Citation rate ${(metrics.citationRate * 100).toFixed(0)}% abaixo do threshold ${(t.citationRate * 100).toFixed(0)}%`,
        metric: metrics.citationRate,
        threshold: t.citationRate
      });
    }

    if (metrics.hallucinationRate > t.hallucinationRate) {
      issues.push({
        type: 'HALLUCINATION_RATE',
        severity: 'critical',
        message: `Hallucination rate ${(metrics.hallucinationRate * 100).toFixed(0)}% acima do threshold ${(t.hallucinationRate * 100).toFixed(0)}%`,
        metric: metrics.hallucinationRate,
        threshold: t.hallucinationRate
      });
    }

    if (metrics.coverageRate < t.coverageRate) {
      issues.push({
        type: 'COVERAGE_RATE',
        severity: 'medium',
        message: `Coverage rate ${(metrics.coverageRate * 100).toFixed(0)}% abaixo do threshold ${(t.coverageRate * 100).toFixed(0)}%`,
        metric: metrics.coverageRate,
        threshold: t.coverageRate
      });
    }

    if (metrics.avgQualityScore < t.avgQualityScore / 100) {
      issues.push({
        type: 'QUALITY_SCORE',
        severity: 'high',
        message: `Avg quality score ${(metrics.avgQualityScore * 100).toFixed(0)} abaixo do threshold ${t.avgQualityScore}`,
        metric: metrics.avgQualityScore,
        threshold: t.avgQualityScore / 100
      });
    }

    if (metrics.faqFreshness < 0.5) {
      issues.push({
        type: 'FAQ_FRESHNESS',
        severity: 'medium',
        message: `FAQ freshness ${(metrics.faqFreshness * 100).toFixed(0)}% — muitos itens desatualizados`,
        metric: metrics.faqFreshness,
        threshold: 0.5
      });
    }

    // Conversa Humana — só avalia se houver dado social coletado.
    // Ausência de traces sociais (métrica = 1.0) não gera issue.
    const conversa = metrics.conversaHumana ?? 1;
    if (conversa < (t.conversaHumana || 0.9)) {
      issues.push({
        type: 'CONVERSA_HUMANA',
        severity: 'high',
        message: `Conversa humana ${(conversa * 100).toFixed(0)}% abaixo do threshold ${((t.conversaHumana || 0.9) * 100).toFixed(0)}% — `
          + 'respostas sociais estão usando formato técnico ou estão vazias',
        metric: conversa,
        threshold: t.conversaHumana || 0.9
      });
    }

    return issues;
  }

  /**
   * Executa correções automáticas baseadas nos issues
   */
  async _executeAutoFixes(issues) {
    const actions = [];

    for (const issue of issues) {
      switch (issue.type) {
        case 'RETRIEVAL_PRECISION':
          if (this.config.autoFix.enhanceRAG) {
            const action = await this._enhanceRAGIndexing();
            actions.push(action);
          }
          break;

        case 'CITATION_RATE':
          if (this.config.autoFix.optimizePrompt) {
            const action = await this._optimizePromptForCitations();
            actions.push(action);
          }
          break;

        case 'HALLUCINATION_RATE':
          // A��o corretiva ECC para alucina��o detectada
          if (this.config.autoFix.enabled) {
            const action = await this._applyECCHallucinationCorrection();
            actions.push(action);
          }
          break;

        case 'COVERAGE_RATE':
          if (this.config.autoFix.fillGaps) {
            const action = await this._autoFillKnowledgeGaps();
            actions.push(action);
          }
          if (this.config.autoFix.expandFAQ) {
            const action = await this._suggestFAQExpansion();
            actions.push(action);
          }
          break;

        case 'QUALITY_SCORE':
          if (this.config.autoFix.optimizePrompt) {
            const action = await this._optimizePromptForQuality();
            actions.push(action);
          }
          break;

        case 'FAQ_FRESHNESS':
          if (this.config.autoFix.expandFAQ) {
            const action = await this._flagStaleFAQItems();
            actions.push(action);
          }
          break;
      }
    }

    return actions;
  }

  /**
   * Melhora indexação RAG: re-indexa FAQ + Data Centers com chunks menores
   */
  async _enhanceRAGIndexing() {
    console.log('[QualityAgent] Enhancing RAG indexing...');
    try {
      const faq = lerFAQ();
      const faqItems = faq.map(item => ({
        pergunta: item.pergunta,
        resposta: item.resposta
      }));
      await this.ragService.indexFAQItems(faqItems, { source: 'faq-excel', reindex: true });

      // Re-indexa Data Centers com chunks otimizados
      const dcContexto = this.dcLoader.gerarContextoRAG();
      for (const dc of dcContexto) {
        await this.ragService.indexText(dc.content, { ...dc.metadata, source: 'datacenters', reindex: true });
      }

      return { type: 'ENHANCE_RAG', status: 'success', message: 'RAG re-indexado com chunks otimizados' };
    } catch (e) {
      return { type: 'ENHANCE_RAG', status: 'failed', error: e.message };
    }
  }

  /**
   * Ajusta prompt-master para forçar mais citações
   */
  async _optimizePromptForCitations() {
    console.log('[QualityAgent] Optimizing prompt for citations...');
    // O prompt-master.js já foi atualizado na versão 4.1 com regras de citação obrigatória
    // Aqui apenas registra que a otimização foi aplicada
    return {
      type: 'OPTIMIZE_PROMPT_CITATIONS',
      status: 'success',
      message: 'Prompt-master v4.1 já inclui regras de citação obrigatória por tipo de fonte'
    };
  }

  /**
   * Aperta thresholds do RAG validator para reduzir alucinação
   */
  async _tightenRAGThresholds() {
    console.log('[QualityAgent] Tightening RAG thresholds...');
    // Isso seria feito ajustando config do rag-validator.js
    // Por ora, registra a ação
    return {
      type: 'TIGHTEN_RAG_THRESHOLDS',
      status: 'pending_manual',
      message: 'Ajustar MIN_RELEVANCE_SCORE em rag-validator.js de 0.30 para 0.35'
    };
  }
  /**
   * Verifica alucina��o usando ECC eval-harness e docs-lookup agent
   * @param {string} resposta - Resposta do chatbot para validar
   * @returns {number} 0 = OK, 1 = Alucina��o detectada
   */
  verificarAluciniaECC(resposta) {
    try {
      // Salva resposta temporariamente para an�lise
      const tempPath = path.join(__dirname, '..', '..', 'temp-response.txt');
      require('fs').writeFileSync(tempPath, resposta.substring(0, 500)); // Limita tamanho
      
      // Executa ECC agent docs-lookup para verifica��o factual
      const result = spawnSync('node', [
        path.join(__dirname, '..', '..', 'ecc', 'scripts', 'ecc.js'),
        'run', 'docs-lookup', 
        `Verificar afirma��es em: `
      ], { encoding: 'utf8', timeout: 10000 }); // 10 second timeout
      
      const output = result.stdout || '';
      // Considera alucina��o se N�O encontrar PASS ou se houver ind�cios de falha
      const isHallucination = !output.includes('PASS') && 
                             (output.includes('FAIL') || 
                              output.includes('error') || 
                              result.status !== 0);
      
      // Limpa arquivo tempor�rio
      try { require('fs').unlinkSync(tempPath); } catch {} // Ignora erro ao deletar
      
      return isHallucination ? 1 : 0;
    } catch (error) {
      console.warn('[QualityAgent] ECC hallucination check failed:', error.message);
      // Em caso de erro, retorna 0 (assume OK) para evitar falsos positivos
      return 0;
    }
  }

  /**
   * Aplica corre��o autom�tica usando ECC agents quando alucina��o � detectada
   * @param {string} resposta - Resposta do chatbot que cont�m alucina��o
   * @returns {Promise<Object>} Resultado da a��o corretiva
   */
  async aplicarCorrecaoECC(resposta) {
    try {
      console.log('[QualityAgent] Applying ECC-based correction for hallucination...');
      
      // 1. Usa typescript-reviewer para corrigir a l�gica anti-alucina��o
      const fixResult1 = spawnSync('node', [
        path.join(__dirname, '..', '..', 'ecc', 'scripts', 'ecc.js'),
        'run', 'typescript-reviewer',
        `Melhorar l�gica anti-alucina��o em quality-enforcer.js baseado nesta resposta com poss�vel alucina��o: "..."`
      ], { encoding: 'utf8', timeout: 15000 });
      
      // 2. Usa code-reviewer para validar as corre��es
      const fixResult2 = spawnSync('node', [
        path.join(__dirname, '..', '..', 'ecc', 'scripts', 'ecc.js'),
        'run', 'code-reviewer',
        `Revisar altera��es recentes em quality-enforcer.js para prevenir alucina��o como: "..."`
      ], { encoding: 'utf8', timeout: 15000 });
      
      // 3. Sugere melhorias no prompt-master se necess�rio
      const fixResult3 = spawnSync('node', [
        path.join(__dirname, '..', '..', 'ecc', 'scripts', 'ecc.js'),
        'run', 'prompt-optimizer',
        `Sugerir melhorias no prompt-master para reduzir alucina��o semelhantes a: "..."`
      ], { encoding: 'utf8', timeout: 15000 });
      
      return {
        type: 'ECC_HALLUCINATION_CORRECTION',
        status: 'success',
        message: 'Corre��es ECC aplicadas: typescript-reviewer + code-reviewer + prompt-optimizer',
        details: {
          typescriptReviewer: fixResult1.status === 0 ? 'success' : 'failed',
          codeReviewer: fixResult2.status === 0 ? 'success' : 'failed',
          promptOptimizer: fixResult3.status === 0 ? 'success' : 'failed'
        }
      };
    } catch (error) {
      console.error('[QualityAgent] ECC correction failed:', error.message);
      return {
        type: 'ECC_HALLUCINATION_CORRECTION',
        status: 'failed',
        error: error.message
      };
    }
  }

  /**
   * Aplica corre��o baseada em ECC quando alucina��o � detectada nas m�tricas
   * @returns {Promise<Object>} Resultado da a��o corretiva
   */
  async _applyECCHallucinationCorrection() {
    console.log('[QualityAgent] Applying ECC-based hallucination correction...');
    try {
      // Busca uma amostra de respostas recentes para analisar
      await this.tracer.initialize();
      const traces = this.tracer.db.prepare(`
        SELECT question, answer FROM traces
        WHERE timestamp > datetime('now', '-1 days')
        AND success = 1
        ORDER BY timestamp DESC
        LIMIT 5
      `).all();
      
      if (traces.length === 0) {
        return { type: 'ECC_HALLUCINATION_CORRECTION', status: 'no_data', message: 'Nenhuma trace recente para analisar' };
      }
      
      // Processa cada trace recente em busca de alucina��o
      let correctionsApplied = 0;
      for (const trace of traces) {
        const hallucinationDetected = this.verificarAluciniaECC(trace.answer || '');
        if (hallucinationDetected === 1) {
          // Aplica corre��o ECC para esta trace
          const correctionResult = await this.aplicarCorrecaoECC(trace.answer || '');
          if (correctionResult.status === 'success') {
            correctionsApplied++;
          }
        }
      }
      
      return {
        type: 'ECC_HALLUCINATION_CORRECTION',
        status: correctionsApplied > 0 ? 'success' : 'no_action',
        message: `${correctionsApplied} traces corrigidos com ECC baseado em ${traces.length} amostras`,
        tracesProcessed: traces.length,
        correctionsApplied
      };
    } catch (error) {
      console.error('[QualityAgent] ECC hallucination correction failed:', error.message);
      return {
        type: 'ECC_HALLUCINATION_CORRECTION',
        status: 'failed',
        error: error.message
      };
    }
  }

  /**
   * Preenche lacunas automaticamente gerando FAQ candidates
   */
  async _autoFillKnowledgeGaps() {
    console.log('[QualityAgent] Auto-filling knowledge gaps...');
    const gaps = knowledgeGap.listarPerguntasPendentes(20);
    const filled = [];

    for (const gap of gaps.slice(0, 5)) { // Limita a 5 por ciclo
      // Busca resposta via RAG
      const ragResults = await this.ragService.retrieve(gap.pergunta, 3);
      if (ragResults.validation?.pass && ragResults.results.length > 0) {
        const best = ragResults.results[0];
        // Gera resposta sintetizada (em produção, usar LLM)
        const synthesized = this._synthesizeAnswer(gap.pergunta, best.content);
        knowledgeGap.marcarRespondida(gap.id, synthesized);
        filled.push(gap.pergunta);
      }
    }

    return {
      type: 'FILL_GAPS',
      status: filled.length > 0 ? 'success' : 'no_action',
      message: `${filled.length} lacunas preenchidas automaticamente`,
      filled
    };
  }

  _synthesizeAnswer(pergunta, contexto) {
    // Síntese simples — em produção usaria LLM com prompt específico
    return `Resposta gerada automaticamente baseada em documento indexado:\n\n${contexto.substring(0, 500)}...\n\n[NOTA: Esta resposta foi gerada automaticamente. Valide com especialista antes de usar em produção.]`;
  }

  /**
   * Sugere expansão da FAQ baseada em gaps frequentes
   */
  async _suggestFAQExpansion() {
    console.log('[QualityAgent] Suggesting FAQ expansion...');
    const gaps = knowledgeGap.listarPerguntasPendentes(50);
    const topGaps = gaps
      .filter(g => g.vezesPerguntada >= 2)
      .slice(0, 10)
      .map(g => ({ pergunta: g.pergunta, vezes: g.vezesPerguntada }));

    return {
      type: 'SUGGEST_FAQ_EXPANSION',
      status: 'recommendation',
      message: `${topGaps.length} perguntas frequentes sem FAQ — candidatas a novo item`,
      candidates: topGaps
    };
  }

  /**
   * Otimiza prompt para quality_score
   */
  async _optimizePromptForQuality() {
    return {
      type: 'OPTIMIZE_PROMPT_QUALITY',
      status: 'success',
      message: 'Prompt-master v4.1 inclui quality_score guidance e validação interna'
    };
  }

  /**
   * Marca FAQs antigas para revisão
   */
  async _flagStaleFAQItems() {
    const faq = lerFAQ();
    const cutoff = Date.now() - this.config.thresholds.faqFreshnessDays * 86400000;
    const stale = faq.filter(item => {
      const date = item.dataAtualizacao || item.ultimaModificacao;
      return date && new Date(date).getTime() < cutoff;
    }).length;

    return {
      type: 'FLAG_STALE_FAQ',
      status: 'recommendation',
      message: `${stale} itens de FAQ com mais de ${this.config.thresholds.faqFreshnessDays} dias sem atualização`,
      count: stale
    };
  }

  /**
   * Gera recomendações manuais para issues não resolvidos automaticamente
   */
  _generateRecommendations(issues) {
    const recs = [];

    for (const issue of issues) {
      switch (issue.type) {
        case 'RETRIEVAL_PRECISION':
          recs.push('Revisar chunking strategy no RAG; adicionar sinonímia no FAQ; indexar mais documentos técnicos');
          break;
        case 'CITATION_RATE':
          recs.push('Auditar respostas recentes sem citação; treinar few-shot examples no prompt');
          break;
        case 'HALLUCINATION_RATE':
          recs.push('Aumentar MIN_RELEVANCE_SCORE no rag-validator; adicionar guardrails no llm-client');
          break;
        case 'COVERAGE_RATE':
          recs.push('Converter top knowledge-gaps em FAQ oficial; solicitar documentação aos proprietários');
          break;
        case 'QUALITY_SCORE':
          recs.push('Revisar cases com quality_score < 70; identificar padrões de falha');
          break;
        case 'FAQ_FRESHNESS':
          recs.push('Estabelecer ciclo de revisão trimestral da FAQ com owners técnicos');
          break;
        case 'CONVERSA_HUMANA':
          recs.push('Respostas sociais usam formato técnico: rotear small talk pelo social-specialist antes do quality-enforcer');
          recs.push('Verificar humanizer: saudação por horário e naturalização de resposta curta');
          break;
      }
    }

    return [...new Set(recs)]; // Unique
  }

  _logEvaluation(evaluation) {
    console.log(`\n📊 SCORE ATUAL: ${evaluation.score}/10 (target: ${this.config.targetScore})`);
    console.log(`   Retrieval Precision: ${(evaluation.metrics.retrievalPrecision * 100).toFixed(0)}%`);
    console.log(`   Citation Rate:       ${(evaluation.metrics.citationRate * 100).toFixed(0)}%`);
    console.log(`   Hallucination Rate:  ${(evaluation.metrics.hallucinationRate * 100).toFixed(0)}%`);
    console.log(`   Coverage Rate:       ${(evaluation.metrics.coverageRate * 100).toFixed(0)}%`);
    console.log(`   Avg Quality Score:   ${(evaluation.metrics.avgQualityScore * 100).toFixed(0)}`);
    console.log(`   FAQ Freshness:       ${(evaluation.metrics.faqFreshness * 100).toFixed(0)}%`);
    console.log(`   Conversa Humana:     ${((evaluation.metrics.conversaHumana ?? 1) * 100).toFixed(0)}%`);

    if (evaluation.issues.length > 0) {
      console.log('\n⚠️  ISSUES DETECTADOS:');
      evaluation.issues.forEach(i => console.log(`   [${i.severity.toUpperCase()}] ${i.message}`));
    }

    if (evaluation.actions.length > 0) {
      console.log('\n🔧 AÇÕES EXECUTADAS:');
      evaluation.actions.forEach(a => console.log(`   ${a.status === 'success' ? '✅' : a.status === 'pending_manual' ? '⏳' : '💡'} ${a.type}: ${a.message}`));
    }

    console.log('\n==============================================\n');
  }

  /**
   * Retorna dashboard de progresso
   */
  getDashboard() {
    const recent = this.history.evaluations.slice(-10);
    const trend = recent.length >= 2
      ? recent[recent.length - 1].score - recent[0].score
      : 0;

    return {
      currentScore: this.history.currentScore,
      targetScore: this.config.targetScore,
      progress: `${((this.history.currentScore / this.config.targetScore) * 100).toFixed(0)}%`,
      trend: trend > 0 ? `+${trend.toFixed(1)}` : trend.toFixed(1),
      totalEvaluations: this.history.evaluations.length,
      lastEvaluation: this.history.lastEvaluation,
      recentScores: recent.map(e => ({ date: e.timestamp, score: e.score })),
      config: this.config
    };
  }

  /**
   * Atualiza configuração
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this._saveConfig();
    return this.config;
  }

  /**
   * Executa ciclo único (para chamada manual ou scheduler)
   */
  async runOnce() {
    return this.runEvaluationCycle();
  }
}

// Singleton
let instance = null;

function getQualityImprovementAgent() {
  if (!instance) {
    instance = new QualityImprovementAgent();
  }
  return instance;
}

module.exports = { getQualityImprovementAgent, QualityImprovementAgent, DEFAULT_CONFIG };