/**
 * specialist-region.js
 * 
 * Especialista em regiões e estados dos Data Centers da Claro.
 */

const { getDataCenterLoader } = require('../rag/datacenter-loader');

module.exports = {
  getSpecialistRegion() {
    const loader = getDataCenterLoader();

    return {
      isRegionQuery(pergunta) {
        const p = (pergunta || '').toLowerCase();
        const keywords = ['região', 'regiao', 'sudeste', 'nordeste', 'norte', 'sul', 'centro-oeste', 'centro oeste', 'estado', 'ufs'];
        return keywords.some(k => p.includes(k));
      },

      responder(pergunta) {
        const p = (pergunta || '').toLowerCase();
        const dcs = loader.getAll();

        if (p.includes('sudeste')) {
          const sudeste = dcs.filter(dc => ['SP', 'RJ', 'MG', 'ES'].includes(dc.uf));
          let res = `Na **Região Sudeste**, temos ${sudeste.length} Data Centers:\n\n`;
          sudeste.forEach(dc => res += `• **${dc.titulo}** (${dc.cidade}/${dc.uf}) - Tel: ${dc.telefone}\n`);
          return res.trim();
        }

        if (p.includes('norte')) {
          const norte = dcs.filter(dc => ['PA', 'AM'].includes(dc.uf));
          let res = `Na **Região Norte**, temos ${norte.length} Data Centers:\n\n`;
          norte.forEach(dc => res += `• **${dc.titulo}** (${dc.cidade}/${dc.uf}) - Tel: ${dc.telefone}\n`);
          return res.trim();
        }

        if (p.includes('nordeste')) {
          const nordeste = dcs.filter(dc => ['PE'].includes(dc.uf));
          let res = `Na **Região Nordeste**, temos ${nordeste.length} Data Center:\n\n`;
          nordeste.forEach(dc => res += `• **${dc.titulo}** (${dc.cidade}/${dc.uf}) - Tel: ${dc.telefone}\n`);
          return res.trim();
        }

        if (p.includes('centro-oeste') || p.includes('centro oeste')) {
          const co = dcs.filter(dc => ['DF', 'GO', 'MT', 'MS'].includes(dc.uf));
          let res = `Na **Região Centro-Oeste**, temos ${co.length} Data Center:\n\n`;
          co.forEach(dc => res += `• **${dc.titulo}** (${dc.cidade}/${dc.uf}) - Tel: ${dc.telefone}\n`);
          return res.trim();
        }

        return `Os Data Centers da Claro estão distribuídos pelas regiões Sudeste (SP, RJ, MG, ES), Centro-Oeste (DF), Norte (PA, AM) e Nordeste (PE).`;
      }
    };
  }
};