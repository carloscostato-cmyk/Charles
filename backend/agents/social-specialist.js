/**
 * social-specialist.js
 *
 * Agente de conversação social do Charles.
 *
 * Objetivo: o Charles é especialista em Data Center, mas continua sendo uma
 * pessoa. Alguém que diz "bom dia", pergunta do tempo ou elogia merece uma
 * resposta humana — curta e cordial, sem o formato técnico de relatório
 * ("Confiança: / Fatos Confirmados: / Pontos Não Confirmados:").
 *
 * Responsabilidades:
 * - Saudação coerente com o horário real (bom dia / boa tarde / boa noite)
 * - Small talk: como você está, tempo/clima, dia da semana
 * - Agradecimento, elogio e despedida
 * - Interrupção do usuário (barge-in): "pare", "calado", "deixa pra lá"
 * - Assunto fora de escopo: responde com honestidade e reconduz
 *
 * Regra de ouro: NUNCA inventar previsão do tempo. Não há fonte
 * meteorológica conectada — o Charles diz isso e oferece o que sabe fazer.
 */

const { gerarSaudacao, detectarPeriodo } = require('./humanizer');

/** Comandos de interrupção do usuário (barge-in textual). */
const RE_INTERRUPCAO = /^\s*(pare|para|parar|cancela|cancelar|calado|sil[eê]ncio|silencio|espera|chega|cala|deixa pra l[áa]|isso n[ãa]o|assim n[ãa]o)\b/i;

/** Perguntas sobre clima/tempo — Charles não tem fonte meteorológica. */
const RE_TEMPO = /\b(tempo|clima|previs[ãa]o|chuva|chover|chovendo|calor|frio|umidade|granizo|neve|neblina|orvalho|temperatura|graus|vai chover|est[áa] chovendo|tem sol)\b/i;

/** Cumprimentos e verificações de estado do Charles (tolera texto sem acentos). */
const RE_ESTADO = /\b(como (vai|vc vai|esta|ta|voce esta|voce ta|foi)|tudo (bem|certo|ok)|e a[ií]|blz)\b/i;

/** Elogios ao Charles (tolera texto sem acentos). */
const RE_ELOGIO = /\b(voc[eê] (e|eh|é) (muito |demais )?(legal|incrivel|show|top|[óo]timo|excelente|forte)|parab[eé]ns|muito bom|mandou bem|show de bola)\b/i;

/** Saudações diretas, sem confundir perguntas técnicas com conversa social. */
const RE_SAUDACAO = /^\s*(oi|olá|ola|bom dia|boa tarde|boa noite|ei|hey|hello|hi)\b/i;

/** Assuntos claramente fora do domínio e fora de competência do Charles. */
const RE_FORA_DE_ESCOPO = /\b(bolo|receita|filme|m[uú]sica|amor|namorad|esposa|marido|futebol|pol[íi]tica|elei[çc][ãa]o|piada|conto|hist[óo]ria|signo|hor[óo]scopo|astrologia|tar[óo]|bin[óo]rio)\b/i;
/** Assuntos de TI fora do domínio de Data Center. */
const RE_FORA_DC = /\b(restaurante|treino|dieta|advogado|contador|medicina|veterin[áa]rio|viagem|passagem|hotel)\b/i;

/** Temas que o Charles realmente resolve — evitam falso "fora de escopo". */
const RE_DOMINIO_DC = /\b(data ?center|datacenter|noc|server|servidor|rack|rede|switch|firewall|backup|virtualiza|cluster|storage|armazenamento|infraestrutura|energia|climatiza|ups|gera[çc][ãa]o|falha|incidente|mudan[çc]a|acesso|portal|znuny|otrs|itsm|cmdb|monitoramento|zabbix|grafana|sla|ticket|chamado|help ?desk|suporte)\b/i;

/** Respostas para interrupção — o Charles cede a vez de imediato. */
const RESPOSTAS_INTERRUPCAO = [
  'Claro, parei. O que você prefere?',
  'Ok, parei aqui. Me diz o que precisa.',
  'Entendi, interrompo. Como posso ajudar?'
];

/** Respostas para assunto claramente fora de competência. */
const RESPOSTAS_FORA_DE_ESCOPO = [
  'Essa não é a minha área, e prefiro não inventar resposta. Sou especialista em Data Center e operações de NOC — posso ajudar com isso.',
  'Não tenho como responder isso com segurança. Meu foco é Data Center, NOC e infraestrutura. Posso ajudar com algum desses temas?',
  'Prefiro ser honesto: não é um tema que eu domino. Sou especialista em Data Center e operações — quer seguir por aí?'
];

/**
 * Detecta se o usuário está interrompendo o Charles.
 * @param {string} texto
 * @returns {boolean}
 */
function isInterrupcao(texto) {
  return RE_INTERRUPCAO.test(String(texto || ''));
}

/**
 * Monta a resposta para "tempo/clima".
 * Regra: não inventar previsão. Dizer o limite e redirecionar.
 * @param {string} [cidade]
 * @returns {string}
 */
function responderTempo(cidade) {
  const local = cidade ? ` para ${cidade}` : '';
  return `Não tenho acesso a previsão do tempo${local} — não quero te passar uma informação inventada. `
    + `O que eu consigo fazer por você: informar endereços e contatos dos Data Centers, `
    + `horários de manutenção, disponibilidade da equipe de Analysts, `
    + `e o status do procedimento em que você está trabalhando. `
    + `Quer seguir por algum desses?`;
}

/**
 * Monta uma saudação útil: reconhece o período e já direciona para o escopo
 * do Charles, sem acionar o LLM ou inventar informação.
 * @returns {string}
 */
function responderSaudacao() {
  const saudacao = gerarSaudacao(detectarPeriodo());
  return `${saudacao} Sou o Charles, especialista em Data Center e operações de NOC. `
    + 'Posso ajudar com endereços e contatos das unidades, infraestrutura e procedimentos documentados. '
    + 'O que você precisa?';
}

/**
 * Avalia a mensagem e, se for social, devolve a resposta.
 * Se for assunto técnico, devolve `null` para o fluxo normal assumir.
 *
 * @param {string} texto
 * @returns {{resposta:string, tipo:string, confianca:number}|null}
 */
function avaliar(texto) {
  const t = String(texto || '').trim();
  if (!t) return null;

  // 1) Interrupção tem a maior prioridade — o Charles cede a vez.
  if (isInterrupcao(t)) {
    return {
      resposta: RESPOSTAS_INTERRUPCAO[0],
      tipo: 'interrupcao',
      confianca: 0.95
    };
  }

  // 2) Domínio técnico nunca é small talk, mesmo contendo "tempo"
  //    (ex.: "tempo limite de resposta do SLA").
  if (RE_DOMINIO_DC.test(t)) return null;

  // 3) Saudação direta — resposta curta, natural e orientada ao escopo.
  if (RE_SAUDACAO.test(t)) {
    return { resposta: responderSaudacao(), tipo: 'saudacao', confianca: 1 };
  }

  // 4) Tempo/clima — honestidade sobre o limite de competência.
  if (RE_TEMPO.test(t)) {
    return { resposta: responderTempo(), tipo: 'tempo', confianca: 0.9 };
  }

  // 5) Como você está.
  if (RE_ESTADO.test(t)) {
    const abertura = gerarSaudacao(detectarPeriodo());
    return {
      resposta: `${abertura} Estou operando normalmente, à disposição para o que precisar. `
        + 'E com você, como estão as coisas por aí?',
      tipo: 'estado',
      confianca: 0.85
    };
  }

  // 6) Elogio — recebe sem resposta genérica.
  if (RE_ELOGIO.test(t)) {
    return {
      resposta: 'Obrigado! Fico feliz que esteja sendo útil. '
        + 'Se precisar de mais alguma coisa, é só chamar.',
      tipo: 'elogio',
      confianca: 0.8
    };
  }

  // 7) Fora de escopo claro.
  if (RE_FORA_DE_ESCOPO.test(t) || RE_FORA_DC.test(t)) {
    return { resposta: RESPOSTAS_FORA_DE_ESCOPO[0], tipo: 'fora_de_escopo', confianca: 0.75 };
  }

  return null;
}

module.exports = {
  avaliar,
  isInterrupcao,
  responderTempo,
  responderSaudacao,
  RE_TEMPO,
  RE_INTERRUPCAO,
  RE_SAUDACAO,
  RESPOSTAS_FORA_DE_ESCOPO
};