/**
 * prompt-naturalizer-agent.js
 * Usa o MASTER_SYSTEM_PROMPT como base e adapta por sentimento/contexto.
 */

const { MASTER_SYSTEM_PROMPT } = require('../prompts/prompt-master');

/**
 * Monta o system prompt a partir do prompt mestre + ajuste de sentimento.
 *
 * @param {Object} [params]
 * @param {string} [params.sentimento] - 'urgencia' | 'raiva' | 'frustrado' | 'tristeza' | 'alegria' | 'neutro'
 * @returns {string}
 */
module.exports = {
  gerarPromptNaturalizado({ sentimento } = {}) {
    let base = MASTER_SYSTEM_PROMPT;

    // Adaptação dinâmica por sentimento (complementar ao prompt mestre)
    if (sentimento === 'urgencia' || sentimento === 'raiva' || sentimento === 'urgente') {
      base += `\n\nCONTEXTO ATUAL: O usuário demonstra urgência ou frustração. Priorize ações imediatas e diretas. Não use introduções longas.`;
    } else if (sentimento === 'frustrado' || sentimento === 'tristeza') {
      base += `\n\nCONTEXTO ATUAL: O usuário pode estar sob pressão. Seja empático e objetivo. Foque em resolver o problema.`;
    } else if (sentimento === 'alegria' || sentimento === 'animado' || sentimento === 'positivo') {
      base += `\n\nCONTEXTO ATUAL: O usuário está receptivo. Pode ser mais detalhado se útil.`;
    }

    return base;
  }
};