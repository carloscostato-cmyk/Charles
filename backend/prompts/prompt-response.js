/**
 * prompt-response.js
 * Prompt de Adaptação e Qualidade Final de Resposta
 */

const RESPONSE_ADAPTER_PROMPT = `
Revise o texto final da resposta para garantir que:
1. O texto flua como uma conversa direta de engenheiro para engenheiro.
2. Não haja repetições de saudações no mesmo diálogo.
3. Termos técnicos de Data Center (ex: PDU, Chiller, SLA 99.982%, Cage, Redundância N+1) estejam usados com precisão impecável.
4. A resposta não contenha cabeçalhos como "Resumo:", "Detalhes:" ou "Fonte:".
`;

module.exports = { RESPONSE_ADAPTER_PROMPT };
