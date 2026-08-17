/**
 * tracer.js
 *
 * Sistema de Tracing e Observabilidade.
 * Registra: agente utilizado, tempo de resposta, modelo utilizado,
 * tokens consumidos, ferramenta executada, custo estimado.
 *
 * FASE 7 - Observabilidade
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Estimativa de custos por modelo (USD por 1M tokens)
const MODEL_COSTS = {
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'meta-llama/llama-3.3-70b-instruct': { input: 0.59, output: 0.79 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'default': { input: 0.50, output: 0.80 }
};

class Tracer {
  constructor() {
    this.dbPath = path.join(__dirname, '..', '..', 'data', 'traces.db');
    this.db = null;
    this._initialized = false;
    this.activeTraces = new Map();
  }

  async initialize() {
    if (this._initialized) return;

    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS traces (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        question TEXT,
        answer TEXT,
        provider TEXT,
        model TEXT,
        intent TEXT,
        agents_used TEXT,
        tools_used TEXT,
        tokens_input INTEGER DEFAULT 0,
        tokens_output INTEGER DEFAULT 0,
        cost_usd REAL DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        quality_score INTEGER DEFAULT 0,
        fonte TEXT,
        success INTEGER DEFAULT 1,
        error TEXT,
        metadata TEXT,
        timestamp TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_traces_user ON traces(user_id);
      CREATE INDEX IF NOT EXISTS idx_traces_timestamp ON traces(timestamp);
      CREATE INDEX IF NOT EXISTS idx_traces_model ON traces(model);
    `);

    this._initialized = true;
    console.log('[Tracer] Sistema de tracing inicializado');
  }

  /**
   * Inicia um novo trace
   * @param {string} userId
   * @param {string} question
   * @returns {string} traceId
   */
  startTrace(userId, question) {
    const traceId = uuidv4();
    this.activeTraces.set(traceId, {
      id: traceId,
      userId,
      question,
      startTime: Date.now(),
      agentsUsed: [],
      toolsUsed: [],
      tokensInput: 0,
      tokensOutput: 0,
      model: '',
      provider: '',
      intent: ''
    });
    return traceId;
  }

  /**
   * Registra uso de agente
   * @param {string} traceId
   * @param {string} agentName
   */
  recordAgent(traceId, agentName) {
    const trace = this.activeTraces.get(traceId);
    if (trace) {
      trace.agentsUsed.push(agentName);
    }
  }

  /**
   * Registra uso de ferramenta
   * @param {string} traceId
   * @param {string} toolName
   * @param {number} duration
   */
  recordTool(traceId, toolName, duration = 0) {
    const trace = this.activeTraces.get(traceId);
    if (trace) {
      trace.toolsUsed.push({ name: toolName, duration });
    }
  }

  /**
   * Registra modelo e tokens
   * @param {string} traceId
   * @param {string} provider
   * @param {string} model
   * @param {number} tokensInput
   * @param {number} tokensOutput
   */
  recordModel(traceId, provider, model, tokensInput = 0, tokensOutput = 0) {
    const trace = this.activeTraces.get(traceId);
    if (trace) {
      trace.provider = provider;
      trace.model = model;
      trace.tokensInput += tokensInput;
      trace.tokensOutput += tokensOutput;
    }
  }

  /**
   * Registra intenção classificada
   * @param {string} traceId
   * @param {string} intent
   */
  recordIntent(traceId, intent) {
    const trace = this.activeTraces.get(traceId);
    if (trace) {
      trace.intent = intent;
    }
  }

  /**
   * Finaliza o trace e salva no banco
   * @param {string} traceId
   * @param {string} answer
   * @param {Object} metadata
   */
  async endTrace(traceId, answer, metadata = {}) {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;

    trace.duration = Date.now() - trace.startTime;

    // Calcula custo estimado
    const costs = MODEL_COSTS[trace.model] || MODEL_COSTS['default'];
    const costInput = (trace.tokensInput / 1_000_000) * costs.input;
    const costOutput = (trace.tokensOutput / 1_000_000) * costs.output;
    trace.cost = costInput + costOutput;

    // Salva no banco
    await this.initialize();
    const stmt = this.db.prepare(`
      INSERT INTO traces (id, user_id, question, answer, provider, model, intent,
        agents_used, tools_used, tokens_input, tokens_output, cost_usd,
        duration_ms, quality_score, fonte, success, error, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      trace.id,
      trace.userId,
      trace.question,
      answer,
      trace.provider,
      trace.model,
      trace.intent,
      JSON.stringify(trace.agentsUsed),
      JSON.stringify(trace.toolsUsed),
      trace.tokensInput,
      trace.tokensOutput,
      trace.cost,
      trace.duration,
      metadata.quality || 0,
      metadata.fonte || '',
      metadata.success ? 1 : 0,
      metadata.error || null,
      JSON.stringify(metadata)
    );

    this.activeTraces.delete(traceId);

    console.log(`[Tracer] Trace finalizado: ${trace.duration}ms, ${trace.tokensInput + trace.tokensOutput} tokens, $${trace.cost.toFixed(6)}`);

    return {
      traceId: trace.id,
      duration: trace.duration,
      tokens: trace.tokensInput + trace.tokensOutput,
      cost: trace.cost,
      agents: trace.agentsUsed,
      tools: trace.toolsUsed
    };
  }

  /**
   * Retorna traces recentes
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async getRecentTraces(limit = 20) {
    await this.initialize();
    const rows = this.db.prepare(
      'SELECT * FROM traces ORDER BY timestamp DESC LIMIT ?'
    ).all(limit);
    return rows.map(this._formatTrace);
  }

  /**
   * Retorna estatísticas agregadas
   * @param {number} hoursBack
   * @returns {Promise<Object>}
   */
  async getStats(hoursBack = 24) {
    await this.initialize();

    const since = new Date(Date.now() - hoursBack * 3600000).toISOString();

    const total = this.db.prepare(
      'SELECT COUNT(*) as count FROM traces WHERE timestamp > ?'
    ).get(since).count;

    const avgDuration = this.db.prepare(
      'SELECT AVG(duration_ms) as avg FROM traces WHERE timestamp > ?'
    ).get(since).avg || 0;

    const totalTokens = this.db.prepare(
      'SELECT SUM(tokens_input + tokens_output) as total FROM traces WHERE timestamp > ?'
    ).get(since).total || 0;

    const totalCost = this.db.prepare(
      'SELECT SUM(cost_usd) as total FROM traces WHERE timestamp > ?'
    ).get(since).total || 0;

    const successRate = this.db.prepare(
      'SELECT (SUM(success) * 100 / COUNT(*)) as rate FROM traces WHERE timestamp > ?'
    ).get(since).rate || 0;

    const byModel = this.db.prepare(
      'SELECT model, COUNT(*) as count, AVG(duration_ms) as avg_duration, SUM(cost_usd) as total_cost FROM traces WHERE timestamp > ? GROUP BY model'
    ).all(since);

    const byIntent = this.db.prepare(
      'SELECT intent, COUNT(*) as count FROM traces WHERE timestamp > ? GROUP BY intent ORDER BY count DESC'
    ).all(since);

    return {
      period: `${hoursBack}h`,
      totalRequests: total,
      avgDuration: Math.round(avgDuration),
      totalTokens,
      totalCost: parseFloat(totalCost.toFixed(6)),
      successRate: Math.round(successRate),
      byModel,
      byIntent
    };
  }

  /**
   * Formata um trace para retorno
   */
  _formatTrace(row) {
    return {
      id: row.id,
      userId: row.user_id,
      question: row.question,
      answer: row.answer,
      provider: row.provider,
      model: row.model,
      intent: row.intent,
      agentsUsed: JSON.parse(row.agents_used || '[]'),
      toolsUsed: JSON.parse(row.tools_used || '[]'),
      tokensInput: row.tokens_input,
      tokensOutput: row.tokens_output,
      cost: row.cost_usd,
      duration: row.duration_ms,
      quality: row.quality_score,
      fonte: row.fonte,
      success: row.success,
      error: row.error,
      timestamp: row.timestamp
    };
  }
}

// Singleton
let instance = null;

function getTracer() {
  if (!instance) {
    instance = new Tracer();
  }
  return instance;
}

module.exports = { getTracer, Tracer, MODEL_COSTS };