/**
 * metrica-fontes.js
 *
 * Métrica operacional: % de respostas com fonte documental vs. sem evidência.
 * Roda 5 perguntas-âncora + perguntas registradas em knowledge-gaps.json
 * contra a base real (FAQ + Data Centers), SEM chamar LLM.
 *
 * Uso: npm run metricas:fontes
 */

const path = require('path');
const { lerFAQ } = require('../faq-reader');
const { buscarNaFAQ } = require('../faq-search');
const { getDataCenterLoader } = require('../rag/datacenter-loader');

const LIMIAR_FONTE = 0.2; // mesmo limiar de faq-search.js

const PERGUNTAS_ANCORAS = [
  'como dar acesso a novas pessoas no portal',
  'Qual o principal objetivo do modelo ITSM no Data Center?',
  'Como evitar falhas de governança no processo de mudança?',
  'O que fazer em caso de indisponibilidade do sistema de chamados (Znuny)?',
  'Qual o impacto de não registrar corretamente um incidente?'
];

function carregarGaps() {
  try {
    const arquivo = path.join(__dirname, '..', '..', 'knowledge-gaps.json');
    const dados = JSON.parse(require('fs').readFileSync(arquivo, 'utf8'));
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

function avaliar(pergunta, faq, datacenters) {
  const faqHit = buscarNaFAQ(pergunta, faq, 1)[0];
  const temFonteFAQ = !!faqHit && faqHit.score > LIMIAR_FONTE;
  const temFonteDC = datacenters.length > 0 && datacenters.search(pergunta).length > 0;
  return {
    pergunta,
    fonte: temFonteFAQ ? 'faq' : temFonteDC ? 'datacenter' : 'nenhuma',
    scoreFAQ: faqHit ? Number(faqHit.score.toFixed(2)) : 0
  };
}

function main() {
  console.log('==============================================');
  console.log(' MÉTRICA DE FONTES DOCUMENTAIS - Charles');
  console.log('==============================================\n');

  const faq = lerFAQ();
  const dcLoader = getDataCenterLoader();
  dcLoader.loadFromExcel(path.join(__dirname, '..', '..', 'sites_data_center.xlsx'));

  // 1) Perguntas-âncora (devem ter fonte)
  console.log('--- Perguntas-âncora (esperado: com fonte) ---');
  const ancoras = PERGUNTAS_ANCORAS.map((p) => avaliar(p, faq, dcLoader));
  ancoras.forEach((r) => {
    console.log(`  [${r.fonte === 'nenhuma' ? 'X' : 'OK'}] ${r.pergunta} → ${r.fonte}${r.scoreFAQ ? ` (${r.scoreFAQ})` : ''}`);
  });

  // 2) Lacunas registradas (perguntas que o bot não soube responder)
  const gaps = carregarGaps().filter((g) => !g.respondida);
  console.log(`\n--- Lacunas pendentes em knowledge-gaps.json (${gaps.length}) ---`);
  const gapsAvaliados = gaps.map((g) => avaliar(g.pergunta, faq, dcLoader));
  gapsAvaliados.forEach((r) => {
    console.log(`  [${r.fonte === 'nenhuma' ? '-' : 'HOJE TERIA FONTE'}] ${r.pergunta} → ${r.fonte}`);
  });

  // 3) Consolidação
  const comFonte = ancoras.filter((r) => r.fonte !== 'nenhuma').length;
  const pctAncoras = ((comFonte / ancoras.length) * 100).toFixed(0);
  const gapsSemFonte = gapsAvaliados.filter((r) => r.fonte === 'nenhuma').length;
  const pctGapsSemFonte = gapsAvaliados.length
    ? ((gapsSemFonte / gapsAvaliados.length) * 100).toFixed(0)
    : 'n/a';

  console.log('\n==============================================');
  console.log(`Âncoras com fonte documental:   ${comFonte}/${ancoras.length} (${pctAncoras}%)`);
  console.log(`Lacunas ainda sem fonte:        ${gapsSemFonte}/${gapsAvaliados.length} (${pctGapsSemFonte}%)`);
  console.log('==============================================');
  console.log('Obs: mede apenas a camada de RETRIEVAL (fonte disponível).');
  console.log('A citação da fonte na resposta final depende do LLM/prompt.');

  // Código de saída para CI: falha se âncora sem fonte
  process.exit(comFonte === ancoras.length ? 0 : 1);
}

main();