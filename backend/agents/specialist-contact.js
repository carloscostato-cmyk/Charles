/**
 * specialist-contact.js
 * 
 * Especialista em contatos e telefones dos Data Centers da Claro.
 */

const { getDataCenterLoader } = require('../rag/datacenter-loader');

module.exports = {
  getSpecialistContact() {
    const loader = getDataCenterLoader();

    return {
      isContactQuery(pergunta) {
        const p = (pergunta || '').toLowerCase();
        const keywords = ['telefone', 'contato', 'ligar', 'telefonar', 'fale', 'ramal', 'fone', 'numero'];
        return keywords.some(k => p.includes(k));
      },

      responder(pergunta) {
        const query = (pergunta || '').trim();
        const dcs = loader.search(query);

        if (dcs && dcs.length > 0) {
          if (dcs.length === 1) {
            const dc = dcs[0];
            return `O telefone de contato do Data Center da Claro em **${dc.cidade}/${dc.uf}** (${dc.titulo}) é **${dc.telefone}**.\n\n📍 Endereço: ${dc.endereco}, nº ${dc.numero}, ${dc.bairro}.`;
          }

          let resposta = `Contatos dos Data Centers encontrados:\n\n`;
          dcs.forEach((dc, i) => {
            resposta += `📞 **${dc.titulo} (${dc.cidade}/${dc.uf}):** ${dc.telefone}\n`;
          });
          return resposta.trim();
        }

        return 'Para obter o telefone de um Data Center, informe a cidade ou unidade desejada (ex: São Paulo, Rio de Janeiro, Brasília, etc.).';
      }
    };
  }
};