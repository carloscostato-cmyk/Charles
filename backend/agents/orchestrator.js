const knowledgeGap = require('./knowledge-gap');
const qualityAgent = require('./quality-improvement-agent');

/**
 * Registro dos 5 especialistas de Data Center efetivamente roteados pelo
 * llm-client. A ordem reflete a precedência de decisão em
 * responderConsultaDataCenter(): o primeiro que reconhece a pergunta vence.
 *
 * Não altera o fluxo de execução — é a fonte de verdade para observabilidade
 * (GET /api/agentes) e para inventário.
 */
const ESPECIALISTAS_DATA_CENTER = [
  {
    id: 'specialist-locator',
    nome: 'Especialista em Localização',
    escopo: 'Endereço, CEP, bairro e cidade dos Data Centers',
    status: 'online',
    intent: 'datacenter_location'
  },
  {
    id: 'specialist-contact',
    nome: 'Especialista em Contato',
    escopo: 'Telefones e contatos das unidades',
    status: 'online',
    intent: 'datacenter_contact'
  },
  {
    id: 'specialist-directory',
    nome: 'Especialista em Diretório',
    escopo: 'Lista completa de unidades de Data Center',
    status: 'online',
    intent: 'datacenter_directory'
  },
  {
    id: 'specialist-region',
    nome: 'Especialista em Região',
    escopo: 'Cobertura por região e estado',
    status: 'online',
    intent: 'datacenter_region'
  },
  {
    id: 'specialist-availability',
    nome: 'Especialista em Disponibilidade',
    escopo: 'Capacidade, janelas de manutenção e disponibilidade',
    status: 'online',
    intent: 'datacenter_availability'
  }
];

function processar(pergunta, resultadosFAQ, respostaLLM, fonte) {
  const routing = {
    intent: fonte === 'faq' ? 'faq_direto' : fonte === 'llm' ? 'llm' : 'rag',
    confidence: fonte === 'faq' ? 0.98 : 0.85,
    agentsUsed: ['router-agent'],
    reasoning: `Roteamento baseado em ${fonte}`,
    duration: 1
  };

  return {
    resposta: respostaLLM || 'Desculpe, não entendi sua pergunta.',
    fonte: fonte,
    qualidade: fonte === 'faq' ? 98 : 75,
    contexto: { ehDataCenter: false },
    routing
  };
}

function getStatusAgentes() {
  return {
    agentes: ESPECIALISTAS_DATA_CENTER,
    status: 'online',
    routing: {
      intents: [
        'datacenter_location',
        'datacenter_contact',
        'datacenter_directory',
        'datacenter_region',
        'datacenter_availability',
        'faq',
        'llm',
        'rag',
        'knowledge-base'
      ],
      confidence: 0.95
    }
  };
}

/**
 * Monta o contexto textual enviado ao LLM a partir dos resultados da FAQ.
 * @param {string} pergunta
 * @param {Array<{pergunta:string, resposta:string, score:number}>} resultadosFAQ
 * @returns {string}
 */
function gerarContextoLLM(pergunta, resultadosFAQ = []) {
  const itens = Array.isArray(resultadosFAQ) ? resultadosFAQ : [];

  let contexto = `[PERGUNTA DO USUÁRIO]\n${pergunta || ''}\n`;

  if (itens.length === 0) {
    return `${contexto}\n[BASE DE CONHECIMENTO]\nNenhum documento relevante foi recuperado para esta pergunta.\n`;
  }

  contexto += '\n[BASE DE CONHECIMENTO]\n';
  itens.forEach((item, i) => {
    const score = Number(item.score || 0);
    contexto += `\nFAQ item ${i + 1} (score ${score.toFixed(2)}):\n`
      + `Pergunta: ${item.pergunta || ''}\n`
      + `Resposta: ${item.resposta || ''}\n`;
  });

  contexto += '\nCite a origem de cada informação utilizada no formato "Segundo FAQ item N (score X)".';
  return contexto;
}

function listarPerguntasPendentes(limite) {
  return knowledgeGap.listarPerguntasPendentes(limite);
}

async function getQualityDashboard() {
  return qualityAgent.getQualityImprovementAgent().getDashboard();
}

async function runQualityEvaluation() {
  return qualityAgent.getQualityImprovementAgent().runOnce();
}

module.exports = {
  processar,
  getStatusAgentes,
  gerarContextoLLM,
  ESPECIALISTAS_DATA_CENTER,
  knowledgeGap,
  qualityAgent: {
    getDashboard: getQualityDashboard,
    runEvaluation: runQualityEvaluation
  }
};