/**
 * specialist-locator.js
 * 
 * Especialista em localização e endereços dos 11 Data Centers da Claro.
 * Consulta o DataCenterLoader para trazer dados reais e precisos de endereços, CEP, bairros e telefones.
 */

const { getDataCenterLoader } = require('../rag/datacenter-loader');

module.exports = {
  getSpecialistLocator() {
    const loader = getDataCenterLoader();

    return {
      isLocationQuery(pergunta) {
        // Normaliza: minúsculas e sem acentos (produção → producao, endereço → endereco)
        const p = (pergunta || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');

        // 1) Guarda negativa: intenção técnica/principal DOMINA.
        //    Perguntas de senha, configuração, procedimento etc. NUNCA são
        //    consulta de endereço, mesmo citando cidade ou UF.
        const RE_TECNICO = /\b(senha[s]?|credenciais?|login|usuario|configurar|configuracao|como (eu )?fac[o]|instalar|instalacao|procedimento|passo a passo|runbook|erro[s]?|falha[s]?|alarme[s]?|logs?|backup|firmware|reset|atualizar|atualizacao|upgrade|deploy|balanceador|big-?ip|f5|firewall|vlan|script|certificado|licenca|incidente[s]?|problema[s]?|tutorial|exemplo|politica|norma|processo)\b/;

        // 2) Intenção explícita de localização/endereço/contato
        const RE_LOCAL = /\b(endereco[s]?|sede|localizacao|onde fica|onde esta|onde se localiza|fica em|mais proxim[oa]s?|mais perto|telefone[s]?|contato|cep|rota|como chego|mapa)\b/;

        // 3) Cidade com Data Center como palavra completa (nunca substring)
        const RE_CIDADE = /\b(sao paulo|rio de janeiro|brasilia|belem|manaus|recife|contagem|belo horizonte|espirito santo|vitoria|campinas|curitiba)\b/;

        // 4) UF como palavra isolada — \b impede "producao" casar "pr"
        const RE_UF = /\b(sp|rj|df|pa|am|pe|mg|es|pr)\b/;

        if (RE_TECNICO.test(p)) return false;
        if (RE_LOCAL.test(p)) return true;
        if (RE_CIDADE.test(p) || RE_UF.test(p)) return true;
        return false;
      },

      responder(pergunta) {
        const query = (pergunta || '').trim();
        const dcs = loader.search(query);

        if (dcs && dcs.length > 0) {
          if (dcs.length === 1) {
            const dc = dcs[0];
            const compl = dc.complemento ? `, ${dc.complemento}` : '';
            return `O Data Center da Claro em **${dc.cidade} - ${dc.uf}** (${dc.titulo}) fica localizado em:\n\n📍 **Endereço:** ${dc.endereco}, nº ${dc.numero}${compl}\n🏘️ **Bairro:** ${dc.bairro} | **CEP:** ${dc.cep}\n📞 **Telefone de Contato:** ${dc.telefone}`;
          }

          let resposta = `Encontrei **${dcs.length} unidades** de Data Center correspondentes à sua busca:\n\n`;
          dcs.forEach((dc, i) => {
            const compl = dc.complemento ? `, ${dc.complemento}` : '';
            resposta += `**${i + 1}. ${dc.titulo} (${dc.cidade}/${dc.uf})**\n`;
            resposta += `📍 Endereço: ${dc.endereco}, nº ${dc.numero}${compl}, ${dc.bairro} - CEP: ${dc.cep}\n`;
            resposta += `📞 Telefone: ${dc.telefone}\n\n`;
          });
          return resposta.trim();
        }

        // Fallback se não especificou a cidade
        const cidades = loader.getCidades();
        return `Temos 11 unidades de Data Center da Claro no Brasil, incluindo: ${cidades.join(', ')}. Por favor, informe qual cidade ou estado você deseja consultar para eu te passar o endereço exato!`;
      }
    };
  }
};