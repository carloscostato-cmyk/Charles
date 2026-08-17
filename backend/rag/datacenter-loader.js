/**
 * datacenter-loader.js
 * 
 * Carrega dados dos 11 Data Centers da Claro
 * Indexa no RAG para busca semântica de localizações e informações
 * 
 * Estrutura: Título, Endereço, Número, Complemento, Bairro, CEP, Cidade, UF, Telefone
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

class DataCenterLoader {
  constructor() {
    this.datacenters = [];
    this.loaded = false;
  }

  /**
   * Carrega dados do Excel
   */
  loadFromExcel(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        console.warn('[DataCenterLoader] Arquivo não encontrado:', filePath);
        return [];
      }

      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      this.datacenters = data.map((row, index) => ({
        id: index + 1,
        titulo: row.Título || row.titulo || '',
        endereco: row.Endereço || row.endereco || '',
        numero: row.Número || row.numero || '',
        complemento: row.Complemento || row.complemento || '',
        bairro: row.Bairro || row.bairro || '',
        cep: row.CEP || row.cep || '',
        cidade: row.Cidade || row.cidade || '',
        uf: row.UF || row.uf || '',
        telefone: row.Telefone || row.telefone || '',
        // Campo consolidado para busca
        localizacao: `${row.Cidade || ''}, ${row.UF || ''}`,
        enderecoCompleto: `${row.Endereço || ''}, ${row.Número || ''} ${row.Complemento || ''} ${row.Bairro || ''} ${row.CEP || ''} ${row.Cidade || ''} ${row.UF || ''}`
      }));

      this.loaded = true;
      console.log(`[DataCenterLoader] ✅ ${this.datacenters.length} Data Centers carregados`);

      return this.datacenters;
    } catch (error) {
      console.error('[DataCenterLoader] Erro ao carregar Excel:', error.message);
      return [];
    }
  }

  /**
   * Busca data center por cidade
   */
  findByCidade(cidade) {
    const searchTerm = this.normalizeText(cidade).toLowerCase();
    return this.datacenters.filter(dc => {
      const cidadeNormalizada = this.normalizeText(dc.cidade).toLowerCase();
      const tituloNormalizado = this.normalizeText(dc.titulo).toLowerCase();
      return cidadeNormalizada.includes(searchTerm) || tituloNormalizado.includes(searchTerm);
    });
  }

  /**
   * Busca data center por UF
   */
  findByUF(uf) {
    const searchTerm = this.normalizeText(uf).toUpperCase();
    return this.datacenters.filter(dc =>
      this.normalizeText(dc.uf).toUpperCase() === searchTerm
    );
  }

  /**
   * Busca data center por nome/título
   */
  findByTitulo(titulo) {
    const searchTerm = this.normalizeText(titulo).toLowerCase();
    return this.datacenters.filter(dc =>
      this.normalizeText(dc.titulo).toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Retorna todas as informações de um data center
   */
  getInformacoes(id) {
    const dc = this.datacenters.find(d => d.id === id || d.titulo === id);
    if (!dc) return null;

    return {
      titulo: dc.titulo,
      endereco: dc.endereco,
      numero: dc.numero,
      complemento: dc.complemento,
      bairro: dc.bairro,
      cep: dc.cep,
      cidade: dc.cidade,
      uf: dc.uf,
      telefone: dc.telefone,
      enderecoCompleto: dc.enderecoCompleto
    };
  }

  /**
   * Retorna lista de todas as cidades
   */
  getCidades() {
    const cidades = [...new Set(this.datacenters.map(dc => dc.cidade))];
    return cidades.sort();
  }

  /**
   * Retorna lista de todos os UFs
   */
  getUFs() {
    const ufs = [...new Set(this.datacenters.map(dc => dc.uf))];
    return ufs.sort();
  }

  /**
   * Retorna lista de todos os data centers
   */
  getAll() {
    return this.datacenters;
  }

  /**
   * Remove acentos e caracteres especiais de um texto.
   */
  normalizeText(str) {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Busca por palavra-chave (cidade, UF, endereço, telefone)
   * Com normalização de acentos
   */
  search(query) {
    const normalizedQuery = this.normalizeText(query).toLowerCase();
    const searchTerms = normalizedQuery.split(/\s+/).filter(Boolean);

    const cityCandidates = [...new Set(this.datacenters.flatMap(dc => {
      const cidade = this.normalizeText(dc.cidade).toLowerCase();
      const uf = this.normalizeText(dc.uf).toLowerCase();
      return [cidade, uf].filter(Boolean);
    }))].filter(location => normalizedQuery.includes(location));

    if (cityCandidates.length > 0) {
      return this.datacenters.filter(dc => {
        const cidade = this.normalizeText(dc.cidade).toLowerCase();
        const uf = this.normalizeText(dc.uf).toLowerCase();
        return cityCandidates.some(location => cidade.includes(location) || uf.includes(location));
      });
    }

    return this.datacenters.filter(dc => {
      const titulo = this.normalizeText(dc.titulo).toLowerCase();
      const endereco = this.normalizeText(dc.endereco).toLowerCase();
      const bairro = this.normalizeText(dc.bairro).toLowerCase();
      const cidade = this.normalizeText(dc.cidade).toLowerCase();
      const uf = this.normalizeText(dc.uf).toLowerCase();
      const textoCompleto = `${titulo} ${endereco} ${bairro} ${cidade} ${uf} ${this.normalizeText(dc.cep)} ${this.normalizeText(dc.telefone)}`.toLowerCase();

      const matchesAllTerms = searchTerms.every(term => textoCompleto.includes(term));
      const hasCityMatch = searchTerms.some(term => cidade.includes(term) || uf.includes(term) || titulo.includes(term));

      return matchesAllTerms || hasCityMatch;
    });
  }

  /**
   * Formata data center para exibição amigável
   */
  formatarParaExibicao(dc) {
    return `
${dc.titulo}
Endereço: ${dc.endereco}, ${dc.numero}${dc.complemento ? ', ' + dc.complemento : ''}
${dc.bairro}, ${dc.cep}
${dc.cidade}, ${dc.uf}
Telefone: ${dc.telefone}
    `.trim();
  }

  /**
   * Retorna contexto para RAG (para indexação)
   */
  gerarContextoRAG() {
    return this.datacenters.map(dc => ({
      id: dc.id,
      content: `Data Center: ${dc.titulo}
Localização: ${dc.cidade}, ${dc.uf}
Endereço: ${dc.enderecoCompleto}
Telefone: ${dc.telefone}`,
      metadata: {
        tipo: 'datacenter',
        titulo: dc.titulo,
        cidade: dc.cidade,
        uf: dc.uf,
        telefone: dc.telefone
      }
    }));
  }

  /**
   * Retorna estatísticas
   */
  getStats() {
    const cidades = new Set(this.datacenters.map(dc => dc.cidade));
    const ufs = new Set(this.datacenters.map(dc => dc.uf));

    return {
      totalDataCenters: this.datacenters.length,
      cidades: cidades.size,
      ufs: ufs.size,
      listaCidades: Array.from(cidades).sort(),
      listaUFs: Array.from(ufs).sort(),
      loaded: this.loaded
    };
  }
}

// Singleton
let instance = null;

function getDataCenterLoader() {
  if (!instance) {
    instance = new DataCenterLoader();
  }
  return instance;
}

module.exports = {
  getDataCenterLoader,
  DataCenterLoader
};
