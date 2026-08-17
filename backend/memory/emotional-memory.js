/**
 * emotional-memory.js — Memória Emocional do Charles
 *
 * Persiste arco afetivo, temas sensíveis e preferências de interação
 * por usuário, para continuidade humana entre turnos.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class EmotionalMemory {
  constructor() {
    this.dbPath = path.join(__dirname, '..', '..', 'data', 'emotional-memory.db');
    this.db = null;
    this._initialized = false;
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
      CREATE TABLE IF NOT EXISTS emotional_state (
        user_id TEXT PRIMARY KEY,
        last_sentiment TEXT,
        last_intensity REAL DEFAULT 0.3,
        arc TEXT DEFAULT 'estavel',
        frustration_count INTEGER DEFAULT 0,
        urgency_count INTEGER DEFAULT 0,
        prefer_short INTEGER DEFAULT 0,
        hot_topics TEXT DEFAULT '[]',
        summary TEXT DEFAULT '',
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS emotional_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        sentiment TEXT,
        intensity REAL,
        topic TEXT,
        note TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_em_events_user ON emotional_events(user_id);
    `);

    this._initialized = true;
    console.log('[EmotionalMemory] Inicializado');
  }

  /**
   * Recupera contexto emocional do usuário.
   */
  async recall(userId = 'default') {
    await this.initialize();
    const uid = String(userId || 'default');

    const row = this.db.prepare(`
      SELECT * FROM emotional_state WHERE user_id = ?
    `).get(uid);

    if (!row) {
      return {
        summary: '',
        hotTopics: [],
        preferences: { detail: 'normal' },
        lastSentiment: 'neutro',
        arc: 'estavel',
        recallPhrase: null
      };
    }

    let hotTopics = [];
    try {
      hotTopics = JSON.parse(row.hot_topics || '[]');
    } catch {
      hotTopics = [];
    }

    const summaryParts = [];
    if (row.last_sentiment && row.last_sentiment !== 'neutro') {
      summaryParts.push(`último tom detectado: ${row.last_sentiment}`);
    }
    if (row.frustration_count >= 2) {
      summaryParts.push('já demonstrou frustração mais de uma vez nesta jornada');
    }
    if (row.urgency_count >= 1) {
      summaryParts.push('já trouxe demanda com urgência');
    }
    if (hotTopics.length) {
      summaryParts.push(`temas sensíveis: ${hotTopics.slice(0, 3).join(', ')}`);
    }

    let recallPhrase = null;
    if (hotTopics.length > 0) {
      recallPhrase = `Considerando o que você já comentou sobre ${hotTopics[0]}...`;
    } else if (row.frustration_count >= 2) {
      recallPhrase = 'Lembro que isso já tinha te atrapalhado antes — vou focar em destravar.';
    }

    return {
      summary: row.summary || summaryParts.join('; '),
      hotTopics,
      preferences: {
        detail: row.prefer_short ? 'baixo' : 'normal'
      },
      lastSentiment: row.last_sentiment || 'neutro',
      arc: row.arc || 'estavel',
      frustrationCount: row.frustration_count || 0,
      urgencyCount: row.urgency_count || 0,
      recallPhrase
    };
  }

  /**
   * Registra emoção do turno e atualiza estado.
   */
  async remember(userId, emotion, meta = {}) {
    await this.initialize();
    const uid = String(userId || 'default');
    if (!emotion) return;

    const current = this.db.prepare(`SELECT * FROM emotional_state WHERE user_id = ?`).get(uid);

    let hotTopics = [];
    try {
      hotTopics = JSON.parse(current?.hot_topics || '[]');
    } catch {
      hotTopics = [];
    }

    const topic = _extractTopic(meta.pergunta || meta.topic || '');
    if (topic && (emotion.frustracao || emotion.urgencia || emotion.sentimento === 'frustrado')) {
      hotTopics = [topic, ...hotTopics.filter((t) => t !== topic)].slice(0, 8);
    }

    const frustrationCount = (current?.frustration_count || 0) + (emotion.frustracao ? 1 : 0);
    const urgencyCount = (current?.urgency_count || 0) + (emotion.urgencia ? 1 : 0);

    // Heurística de preferência: mensagens curtas + urgência/frustração → prefere curto
    let preferShort = current?.prefer_short || 0;
    const pergunta = String(meta.pergunta || '');
    if ((emotion.urgencia || emotion.frustracao) && pergunta.length > 0 && pergunta.length < 80) {
      preferShort = 1;
    }
    if (/resuma|mais curto|objetivo|direto ao ponto|sem enrolação|sem enrolacao/i.test(pergunta)) {
      preferShort = 1;
    }

    const summary = _buildSummary(emotion, hotTopics, frustrationCount);

    this.db.prepare(`
      INSERT INTO emotional_state (
        user_id, last_sentiment, last_intensity, arc,
        frustration_count, urgency_count, prefer_short, hot_topics, summary, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        last_sentiment = excluded.last_sentiment,
        last_intensity = excluded.last_intensity,
        arc = excluded.arc,
        frustration_count = excluded.frustration_count,
        urgency_count = excluded.urgency_count,
        prefer_short = excluded.prefer_short,
        hot_topics = excluded.hot_topics,
        summary = excluded.summary,
        updated_at = datetime('now')
    `).run(
      uid,
      emotion.sentimento || 'neutro',
      emotion.intensidade || 0.3,
      emotion.arc || 'estavel',
      frustrationCount,
      urgencyCount,
      preferShort,
      JSON.stringify(hotTopics),
      summary
    );

    this.db.prepare(`
      INSERT INTO emotional_events (user_id, sentiment, intensity, topic, note)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      uid,
      emotion.sentimento || 'neutro',
      emotion.intensidade || 0.3,
      topic || null,
      meta.note || null
    );

    // Limita histórico de eventos
    this.db.prepare(`
      DELETE FROM emotional_events
      WHERE user_id = ? AND id NOT IN (
        SELECT id FROM emotional_events WHERE user_id = ? ORDER BY id DESC LIMIT 50
      )
    `).run(uid, uid);
  }

  async clear(userId = 'default') {
    await this.initialize();
    const uid = String(userId || 'default');
    this.db.prepare(`DELETE FROM emotional_state WHERE user_id = ?`).run(uid);
    this.db.prepare(`DELETE FROM emotional_events WHERE user_id = ?`).run(uid);
  }
}

function _extractTopic(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return null;

  const patterns = [
    { re: /sla|uptime|disponibilidade/, topic: 'SLA/uptime' },
    { re: /acesso|liberação|liberacao|crachá|cracha|biometria/, topic: 'acesso ao DC' },
    { re: /energia|ups|gerador|pdu/, topic: 'energia' },
    { re: /refriger|chiller|clima/, topic: 'refrigeração' },
    { re: /rede|link|latência|latencia|conectividade/, topic: 'rede/conectividade' },
    { re: /backup|restore|rpo|rto/, topic: 'backup/DR' },
    { re: /incidente|outage|queda|falha/, topic: 'incidente' },
    { re: /henri dunat|barueri|campinas|contagem|tamboré|tambore/, topic: 'site específico' }
  ];

  for (const p of patterns) {
    if (p.re.test(t)) return p.topic;
  }

  // fallback: primeiras palavras significativas
  const tokens = t
    .replace(/[^\wà-ú\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 3);
  return tokens.length ? tokens.join(' ') : null;
}

function _buildSummary(emotion, hotTopics, frustrationCount) {
  const parts = [];
  if (emotion?.sentimento && emotion.sentimento !== 'neutro') {
    parts.push(`tom recente: ${emotion.sentimento}`);
  }
  if (frustrationCount >= 2) {
    parts.push('histórico de frustração');
  }
  if (hotTopics?.length) {
    parts.push(`temas: ${hotTopics.slice(0, 3).join(', ')}`);
  }
  return parts.join(' · ');
}

let instance = null;

function getEmotionalMemory() {
  if (!instance) {
    instance = new EmotionalMemory();
  }
  return instance;
}

module.exports = { getEmotionalMemory, EmotionalMemory };
