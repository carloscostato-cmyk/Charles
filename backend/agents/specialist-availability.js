/**
 * specialist-availability.js
 *
 * Especialista em disponibilidade e janelas de manutenção dos Data Centers.
 *
 * ⚠️ ISO/IEC 42001 — Cláusula 6.3 (Explicação de Limitações):
 * Este agente NÃO possui acesso a monitoramento, CMDB ou sistema de alarme.
 * É TERMINANTEMENTE PROIBIDO afirmar que um Data Center está "operacional",
 * "saudável" ou "sem ocorrências" — seria alucinação com aparência de
 * utilidade, sem fonte.
 *
 * Este agente responde apenas o que a base documental sustenta:
 * - Que não tem acesso ao status
 * - Onde ficam as unidades e como contatá-las
 * - A quem recorrer para confirmar disponibilidade
 *
 * A verificação de status pertence ao sistema de monitoramento e ao Analyst
 * responsável. Ver docs/iso-42001/POLITICA-USO-ACEPTAVEL.md §5.
 */

/** Orienta o usuário para a fonte correta, sem afirmar status. */
const RESPOSTA_LIMITE =
  'Não tenho acesso a monitoramento, CMDB ou sistema de alarme, então não consigo '
  + 'confirmar o status operacional de nenhuma unidade — afirmar isso sem fonte seria '
  + 'te passar uma informação inventada.\n\n'
  + 'Para confirmar disponibilidade:\n'
  + '**1.** Consulte o sistema de monitoramento oficial do datacenter.\n'
  + '**2.** Para janela de manutenção e agenda, consulte a documentação do serviço no portal interno.\n'
  + '**3.** Em emergência, contate o NOC pelo ramal da unidade (posso informar o número).\n\n'
  + 'Quer que eu te passe o contato de alguma unidade específica?';

module.exports = {
  getSpecialistAvailability() {
    return {
      /**
       * Reconhece perguntas sobre status/disponibilidade.
       * Vocabulário amplo para que a dúvida NÃO caia no LLM
       * (que poderia inventar um status).
       */
      isAvailabilityQuery(pergunta) {
        const p = (pergunta || '').toLowerCase();
        const keywords = [
          'disponível', 'disponibilidade', 'online', 'ativo', 'ativa',
          'capacidade', 'energia', 'segurança', 'manutenção', 'manutencao',
          'blackout', 'janela', 'status', 'funcionando', 'saudavel', 'saudável',
          'no ar', 'uptime'
        ];
        return keywords.some(k => p.includes(k));
      },

      /**
       * Responde com honestidade sobre o limite de competência.
       * @param {string} _pergunta
       * @returns {string}
       */
      responder(_pergunta) {
        return RESPOSTA_LIMITE;
      },

      /**
       * Declara a ausência de capacidade de afirmar status — usado por
       * auditoria e testes para comprovar a conformidade 6.3.
       * @returns {boolean} sempre false
       */
      podeAfirmarStatusOperacional() {
        return false;
      }
    };
  }
};