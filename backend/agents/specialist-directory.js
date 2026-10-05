/**
 * specialist-directory.js
 * 
 * Especialista no diretório completo dos Data Centers da Claro.
 */

const { getDataCenterLoader } = require('../rag/datacenter-loader');

module.exports = {
  getSpecialistDirectory() {
    const loader = getDataCenterLoader();

    return {
      isDirectoryQuery(pergunta) {
        const p = (pergunta || '').toLowerCase();
        const keywords = ['lista', 'diretório', 'diretorio', 'todos os data centers', 'quais são os data centers', 'quantos data centers', 'unidades de data center'];
        return keywords.some(k => p.includes(k));
      },

      responder(pergunta) {
        const dcs = loader.getAll();

        if (dcs && dcs.length > 0) {
          let resposta = `A Claro conta com **${dcs.length} unidades de Data Center** distribuídas pelo Brasil:\n\n`;
          dcs.forEach((dc, i) => {
            resposta += `**${i + 1}. ${dc.titulo}** — ${dc.cidade}, ${dc.uf}\n`;
            resposta += `   📍 ${dc.endereco}, nº ${dc.numero} - ${dc.bairro}\n`;
            resposta += `   📞 Tel: ${dc.telefone}\n\n`;
          });
          return resposta.trim();
        }

        return 'Temos 11 unidades de Data Center espalhadas pelo Brasil (São Paulo, Rio de Janeiro, Brasília, Contagem/MG, Belém, Manaus, Recife, etc.).';
      }
    };
  }
};