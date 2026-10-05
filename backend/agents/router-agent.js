/**
 * router-agent.js
 *
 * Agente roteador: classifica a intenção da mensagem e decide quais
 * especialistas devem ser acionados.
 */

const orchestrator = require('./orchestrator');

/** Categorias de intenção reconhecidas pelo Charles. */
const INTENT_CATEGORIES = {
  DATACENTER_LOCATION: 'datacenter_location',
  DATACENTER_CONTACT: 'datacenter_contact',
  DATACENTER_DIRECTORY: 'datacenter_directory',
  DATACENTER_REGION: 'datacenter_region',
  DATACENTER_AVAILABILITY: 'datacenter_availability',
  GREETING: 'greeting',
  SMALL_TALK: 'small_talk',
  TECHNICAL: 'technical'
};

/** Padrões por categoria, na ordem de precedência de decisão. */
const PADROES = [
  {
    category: INTENT_CATEGORIES.DATACENTER_LOCATION,
    keywords: ['endereco', 'endereço', 'localizacao', 'localização', 'onde fica',
      'onde esta', 'onde está', 'como chego', 'mapa', 'cep', 'sede']
  },
  {
    category: INTENT_CATEGORIES.DATACENTER_CONTACT,
    keywords: ['telefone', 'contato', 'ligar', 'ramal', 'fone', 'numero', 'número']
  },
  {
    category: INTENT_CATEGORIES.DATACENTER_DIRECTORY,
    keywords: ['diretório', 'diretorio', 'lista', 'todos os data centers',
      'quantos data centers', 'unidades de data center']
  },
  {
    category: INTENT_CATEGORIES.DATACENTER_REGION,
    keywords: ['região', 'regiao', 'sudeste', 'nordeste', 'centro-oeste',
      'centro oeste', 'norte', 'estado', 'ufs']
  },
  {
    category: INTENT_CATEGORIES.DATACENTER_AVAILABILITY,
    keywords: ['disponivel', 'disponível', 'disponibilidade', 'capacidade',
      'energia', 'segurança', 'seguranca', 'manutenção', 'manutencao',
      'blackout', 'janela']
  }
];

/** Nome do especialista responsável por cada categoria. */
const AGENTE_POR_CATEGORIA = {
  [INTENT_CATEGORIES.DATACENTER_LOCATION]: 'specialist-locator',
  [INTENT_CATEGORIES.DATACENTER_CONTACT]: 'specialist-contact',
  [INTENT_CATEGORIES.DATACENTER_DIRECTORY]: 'specialist-directory',
  [INTENT_CATEGORIES.DATACENTER_REGION]: 'specialist-region',
  [INTENT_CATEGORIES.DATACENTER_AVAILABILITY]: 'specialist-availability'
};

/**
 * Normaliza texto: minúsculas e sem acentos, para comparação estável.
 * @param {string} texto
 * @returns {string}
 */
function _normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getRouterAgent() {
  /** Contadores em memória para getStats(). */
  const stats = {
    totalRouted: 0,
    faqHits: 0,
    llmCalls: 0,
    agentesUsados: 1,
    porCategoria: {}
  };

  return {
    /**
     * Classifica a intenção de uma pergunta.
     * @param {string} query
     * @returns {{category:string, confidence:number, reasoning:string, agents:Array}}
     */
    classifyIntent(query) {
      const q = _normalizar(query);
      let resultado = {
        category: INTENT_CATEGORIES.TECHNICAL,
        confidence: 0.6,
        reasoning: 'Sem correspondência em categorias de Data Center — tratar como técnico/documental',
        agents: ['router-agent']
      };

      for (const padrao of PADROES) {
        const achou = padrao.keywords.some((k) => q.includes(_normalizar(k)));
        if (achou) {
          resultado = {
            category: padrao.category,
            confidence: 0.95,
            reasoning: `Palavra-chave de ${padrao.category} detectada na pergunta`,
            agents: [AGENTE_POR_CATEGORIA[padrao.category], 'router-agent']
          };
          break;
        }
      }

      stats.totalRouted += 1;
      stats.porCategoria[resultado.category] =
        (stats.porCategoria[resultado.category] || 0) + 1;

      return resultado;
    },

    /**
     * Retorna os agentes acionados para uma categoria de intenção.
     * @param {string} category
     * @returns {Array<string>}
     */
    selectAgents(category) {
      const agente = AGENTE_POR_CATEGORIA[category];
      return agente ? [agente, 'router-agent'] : ['router-agent'];
    },

    /**
     * Processa a pergunta e devolve o resultado orquestrado.
     * @param {string} pergunta
     * @param {Array} resultadosFAQ
     * @param {string} respostaLLM
     * @param {string} fonte
     */
    processar(pergunta, resultadosFAQ, respostaLLM, fonte) {
      if (fonte === 'faq') stats.faqHits += 1;
      if (fonte === 'llm') stats.llmCalls += 1;
      return orchestrator.processar(pergunta, resultadosFAQ, respostaLLM, fonte);
    },

    getStatusAgentes() {
      return {
        agentes: Object.values(INTENT_CATEGORIES).map((c) => c),
        status: 'online',
        routing: {
          intents: Object.values(INTENT_CATEGORIES),
          confidence: 0.95
        }
      };
    },

    getStats() {
      return { ...stats, porCategoria: { ...stats.porCategoria } };
    }
  };
}

module.exports = { getRouterAgent, INTENT_CATEGORIES, AGENTE_POR_CATEGORIA };