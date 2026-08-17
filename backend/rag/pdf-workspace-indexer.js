/**
 * pdf-workspace-indexer.js
 *
 * Módulo para varredura e indexação automática de arquivos PDF
 * presentes no Workspace do projeto.
 */

const fs = require('fs');
const path = require('path');
const { getRAGService } = require('./rag-service');

class PDFWorkspaceIndexer {
  constructor(options = {}) {
    this.workspaceDir = options.workspaceDir || path.join(__dirname, '..', '..');
    this.ragService = getRAGService();
  }

  /**
   * Encontra todos os arquivos PDF no diretório do workspace (exceto node_modules e subpastas ignoradas)
   * @returns {string[]} Lista de caminhos absolutos dos arquivos PDF
   */
  findPDFFiles(dir = this.workspaceDir, depth = 0) {
    if (depth > 2) return []; // Limita profundidade para evitar travamentos
    let pdfFiles = [];

    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);

        if (item.isDirectory()) {
          // Ignora pastas pesadas ou irrelevantes
          if (['node_modules', '.git', '.vscode', 'coverage', 'dist', 'dify-main'].includes(item.name)) {
            continue;
          }
          pdfFiles = pdfFiles.concat(this.findPDFFiles(fullPath, depth + 1));
        } else if (item.isFile() && item.name.toLowerCase().endsWith('.pdf')) {
          pdfFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`[PDFIndexer] Erro ao ler diretório ${dir}:`, error.message);
    }

    return pdfFiles;
  }

  /**
   * Indexa todos os PDFs encontrados no workspace no RAG Vector Store
   * @returns {Promise<{totalFiles: number, totalChunks: number, details: Array}>}
   */
  async indexAllWorkspacePDFs() {
    await this.ragService.initialize();
    const pdfFiles = this.findPDFFiles();

    console.log(`[PDFIndexer] 🔍 Encontrados ${pdfFiles.length} arquivo(s) PDF no Workspace.`);

    let totalChunks = 0;
    const details = [];

    for (const filePath of pdfFiles) {
      try {
        const fileName = path.basename(filePath);
        console.log(`[PDFIndexer] 📄 Indexando PDF: ${fileName}...`);
        
        const result = await this.ragService.indexFile(filePath, {
          source: 'workspace-pdf',
          category: 'pdf-document',
          fileName: fileName
        });

        if (result.skipped) {
          console.log(`[PDFIndexer] ⏩ ${fileName} já estava indexado.`);
          details.push({ fileName, chunks: 0, status: 'já indexado' });
        } else {
          console.log(`[PDFIndexer] ✅ ${fileName} indexado com sucesso (${result.chunks} trechos).`);
          totalChunks += result.chunks;
          details.push({ fileName, chunks: result.chunks, status: 'indexado' });
        }
      } catch (err) {
        console.error(`[PDFIndexer] ❌ Erro ao indexar ${filePath}:`, err.message);
        details.push({ fileName: path.basename(filePath), error: err.message, status: 'erro' });
      }
    }

    return {
      totalFiles: pdfFiles.length,
      totalChunks,
      details
    };
  }

  /**
   * Responde uma pergunta utilizando exclusivamente ou prioritariamente o contexto dos PDFs indexados
   * @param {string} pergunta - Pergunta do usuário
   * @returns {Promise<Object>} Resposta e trechos de contexto utilizados
   */
  async askPDF(pergunta) {
    await this.ragService.initialize();

    // Busca primeiramente com filtro por documentos PDF
    let { results, validation } = await this.ragService.retrieve(pergunta, 5, { type: 'pdf' });

    // Se não encontrou resultados suficientes com filtro restrito, busca sem filtro
    if (!results || results.length === 0) {
      const fallback = await this.ragService.retrieve(pergunta, 5);
      results = fallback.results || [];
      validation = fallback.validation;
    }

    if (!results || results.length === 0) {
      return {
        resposta: 'Não encontrei nenhuma informação relevante no PDF no workspace para responder a essa pergunta.',
        hasContext: false,
        fontes: []
      };
    }

    const contextParts = results.map((r, i) => {
      const source = r.metadata?.fileName || r.metadata?.source || 'PDF';
      return `[Trecho ${i + 1}] (Fonte: ${source}, Relevância: ${(r.score * 100).toFixed(0)}%)\n${r.content}`;
    });

    const contextText = contextParts.join('\n\n');

    // Tenta usar o provider LLM para sintetizar a resposta com base no contexto do PDF
    const { getProvider } = require('../llm-provider');
    const providerName = process.env.LLM_PROVIDER || 'groq';
    const provider = getProvider(providerName);

    const systemPrompt = `Você é um assistente especialista no conteúdo dos documentos PDF fornecidos.
Responda à pergunta do usuário utilizando ESTRITAMENTE as informações presentes no contexto abaixo.

INSTRUÇÕES:
1. Responda de forma clara, direta e objetiva em português.
2. Cite a fonte ou seção do documento se relevante.
3. Se a informação não estiver presente no contexto, diga claramente que não consta no PDF.

CONTEXTO EXTRAÍDO DO PDF:
${contextText}`;

    let resposta = '';

    if (provider.disponivel && provider.name !== 'Local Fallback') {
      try {
        resposta = await provider.chat(systemPrompt, pergunta, 15000);
      } catch (err) {
        console.warn('[PDFIndexer] Erro na chamada do LLM, formatando contexto bruto:', err.message);
      }
    }

    const ehFallbackOuInvalido = !resposta || 
      resposta.toLowerCase().includes('livro aberto') || 
      resposta.toLowerCase().includes('desculpe') ||
      resposta.toLowerCase().includes('não consegui processar');

    if (ehFallbackOuInvalido) {
      resposta = `Com base no documento PDF (${results[0]?.metadata?.fileName || 'PDF'}), foram encontrados os seguintes trechos relevantes:\n\n${contextText}`;
    }

    return {
      resposta,
      hasContext: true,
      fontes: results.map(r => ({
        content: r.content,
        score: Math.round(r.score * 100),
        metadata: r.metadata
      })),
      validation
    };
  }
}

// Singleton
let instance = null;

function getPDFWorkspaceIndexer() {
  if (!instance) {
    instance = new PDFWorkspaceIndexer();
  }
  return instance;
}

module.exports = {
  PDFWorkspaceIndexer,
  getPDFWorkspaceIndexer
};
