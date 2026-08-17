#!/usr/bin/env node
/**
 * pdf-routine.js
 *
 * Rotina CLI para gerenciar e fazer perguntas sobre arquivos PDF no Workspace.
 *
 * Uso:
 *   node scripts/pdf-routine.js index           -> Indexa todos os PDFs no workspace
 *   node scripts/pdf-routine.js ask "pergunta"   -> Faz uma pergunta sobre o PDF
 *   node scripts/pdf-routine.js list           -> Lista os PDFs e estatísticas do RAG
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Suprime alertas de certificado SSL corporativo se necessário
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { getPDFWorkspaceIndexer } = require('../backend/rag/pdf-workspace-indexer');
const { getRAGService } = require('../backend/rag/rag-service');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] ? args[0].toLowerCase() : 'help';

  const indexer = getPDFWorkspaceIndexer();
  const ragService = getRAGService();

  console.log('\n======================================================');
  console.log('  📄 ROTINA DE CONSULTA A DOCUMENTOS PDF (RAG)');
  console.log('======================================================\n');

  switch (command) {
    case 'index': {
      console.log('[PDF-Routine] 🔍 Escaneando e indexando PDFs no workspace...\n');
      const result = await indexer.indexAllWorkspacePDFs();
      
      console.log('\n------------------------------------------------------');
      console.log(`✅ Indexação concluída!`);
      console.log(`- Total de arquivos PDF encontrados: ${result.totalFiles}`);
      console.log(`- Trechos (chunks) novos indexados: ${result.totalChunks}`);
      console.log('------------------------------------------------------');
      result.details.forEach(d => {
        console.log(`  • ${d.fileName} -> ${d.status} (${d.chunks || 0} chunks)`);
      });
      console.log('');
      break;
    }

    case 'ask': {
      const pergunta = args.slice(1).join(' ').trim();
      if (!pergunta) {
        console.error('❌ Erro: Informe a pergunta entre aspas.');
        console.log('Exemplo: npm run pdf:ask -- "Qual o objetivo do documento?"');
        process.exit(1);
      }

      console.log(`❓ PERGUNTA: "${pergunta}"\n`);
      console.log('🔍 Consultando base de PDFs indexados...');

      // Garante que o workspace está indexado antes de perguntar
      await indexer.indexAllWorkspacePDFs();

      const resultado = await indexer.askPDF(pergunta);

      console.log('\n💡 RESPOSTA:');
      console.log('------------------------------------------------------');
      console.log(resultado.resposta);
      console.log('------------------------------------------------------\n');

      if (resultado.fontes && resultado.fontes.length > 0) {
        console.log('📚 Trechos fonte do PDF utilizados:');
        resultado.fontes.forEach((fonte, idx) => {
          const file = fonte.metadata?.fileName || 'PDF';
          console.log(`\n  [Fonte ${idx + 1}] (${file} - relevância: ${fonte.score}%):`);
          console.log(`  "${fonte.content.replace(/\n+/g, ' ').substring(0, 150)}..."`);
        });
        console.log('');
      }
      break;
    }

    case 'list': {
      await ragService.initialize();
      const stats = await ragService.getStats();
      const pdfs = indexer.findPDFFiles();

      console.log('📊 ESTATÍSTICAS DA BASE DE CONHECIMENTO:');
      console.log(`- Documentos totais no RAG: ${stats.totalDocuments}`);
      console.log(`- Provedor de Embedding: ${stats.embeddingProvider.provider} (${stats.embeddingProvider.dimensions} dims)`);
      console.log('\n📁 ARQUIVOS PDF ENCONTRADOS NO WORKSPACE:');
      if (pdfs.length === 0) {
        console.log('  Nenhum arquivo PDF encontrado.');
      } else {
        pdfs.forEach(p => console.log(`  • ${path.basename(p)} (${(require('fs').statSync(p).size / 1024).toFixed(1)} KB)`));
      }
      console.log('');
      break;
    }

    default: {
      console.log('Comandos disponíveis:\n');
      console.log('  npm run pdf:index            Indexa todos os arquivos PDF no workspace');
      console.log('  npm run pdf:ask -- "pergunta" Pergunta algo diretamente sobre o PDF');
      console.log('  npm run pdf:list             Lista os arquivos PDF e status do RAG\n');
      break;
    }
  }
}

main().catch(err => {
  console.error('\n❌ Erro na execução da rotina de PDF:', err);
  process.exit(1);
});
