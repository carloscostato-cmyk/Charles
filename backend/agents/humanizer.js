/**
 * humanizer.js
 *
 * Camada de humanização do Charles: transforma respostas técnicas
 * em comunicação natural, sem perder precisão.
 *
 * Funções expostas:
 * - gerarSaudacao(periodo?)  → saudação coerente com o horário real
 * - humanizar(texto, opts)   → naturaliza caixa, pontuação e expressões
 * - precisaEncerramento(t)  → a resposta termina de forma conclusively?
 * - adicionarEncerramento(t)→ fecha a resposta com oferta de continuação
 */

/** Limites do período civil brasileiro para saudação. */
const PERIODOS = {
  MANHA: { inicio: 5, fim: 12, saudacao: 'Bom dia!' },
  TARDE: { inicio: 12, fim: 18, saudacao: 'Boa tarde!' },
  NOITE: { inicio: 18, fim: 29, saudacao: 'Boa noite!' }
};

/**
 * Retorna o período do dia a partir de uma hora (0-23).
 * Aceita hora fixa para permitir testes determinísticos.
 * @param {number} [hora]
 * @returns {'manha'|'tarde'|'noite'}
 */
function detectarPeriodo(hora) {
  const h = Number.isFinite(hora) ? hora : new Date().getHours();
  if (h >= PERIODOS.MANHA.inicio && h < PERIODOS.MANHA.fim) return 'manha';
  if (h >= PERIODOS.TARDE.inicio && h < PERIODOS.TARDE.fim) return 'tarde';
  return 'noite';
}

/**
 * Saudação coerente com o horário.
 * @param {string} [periodo] - 'manha' | 'tarde' | 'noite' (detecta se omitido)
 * @returns {string}
 */
function gerarSaudacao(periodo) {
  // Chaves de PERIODOS são maiúsculas; normaliza sempre antes de indexar.
  const chave = String(periodo || '').toUpperCase();
  const p = Object.prototype.hasOwnProperty.call(PERIODOS, chave)
    ? chave
    : detectarPeriodo().toUpperCase();
  return PERIODOS[p].saudacao;
}

/** Expressões de especialista acrescentadas a respostas muito curtas. */
const EXPRESSOES_ESPECIALISTA = [
  'Como posso ajudar',
  'Estou à disposição',
  'Fico à disposição'
];

/** Encerramento natural para respostas que não terminam de forma conclusiva. */
const ENCERRAMENTOS = [
  'É só perguntar.',
  'Estou à disposição para ajudar.',
  'Se precisar, é só chamar.'
];

/** Capitaliza apenas a primeira letra, preservando siglas (F5, NOC, SLA). */
function _capitalizar(texto) {
  if (!texto) return texto;
  return texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1);
}

/**
 * Verifica se a resposta termina de forma conclusively.
 * @param {string} texto
 * @returns {boolean}
 */
function precisaEncerramento(texto) {
  const t = String(texto || '').trim();
  if (!t) return false;
  // Pergunta em aberto não é encerramento.
  if (/\?\s*$/.test(t)) return true;
  // Já termina com pontuação terminal.
  return !/[.!?:;]\s*$/.test(t);
}

/**
 * Fecha a resposta com uma oferta de continuação, quando necessário.
 * Não altera respostas já finalizadas.
 * @param {string} texto
 * @returns {string}
 */
function adicionarEncerramento(texto) {
  const t = String(texto || '').trim();
  if (!t || !precisaEncerramento(t)) return texto;
  const base = /[.!?:;]\s*$/.test(t) ? t : `${t}.`;
  return `${base} ${ENCERRAMENTOS[0]}`;
}

/**
 * Naturaliza uma resposta: caixa inicial, pontuação terminal e, quando a
 * resposta é curta demais, uma expressão de especialista.
 *
 * @param {string} texto
 * @param {Object} [opcoes]
 * @param {boolean} [opcoes.isContinuacao] - trecho curto de continuação de conversa
 * @returns {string|null}
 */
function humanizar(texto, opcoes = {}) {
  if (texto === null || texto === undefined) return texto;
  const t = String(texto).trim();
  if (!t) return '';

  // Continuação de conversa: apenas caixa e pontuação, sem expressão.
  if (opcoes.isContinuacao) {
    const capitalizada = _capitalizar(t);
    return /[.!?:;]$/.test(capitalizada) ? capitalizada : `${capitalizada}.`;
  }

  let resultado = _capitalizar(t);

  // Resposta muito curta (< 25 chars) ganha expressão de especialista
  // para não soar como robô.
  if (resultado.length < 25 && !/express|especialista/i.test(resultado)) {
    resultado = `${resultado} ${EXPRESSOES_ESPECIALISTA[0]}`;
  }

  if (!/[.!?:;]$/.test(resultado)) {
    resultado = `${resultado}.`;
  }

  return resultado;
}

module.exports = {
  PERIODOS,
  detectarPeriodo,
  gerarSaudacao,
  humanizar,
  precisaEncerramento,
  adicionarEncerramento
};