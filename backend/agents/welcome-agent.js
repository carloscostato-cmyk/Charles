/**
 * Monta a saudação de abertura de sessão do Charles.
 *
 * Usado pelo endpoint GET /api/chat/welcome, que o frontend chama ao abrir
 * a conversa. Personaliza com o nome do usuário autenticado (Entra ID
 * `req.user.displayName`) quando disponível.
 *
 * Princípios:
 * - Uma frase. Sem relatório. Sem "Confiança: / Fatos Confirmados:".
 * - Saudação coerente com o horário real.
 * - Convite concreto, com exemplos do que o Charles sabe fazer.
 * - Nunca inventa dado técnico.
 */

const { gerarSaudacao, detectarPeriodo } = require('./humanizer');

/** Extrai o primeiro nome de um displayName ("Carlos Costato" → "Carlos"). */
function primeiroNome(displayName) {
  const bruto = String(displayName || '').trim();
  if (!bruto) return null;

  const primeiro = bruto.split(/[\s,]+/)[0];
  // Ignora valores que não parecem nome (ex.: e-mail, GUID, ID numérico)
  if (!primeiro || primeiro.length < 2) return null;
  if (primeiro.includes('@')) return null;

  // GUID/UUID: contém hífen ou é hexadecimal longo.
  if (primeiro.includes('-')) return null;
  // Sequência alfanumérica sem vogais não é nome em português.
  if (!/[aeiouáéíóúâêôãõç]/i.test(primeiro)) return null;

  return primeiro;
}

/**
 * Gera a mensagem de boas-vindas.
 *
 * @param {Object} [opcoes]
 * @param {string} [opcoes.nomeUsuario] - displayName do usuário autenticado
 * @param {string} [opcoes.primeiroNome] - primeiro nome (tem precedência)
 * @returns {{mensagem:string, saudacao:string, periodo:string, comNome:boolean}}
 */
function gerarBoasVindas(opcoes = {}) {
  const periodo = detectarPeriodo();
  const saudacao = gerarSaudacao(periodo);

  const nome = primeiroNome(opcoes.primeiroNome || opcoes.nomeUsuario);

  const convite = 'Sou o Charles, especialista em Data Center e operações de NOC. '
    + 'Posso informar endereços e contatos das unidades, apoiar diagnósticos e orientar sobre procedimentos. '
    + 'O que você precisa hoje?';

  // Nome entra na saudação; o convite sempre começa com maiúscula.
  const mensagem = nome
    ? `${saudacao} ${nome}! ${convite}`
    : `${saudacao} ${convite}`;

  return {
    mensagem,
    saudacao,
    periodo,
    comNome: Boolean(nome)
  };
}

module.exports = {
  gerarBoasVindas,
  primeiroNome
};