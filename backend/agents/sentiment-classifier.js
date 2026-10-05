/**
 * sentiment-classifier.js
 *
 * Analisa o tom do usuário para adaptar a resposta do Charles.
 *
 * Match por PALAVRA INTEIRA (token com fronteira \b) — usar `includes('oi')`
 * gera falso positivo em "noite", "coisa", "dois", "história".
 */

/** Marcadores de urgência operacional. */
const RE_URGENCIA = /\b(urgente|urgencia|urg[êe]ncia|cr[íi]tico|critica|critico|crisis|emergencia|imediat[oa]|asap|agora|incidente|severidade|caiu|parou|travou)\b/i;

/** Marcadores de frustração. */
const RE_FRUSTRACAO = /\b(nao funciona|n[ãa]o funciona|nao resolveu|n[ãa]o resolveu|quebrad[oa]|erros?|falha sempre|sempre falha|quebrando|pior|horr[íi]vel|terr[íi]vel|absurdo|rid[íi]culo|revoltante|decepcionante|reclamando)\b/i;

/** Marcadores de confusão — o usuário não entendeu a resposta. */
const RE_CONFUSAO = /\b(n[ãa]o entendi|nao entendi|n[ãa]o compreendi|confuso|confusa|como assim|pode explicar melhor|explica melhor|de novo|repetir)\b/i;

/** Marcadores de positividade. */
const RE_POSITIVO = /\b(obrigad[oa]|valeu|vlw|perfeit[oa]|funcionou|funcionando|incr[íi]vel|excelente|maravilhos[oa]|adorei|[óo]timo|show|genial|resolvido|agrade[çc]o|obrigad[ãa]o)\b/i;

/** Marcadores de animação (exclamações repetidas ou elogios enfáticos). */
const RE_ANIMADO = /!{2,}|\b(incr[íi]vel|maravilhos[oa]|sensacional)\b/i;

/** Marcadores de curiosidade — várias perguntas na mesma mensagem. */
const RE_CURIOSO = /\b(como|onde|quando|por que|porque|qual|quais|quanto)\b/i;

/** Intensificadores de carga emocional. */
const RE_INTENSIFICADOR = /\b(muito|extremamente|totalmente|completamente|demais|super|absurdamente|insuportavel|urgentemente|criticamente)\b/gi;
/**
 * Calcula a intensidade emocional (0 a 1) de um texto.
 * Considera intensificadores, repetição de caracteres, caixa alta e pontuação.
 * @param {string} texto
 * @returns {number} 0..1
 */
function calcularIntensidade(texto) {
  const t = String(texto || '');
  if (!t.trim()) return 0;

  let score = 0;

  // 1) Intensificadores léxicos (até 0.6)
  const intensificadores = t.match(RE_INTENSIFICADOR);
  if (intensificadores) score += Math.min(0.6, intensificadores.length * 0.25);

  // 2) Repetição de caracteres: "nããão" (até 0.25)
  //    \w é ASCII-only em JS; usa-se \p{L}/\p{N} para cobrir acentos.
  if (/([\p{L}\p{N}])\1{2,}/u.test(t)) score += 0.25;

  // 3) Caixa alta predominante (até 0.2)
  const letras = t.replace(/[^a-zA-ZÀ-ÿ]/g, '');
  if (letras.length > 3) {
    const maiusculas = (letras.match(/[A-ZÀ-Þ]/g) || []).length;
    if (maiusculas / letras.length > 0.6) score += 0.2;
  }

  // 4) Pontuação enfática (até 0.15)
  const excl = (t.match(/!+/g) || []).join('').length;
  score += Math.min(0.15, excl * 0.05);

  return Math.min(1, Math.round(score * 100) / 100);
}
/**
 * Classifica o sentimento do usuário.
 *
 * @param {string} texto - mensagem do usuário
 * @returns {{sentimento:string, intensidade:number, urgencia:boolean,
 *            frustracao:boolean, confianca:number}}
 */
function classificar(texto) {
  const t = String(texto || '');
  const intensidade = calcularIntensidade(t);

  const resultado = {
    sentimento: 'neutro',
    intensidade,
    urgencia: false,
    frustracao: false,
    confianca: 0.5
  };

  if (!t.trim()) return resultado;

  // Ordem importa: frustração e urgência dominam o tom do restante.
  if (RE_FRUSTRACAO.test(t)) {
    resultado.sentimento = 'frustrado';
    resultado.frustracao = true;
    resultado.confianca = 0.85;
    return resultado;
  }

  if (RE_URGENCIA.test(t)) {
    resultado.sentimento = 'urgente';
    resultado.urgencia = true;
    resultado.confianca = 0.85;
    return resultado;
  }

  if (RE_CONFUSAO.test(t)) {
    resultado.sentimento = 'confuso';
    resultado.confianca = 0.75;
    return resultado;
  }

  if (RE_ANIMADO.test(t)) {
    resultado.sentimento = 'animado';
    resultado.confianca = 0.8;
    return resultado;
  }

  if (RE_POSITIVO.test(t)) {
    resultado.sentimento = 'positivo';
    resultado.confianca = 0.8;
    return resultado;
  }

  // Duas ou mais perguntas na mesma mensagem indicam exploração do tema.
  if ((t.match(/\?/g) || []).length >= 2 && RE_CURIOSO.test(t)) {
    resultado.sentimento = 'curioso';
    resultado.confianca = 0.7;
    return resultado;
  }

  resultado.confianca = 0.6;
  // Pergunta sem carga emocional tem intensidade-base 0.3 (sinal fraco, não nulo).
  if (t.includes('?') && !intensidade) {
    resultado.intensidade = 0.3;
  }

  return resultado;
}

/**
 * Gera instrução de empatia para o prompt, conforme o sentimento.
 * @param {Object|null} analise - resultado de classificar()
 * @returns {string} stringa vazia quando não há ajuste necessário
 */
function gerarPromptEmpatia(analise) {
  if (!analise || !analise.sentimento) return '';

  switch (analise.sentimento) {
    case 'frustrado':
      return 'O usuário está frustrado. Reconheça o impacto de forma direta, sem ser condescendente, e vá para a solução.';
    case 'urgente':
      return 'O usuário sinaliza urgência. Responda de forma direta, sem introduções, e priorize a próxima ação.';
    case 'confuso':
      return 'O usuário não entendeu. Seja mais simples e objetivo, reformule em etapas menores e confirme o entendimento.';
    case 'animado':
    case 'positivo':
      return 'O usuário está receptivo ao diálogo. Mantenha o tom cordial.';
    case 'curioso':
      return 'O usuário está explorando o tema. Ofereça contexto adicional relevante.';
    default:
      return '';
  }
}

/**
 * Define ajustes de tom (formalidade/profundidade/humor) para a resposta.
 * @param {Object|null} analise
 * @returns {{formalidade:string, profundidade:string, humor:string}}
 */
function gerarAjusteTom(analise) {
  const padrao = { formalidade: 'normal', profundidade: 'normal', humor: 'nenhum' };
  if (!analise) return padrao;

  const ajuste = { ...padrao };

  if (analise.urgencia) {
    ajuste.formalidade = 'alto';
    ajuste.profundidade = 'baixo';
    return ajuste;
  }

  if (analise.frustracao) {
    ajuste.formalidade = 'medio';
    ajuste.profundidade = 'baixo';
    return ajuste;
  }

  if (analise.sentimento === 'animado' || analise.sentimento === 'positivo') {
    ajuste.humor = 'moderado';
  }

  return ajuste;
}

module.exports = {
  classificar,
  calcularIntensidade,
  gerarPromptEmpatia,
  gerarAjusteTom
};