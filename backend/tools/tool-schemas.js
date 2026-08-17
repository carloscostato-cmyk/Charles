/**
 * tool-schemas.js
 *
 * JSON Schemas oficiais para Native LLM Function Calling.
 * Essas definições são passadas ao LLM via parâmetro `tools` na API OpenAI/Groq.
 * O LLM decide autonomamente quando acionar cada ferramenta.
 *
 * FASE 1 - Evolução: substitui seleção de ferramentas via regex.
 */

const TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "calcular",
      description: "Realiza cálculos matemáticos. Use para qualquer operação aritmética solicitada pelo usuário.",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "Expressão matemática a ser calculada (ex: '25 * 4 + 10', '1500 / 3')."
          }
        },
        required: ["expression"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "consultar_data_hora",
      description: "Retorna a data e hora atuais do sistema. Use quando o usuário perguntar que dia é hoje, que horas são, ou a data atual.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "consultar_status_sistema",
      description: "Verifica o status atual do sistema, incluindo memória, uptime e provedores LLM ativos.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "buscar_conhecimento",
      description: "Busca informações na base de conhecimento técnica sobre procedimentos, normas, políticas, regras e processos de Data Center e infraestrutura.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Termo ou pergunta para buscar na base de conhecimento."
          }
        },
        required: ["query"]
      }
    }
  }
];

/**
 * Mapeia nomes de função do LLM para nomes de tools registradas no ToolRegistry
 */
const TOOL_NAME_MAP = {
  'calcular': 'CalculateTool',
  'consultar_data_hora': 'CurrentDateTool',
  'consultar_status_sistema': 'SystemStatusTool',
  'buscar_conhecimento': 'SearchKnowledgeTool'
};

module.exports = { TOOL_SCHEMAS, TOOL_NAME_MAP };
