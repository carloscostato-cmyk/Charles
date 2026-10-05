/**
 * knowledge-base.js
 * 
 * Base de Conhecimento Unificada
 * Combina FAQ + DataCenters em um contexto único para o LLM
 */

const { lerFAQ } = require('./faq-reader');
const { getDataCenterLoader } = require('./rag/datacenter-loader');

class KnowledgeBase {
  constructor() {
    this.faq = [];
    this.datacenters = [];
    this.contextoCompleto = '';
    this.inicializado = false;
  }

  /**
   * Inicializa a base de conhecimento
   */
  async inicializar() {
    console.log('[KnowledgeBase] Inicializando...');

    try {
      // Carrega FAQ
      this.faq = lerFAQ();
      console.log(`[KnowledgeBase] FAQ carregado: ${this.faq.length} itens`);

      // Carrega Data Centers
      const dcLoader = getDataCenterLoader();
      this.datacenters = dcLoader.getAll();
      console.log(`[KnowledgeBase] Data Centers carregado: ${this.datacenters.length} itens`);

      // Constrói contexto completo
      this._construirContexto();

      this.inicializado = true;
      console.log('[KnowledgeBase] ✅ Base de conhecimento pronta');

      return true;
    } catch (error) {
      console.error('[KnowledgeBase] Erro ao inicializar:', error.message);
      return false;
    }
  }

  /**
   * Constrói o contexto completo em memória
   */
  _construirContexto() {
    let contexto = '';

    // ===== FAQ =====
    contexto += '=== FAQ DA CLARO DATA CENTER ===\n\n';
    this.faq.forEach((item, i) => {
      contexto += `${i + 1}. P: ${item.pergunta}\n`;
      contexto += `   R: ${item.resposta}\n\n`;
    });

    // ===== DATA CENTERS =====
    contexto += '\n\n=== CLARO DATA CENTERS (11 UNIDADES) ===\n\n';
    this.datacenters.forEach((dc, i) => {
      contexto += `${i + 1}. ${dc.titulo}\n`;
      contexto += `   Local: ${dc.cidade}, ${dc.uf}\n`;
      contexto += `   Endereço: ${dc.endereco}, ${dc.numero}${dc.complemento ? ', ' + dc.complemento : ''}\n`;
      contexto += `   Bairro: ${dc.bairro} | CEP: ${dc.cep}\n`;
      contexto += `   Telefone: ${dc.telefone}\n\n`;
    });

    this.contextoCompleto = contexto;
  }

  /**
   * Retorna o contexto completo para o LLM
   */
  getContextoCompleto() {
    return this.contextoCompleto;
  }

  /**
   * Alias de compatibilidade
   */
  getContext(pergunta) {
    return this.getContextoOtimizado(pergunta);
  }

  /**
   * Retorna contexto resumido (para prompts grandes)
   */
  getContextoResumido() {
    let contexto = '';

    // FAQ - primeiros 10 itens
    contexto += '=== FAQ CLARO DATA CENTER ===\n';
    this.faq.slice(0, 10).forEach((item, i) => {
      contexto += `${i + 1}. ${item.pergunta.substring(0, 60)}... → ${item.resposta.substring(0, 40)}...\n`;
    });

    // Data Centers - todos
    contexto += '\n=== CLARO DATA CENTERS ===\n';
    this.datacenters.forEach((dc, i) => {
      contexto += `${i + 1}. ${dc.titulo} - ${dc.cidade}, ${dc.uf} | Tel: ${dc.telefone}\n`;
    });

    return contexto;
  }

  /**
   * Busca por termo no FAQ
   */
  buscarNoFAQ(termo) {
    const termoLower = termo.toLowerCase();
    return this.faq.filter(item =>
      item.pergunta.toLowerCase().includes(termoLower) ||
      item.resposta.toLowerCase().includes(termoLower)
    );
  }

  /**
   * Busca por termo nos Data Centers
   */
  buscarNosDataCenters(termo) {
    const termoLower = termo.toLowerCase();
    return this.datacenters.filter(dc =>
      dc.titulo.toLowerCase().includes(termoLower) ||
      dc.cidade.toLowerCase().includes(termoLower) ||
      dc.uf.toLowerCase().includes(termoLower) ||
      dc.endereco.toLowerCase().includes(termoLower) ||
      dc.telefone.includes(termoLower)
    );
  }

  /**
   * Busca unificada na base de conhecimento (FAQ + Data Centers)
   * @param {string} termo
   * @param {number} limite
   * @returns {Array}
   */
  search(termo, limite = 5) {
    const faq = this.buscarNoFAQ(termo).map(f => ({
      tipo: 'faq',
      pergunta: f.pergunta,
      resposta: f.resposta,
      texto: `P: ${f.pergunta}\nR: ${f.resposta}`
    }));

    const dcs = this.buscarNosDataCenters(termo).map(dc => ({
      tipo: 'datacenter',
      titulo: dc.titulo,
      cidade: dc.cidade,
      uf: dc.uf,
      endereco: dc.endereco,
      telefone: dc.telefone,
      texto: `${dc.titulo} - ${dc.cidade}, ${dc.uf} (${dc.endereco}) | Tel: ${dc.telefone}`
    }));

    return [...faq, ...dcs].slice(0, limite);
  }

  /**
   * Retorna estatísticas da base
   */
  getStats() {
    return {
      faq: {
        total: this.faq.length,
        primeiroItem: this.faq[0]?.pergunta || 'N/A',
        ultimoItem: this.faq[this.faq.length - 1]?.pergunta || 'N/A'
      },
      datacenters: {
        total: this.datacenters.length,
        cidades: [...new Set(this.datacenters.map(dc => dc.cidade))].length,
        estados: [...new Set(this.datacenters.map(dc => dc.uf))].length,
        locais: [...new Set(this.datacenters.map(dc => dc.cidade))].sort()
      },
      contextoByte: this.contextoCompleto.length,
      inicializado: this.inicializado
    };
  }

  /**
   * Retorna FAQ como string formatada
   */
  getFAQFormatada() {
    let faqStr = '';
    this.faq.forEach((item, i) => {
      faqStr += `Q${i + 1}: ${item.pergunta}\n`;
      faqStr += `A${i + 1}: ${item.resposta}\n\n`;
    });
    return faqStr;
  }

  /**
   * Retorna Data Centers como string formatada
   */
  getDataCentersFormatados() {
    let dcStr = '';
    this.datacenters.forEach((dc, i) => {
      dcStr += `DC${i + 1}: ${dc.titulo}\n`;
      dcStr += `  Local: ${dc.cidade}, ${dc.uf}\n`;
      dcStr += `  Endereço: ${dc.endereco}, ${dc.numero}\n`;
      dcStr += `  Telefone: ${dc.telefone}\n\n`;
    });
    return dcStr;
  }

  /**
   * Prepara contexto otimizado para pergunta específica
   */
  getContextoOtimizado(pergunta) {
    const termoLower = pergunta.toLowerCase();
    let contexto = '';

    // Busca FAQ relevante
    const faqRelevante = this.buscarNoFAQ(pergunta);
    if (faqRelevante.length > 0) {
      contexto += '=== FAQ RELEVANTE ===\n';
      faqRelevante.forEach(item => {
        contexto += `Q: ${item.pergunta}\n`;
        contexto += `A: ${item.resposta}\n\n`;
      });
    }

    // Busca Data Centers relevantes
    const dcRelevantes = this.buscarNosDataCenters(pergunta);
    if (dcRelevantes.length > 0) {
      contexto += '\n=== DATA CENTERS RELEVANTES ===\n';
      dcRelevantes.forEach(dc => {
        contexto += `${dc.titulo}\n`;
        contexto += `  ${dc.cidade}, ${dc.uf}\n`;
        contexto += `  ${dc.endereco}, ${dc.numero}\n`;
        contexto += `  Telefone: ${dc.telefone}\n\n`;
      });
    }

    // Se não encontrou nada específico, retorna resumido
    if (!contexto) {
      contexto = this.getContextoResumido();
    }

    return contexto;
  }
}

// Singleton
let instance = null;

async function getKnowledgeBase() {
  if (!instance) {
    instance = new KnowledgeBase();
    await instance.inicializar();
  }
  return instance;
}

module.exports = {
  getKnowledgeBase,
  KnowledgeBase
};
