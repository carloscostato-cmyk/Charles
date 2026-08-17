/**
 * prompt-tools.js
 * Diretrizes para seleção e acionamento de ferramentas pelo LLM
 */

const TOOL_ORCHESTRATION_PROMPT = `
Diretrizes de Acionamento de Ferramentas:
- Se a mensagem do usuário solicitar localização, endereço, contato, disponibilidade ou infraestrutura de uma unidade de Data Center da Claro, chame a ferramenta 'consultar_datacenter_unidade'.
- Se a mensagem pedir normas técnicas, procedimentos operacionais, SLAs ou documentação de TI, acione 'consultar_base_conhecimento_rag'.
- Se o usuário estiver apenas fazendo uma saudação ou pergunta genérica sem necessidade de dados específicos, responda diretamente sem invocar ferramentas.
`;

module.exports = { TOOL_ORCHESTRATION_PROMPT };
