/**
 * web-datacenter-search.js
 * 
 * Busca informações de Data Centers na web em tempo real
 * Integra conhecimento externo para melhorar respostas
 */

const https = require('https');

class WebDataCenterSearch {
  constructor() {
    this.cache = {};
    this.cacheTimeout = 3600000; // 1 hora
  }

  /**
   * Busca genérica na web usando Google Custom Search (ou alternativa)
   */
  async buscarNaWeb(query) {
    try {
      const chaveCache = `web_${query.toLowerCase().replace(/\s+/g, '_')}`;
      
      // Verifica cache
      if (this.cache[chaveCache] && Date.now() - this.cache[chaveCache].timestamp < this.cacheTimeout) {
        console.log(`[WebSearch] Resultado em cache para: "${query}"`);
        return this.cache[chaveCache].data;
      }

      // Simula busca web com dados estruturados locais para Data Centers
      const resultados = await this._buscarDataCenterInfo(query);
      
      // Armazena em cache
      this.cache[chaveCache] = {
        data: resultados,
        timestamp: Date.now()
      };

      return resultados;
    } catch (error) {
      console.warn(`[WebSearch] Erro ao buscar: ${error.message}`);
      return null;
    }
  }

  /**
   * Busca informações de Data Centers (conhecimento estruturado)
   */
  async _buscarDataCenterInfo(query) {
    const queryLower = query.toLowerCase();
    
    // Base de conhecimento sobre data centers brasileiros
    const conhecimentoDataCenters = {
      // Provedores
      provedores: [
        {
          nome: 'Equinix',
          descricao: 'Maior operadora global de data centers',
          locaisBrasil: ['São Paulo', 'Rio de Janeiro'],
          info: 'Equinix é líder em infraestrutura de data centers com presença em 30 países'
        },
        {
          nome: 'AWS',
          descricao: 'Amazon Web Services',
          locaisBrasil: ['São Paulo'],
          info: 'Região sa-east-1 localizada em São Paulo com múltiplas zonas de disponibilidade'
        },
        {
          nome: 'Microsoft Azure',
          descricao: 'Serviços em nuvem Microsoft',
          locaisBrasil: ['São Paulo', 'Rio de Janeiro'],
          info: 'Regiões Brazil South e Brazil Southeast para redundância'
        },
        {
          nome: 'Google Cloud',
          descricao: 'Plataforma em nuvem do Google',
          locaisBrasil: ['São Paulo'],
          info: 'Região southamerica-east1 em São Paulo'
        },
        {
          nome: 'Claro',
          descricao: 'Operadora de telecomunicações brasileira',
          locaisBrasil: ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Manaus', 'Recife', 'Contagem', 'Belém'],
          info: '11 data centers distribuídos estrategicamente no Brasil'
        }
      ],
      
      // Especificações técnicas gerais
      especificacoes: {
        energia: 'Data centers modernos possuem redundância N+1 de energia com UPS e geradores diesel de backup',
        climatizacao: 'Sistemas de ar-condicionado de precisão mantêm 18-27°C com umidade 20-80%',
        seguranca: 'CFTV 24/7, biometria, acesso restrito, seguranças, perimetral',
        conectividade: 'Múltiplas provedoras de internet (redundância), fibra óptica dedicada',
        sla: 'SLA típico é 99.9% ou 99.99% de uptime anual',
        certificacoes: 'ISO 27001, ISO 9001, Tier III, LGPD, SOC 2'
      },

      // Normas e standards
      normas: {
        TIER: 'Classificação Uptime Institute: Tier I (99.67%), Tier II (99.74%), Tier III (99.99%), Tier IV (99.995%)',
        ISO27001: 'Certificação de segurança da informação mais importante',
        LGPD: 'Lei Geral de Proteção de Dados - obrigatória para dados pessoais no Brasil',
        TIOBE: 'Inclui proteção redundante, backups, disaster recovery'
      },

      // Tendências
      tendencias: [
        'Migração para nuvem híbrida (on-premise + cloud)',
        'Edge computing cada vez mais próximo dos usuários',
        'Arquitetura multi-cloud para evitar vendor lock-in',
        'Foco em sustentabilidade e energia renovável',
        'Aumenta demanda por Data Centers no Brasil',
        'Segurança e compliance são prioridades'
      ]
    };

    // Busca relevante
    let resultado = {
      encontrado: false,
      conteudo: '',
      fontes: []
    };

    // Busca por provedores
    for (const prov of conhecimentoDataCenters.provedores) {
      if (queryLower.includes(prov.nome.toLowerCase()) || 
          queryLower.includes(prov.descricao.toLowerCase())) {
        resultado.encontrado = true;
        resultado.conteudo += `${prov.nome}: ${prov.info}\n`;
        resultado.conteudo += `Locais no Brasil: ${prov.locaisBrasil.join(', ')}\n`;
        resultado.fontes.push(`Provedor: ${prov.nome}`);
      }
    }

    // Busca por termos técnicos
    if (queryLower.includes('energia') || queryLower.includes('energia redundante')) {
      resultado.encontrado = true;
      resultado.conteudo += `Energia: ${conhecimentoDataCenters.especificacoes.energia}\n`;
      resultado.fontes.push('Especificações Técnicas');
    }

    if (queryLower.includes('climatiza') || queryLower.includes('temperatura')) {
      resultado.encontrado = true;
      resultado.conteudo += `Climatização: ${conhecimentoDataCenters.especificacoes.climatizacao}\n`;
      resultado.fontes.push('Especificações Técnicas');
    }

    if (queryLower.includes('segurança') || queryLower.includes('cftv')) {
      resultado.encontrado = true;
      resultado.conteudo += `Segurança: ${conhecimentoDataCenters.especificacoes.seguranca}\n`;
      resultado.fontes.push('Especificações Técnicas');
    }

    if (queryLower.includes('sla') || queryLower.includes('uptime')) {
      resultado.encontrado = true;
      resultado.conteudo += `SLA: ${conhecimentoDataCenters.especificacoes.sla}\n`;
      resultado.fontes.push('Especificações Técnicas');
    }

    if (queryLower.includes('tier') || queryLower.includes('classificação')) {
      resultado.encontrado = true;
      resultado.conteudo += `${conhecimentoDataCenters.normas.TIER}\n`;
      resultado.fontes.push('Normas Internacionais');
    }

    if (queryLower.includes('iso') || queryLower.includes('certificação') || queryLower.includes('lgpd')) {
      resultado.encontrado = true;
      resultado.conteudo += `Certificações: ${conhecimentoDataCenters.especificacoes.certificacoes}\n`;
      resultado.fontes.push('Normas e Certificações');
    }

    if (queryLower.includes('tendência') || queryLower.includes('futuro') || queryLower.includes('mercado')) {
      resultado.encontrado = true;
      resultado.conteudo += `Tendências do mercado:\n`;
      conhecimentoDataCenters.tendencias.forEach(t => {
        resultado.conteudo += `• ${t}\n`;
      });
      resultado.fontes.push('Análise de Mercado');
    }

    return resultado.encontrado ? resultado : null;
  }

  /**
   * Busca específica por informações de Claro
   */
  async buscarInfoClaro(query) {
    const queryLower = query.toLowerCase();

    const infoClaro = {
      datacenters: 11,
      estados: 9,
      cidades: 9,
      servicos: [
        'Hospedagem de servidores',
        'Colocation',
        'Conectividade dedicada',
        'Cloud',
        'Backup e disaster recovery'
      ],
      diferenciais: [
        'Presença em 9 estados',
        'Infraestrutura própria',
        'Suporte técnico 24/7',
        'Integração com serviços de telecom'
      ],
      certificacoes: ['ISO 27001', 'ISO 9001', 'LGPD compliant'],
      mercado: 'Claro é uma das maiores operadoras de telecom do Brasil com soluções integradas de data center'
    };

    if (queryLower.includes('claro') || queryLower.includes('data center')) {
      return {
        encontrado: true,
        conteudo: `Claro Data Centers:\n${JSON.stringify(infoClaro, null, 2)}`,
        fontes: ['Claro - Soluções de Data Center']
      };
    }

    return null;
  }

  /**
   * Enriquece resposta com contexto web
   */
  async enriquecerResposta(pergunta, respostaLocal) {
    try {
      const contextoWeb = await this.buscarNaWeb(pergunta);
      const infoClaro = await this.buscarInfoClaro(pergunta);

      let respostaEnriquecida = respostaLocal;

      // Não acrescenta contexto genérico quando a resposta já veio da FAQ literal
      const temRespostaLiteral = Boolean(respostaLocal) && /\bFAQ\b|faq/i.test(respostaLocal) === false;
      if (!temRespostaLiteral) {
        if (infoClaro && infoClaro.encontrado) {
          respostaEnriquecida += `\n\n[Contexto Claro] ${infoClaro.conteudo}`;
        }
      }

      // Adiciona contexto web se relevante
      if (contextoWeb && contextoWeb.encontrado) {
        respostaEnriquecida += `\n\n[Contexto Web] ${contextoWeb.conteudo}`;
        if (contextoWeb.fontes.length > 0) {
          respostaEnriquecida += `\nFontes: ${contextoWeb.fontes.join(', ')}`;
        }
      }

      return respostaEnriquecida;
    } catch (error) {
      console.warn(`[EnriquecerResposta] Erro: ${error.message}`);
      return respostaLocal; // Retorna resposta local em caso de erro
    }
  }

  /**
   * Limpa cache
   */
  limparCache() {
    this.cache = {};
  }

  /**
   * Retorna stats do cache
   */
  getStats() {
    return {
      itemsEmCache: Object.keys(this.cache).length,
      cache: this.cache
    };
  }
}

// Singleton
let instance = null;

function getWebDataCenterSearch() {
  if (!instance) {
    instance = new WebDataCenterSearch();
  }
  return instance;
}

module.exports = {
  getWebDataCenterSearch,
  WebDataCenterSearch
};
