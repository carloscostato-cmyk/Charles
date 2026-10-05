/**
 * reindexar-base.js
 *
 * Reindexa toda a base de conhecimento do RAG: FAQ (FQ_DATA_CENTER.xls) + Data Centers.
 * Use SEMPRE que:
 *   - o provedor de embeddings mudar (ex.: local-hash -> Google Gemini)
 *   - a planilha de FAQ for atualizada
 *   - novos Data Centers forem cadastrados
 *
 * Para os PDFs do projeto, rode também:  npm run pdf:index
 *
 * Uso (dentro de backend/):
 *   node scripts/reindexar-base.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// TLS corporativo, se necessário (mesmo padrão do pdf-routine)
if (process.env.ALLOW_INSECURE_TLS === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const fs = require('fs');
const { getRAGService } = require('../rag/rag-service');
const { getDataCenterLoader } = require('../rag/datacenter-loader');
const { lerFAQ } = require('../faq-reader');

async function main() {
  const rag = getRAGService();
  await rag.initialize();

  const antes = await rag.getStats();
  console.log('======================================================');
  console.log('  🔄 REINDEXACAO COMPLETA DA BASE (RAG)');
  console.log('======================================================');
  console.log(`Provedor de embeddings: ${antes.embeddingProvider.provider} (${antes.embeddingProvider.dimensions} dims)`);
  console.log(`Documentos antes: ${antes.totalDocuments}`);
  console.log('');

  console.log('[1/3] Limpando vetores antigos...');
  await rag.clear();

  console.log('[2/3] Indexando FAQ (FQ_DATA_CENTER.xls)...');
  const faq = lerFAQ();
  const faqResult = await rag.indexFAQItems(
    faq.map((item) => ({ pergunta: item.pergunta, resposta: item.resposta })),
    { source: 'faq-excel' }
  );
  console.log(`      ${faq.length} itens de FAQ -> ${faqResult.chunks} chunks`);

  console.log('[3/3] Indexando Data Centers...');
  const dcLoader = getDataCenterLoader();
  const dcExcel = path.join(__dirname, '..', '..', 'sites_data_center.xlsx');
  if (fs.existsSync(dcExcel)) {
    dcLoader.loadFromExcel(dcExcel);
  } else {
    console.warn('      sites_data_center.xlsx nao encontrado na raiz do projeto.');
  }
  const dcContexto = dcLoader.gerarContextoRAG();
  for (const dc of dcContexto) {
    const chunkId = `dc_${dc.id}_${dc.metadata.cidade || ''}`;
    await rag.indexText(dc.content, { ...dc.metadata, source: chunkId, category: 'datacenter' });
  }
  console.log(`      ${dcContexto.length} blocos de Data Centers indexados`);

  const depois = await rag.getStats();
  console.log('');
  console.log('======================================================');
  console.log(`✅ Reindexacao concluida! Documentos agora: ${depois.totalDocuments}`);
  console.log('   (para os PDFs do projeto, rode tambem: npm run pdf:index)');
  console.log('======================================================');
}

main().catch((error) => {
  console.error('[Reindexar] ❌ Falha:', error.message);
  process.exit(1);
});