/**
 * knowledge-gap.js
 * Registro e consulta de lacunas de conhecimento (perguntas sem resposta na base).
 *
 * Persistência: knowledge-gaps.json na raiz do projeto.
 * Consumido por: GET /api/knowledge-gaps (backend/server.js) via orchestrator.
 */

const fs = require('fs');
const path = require('path');

// Permite teste isolado (Jest define KNOWLEDGE_GAPS_FILE antes do require)
const GAPS_FILE = process.env.KNOWLEDGE_GAPS_FILE
  || path.join(__dirname, '..', '..', 'knowledge-gaps.json');

/** Lê o arquivo de lacunas; retorna [] se ausente ou inválido. */
function _lerGaps() {
  try {
    if (!fs.existsSync(GAPS_FILE)) return [];
    const dados = JSON.parse(fs.readFileSync(GAPS_FILE, 'utf8'));
    return Array.isArray(dados) ? dados : [];
  } catch (error) {
    console.warn('[KnowledgeGap] Erro ao ler knowledge-gaps.json:', error.message);
    return [];
  }
}

/** Grava o arquivo de lacunas de forma atômica. */
function _salvarGaps(gaps) {
  const tmp = `${GAPS_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(gaps, null, 2), 'utf8');
  fs.renameSync(tmp, GAPS_FILE);
}

/**
 * Lista perguntas pendentes (não respondidas), mais perguntadas primeiro.
 * @param {number} limite
 * @returns {Array}
 */
function listarPerguntasPendentes(limite = 10) {
  return _lerGaps()
    .filter((g) => !g.respondida)
    // Ordem: mais perguntada primeiro; em empate, a mais recente primeiro
    .sort((a, b) => (b.vezesPerguntada || 0) - (a.vezesPerguntada || 0)
      || new Date(b.ultimaVez || b.dataRegistro || 0) - new Date(a.ultimaVez || a.dataRegistro || 0))
    .slice(0, Math.max(1, limite));
}

/**
 * Estatísticas gerais das lacunas.
 * @returns {{total:number, pendentes:number, respondidas:number}}
 */
function getEstatisticas() {
  const gaps = _lerGaps();
  const respondidas = gaps.filter((g) => g.respondida).length;
  return {
    total: gaps.length,
    pendentes: gaps.length - respondidas,
    respondidas
  };
}

/**
 * Detecta conversa fiada / ruído (saudações, agradecimentos, testes, frases
 * curtas sem forma de pergunta). Objetivo: manter knowledge-gaps.json útil
 * para curadoria documental — só interessa o que exige resposta técnica.
 *
 * Limitação conhecida (documentada): não filtra ruído longo de ASR
 * (transcrições distorcidas de voz que formam frases completas).
 *
 * @param {string} pergunta
 * @returns {boolean} true se for conversa fiada (não deve virar gap)
 */
const PADROES_CONVERSA = [
  /^(oi+|ola|opa|e ai|eai|eae|salve|alo)\b/,
  /^(tudo bem|tudo bom|bom dia|boa tarde|boa noite|td bem|como (voce|vc) (esta|ta))\b/,
  /^(obrigad[oa]|brigado|vlw|valeu|beleza|certo|entendi|isso ai|fechou|ok|okay)\b/,
  /^(me escuta|me ouve|voce (esta|ta) ai|vc (esta|ta) ai|quem (e|e) (voce|vc))\b/,
  /^(teste|testando|ping|pinguinho)\b/,
  /^(nao quero|nao preciso|na quero|na preciso)\b/
];

function ehConversaFiada(pergunta) {
  const t = String(pergunta || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!t) return false;

  // 1) Tem forma de pergunta técnica → NÃO é fiada (nunca bloquear)
    const ehPergunta = t.includes('?')
    || /^(qual|quais|como|quando|onde|por que|porque|quem|quanto|quantos|o que|que e|me explique|explique|descreva|me diga|me explica|quero saber|existe|qual seria|procedimento)/.test(t);
  if (ehPergunta) return false;

  // 2) Padrão conhecido de conversa fiada
  if (PADROES_CONVERSA.some((p) => p.test(t))) return true;

  // 3) Frase muito curta sem forma de pergunta → quase certamente ruído
  const palavras = t.split(/\s+/).filter((w) => w.length > 2);
  return palavras.length <= 3;
}

/**
 * Registra (ou incrementa) uma pergunta sem resposta na base.
 * Conversa fiada é ignorada (retorna null) para não poluir a lista.
 * @param {string} pergunta
 * @param {string} motivo
 * @returns {Object|null} lacuna registrada
 */
function registrarGap(pergunta, motivo = 'não encontrado na base') {
  const texto = String(pergunta || '').trim();
  if (!texto) return null;
  if (ehConversaFiada(texto)) {
    console.log(`[KnowledgeGap] Conversa fiada ignorada: "${texto.slice(0, 60)}"`);
    return null;
  }

  const gaps = _lerGaps();
  const existente = gaps.find(
    (g) => g.pergunta.trim().toLowerCase() === texto.toLowerCase()
  );
  const agora = new Date().toISOString();

  if (existente) {
    existente.ultimaVez = agora;
    existente.vezesPerguntada = (existente.vezesPerguntada || 1) + 1;
    _salvarGaps(gaps);
    return existente;
  }

  const nova = {
    id: (gaps.reduce((max, g) => Math.max(max, g.id || 0), 0) || 0) + 1,
    pergunta: texto,
    motivo,
    dataRegistro: agora,
    ultimaVez: agora,
    vezesPerguntada: 1,
    respondida: false,
    resposta: null
  };
  gaps.push(nova);
  _salvarGaps(gaps);
  return nova;
}

/**
 * Marca uma lacuna como respondida.
 * @param {number} id
 * @param {string} resposta
 * @returns {boolean}
 */
function marcarRespondida(id, resposta) {
  const gaps = _lerGaps();
  const gap = gaps.find((g) => g.id === id);
  if (!gap) return false;
  gap.respondida = true;
  gap.resposta = resposta || null;
  _salvarGaps(gaps);
  return true;
}

module.exports = {
  listarPerguntasPendentes,
  getEstatisticas,
  registrarGap,
  marcarRespondida
};