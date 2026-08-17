/**
 * file-processor.js
 *
 * Processador de arquivos multimodais.
 * Recebe arquivos enviados pelo usuário, extrai conteúdo e indexa no RAG.
 * Suporta: PDF, DOCX, XLS, XLSX, TXT, Markdown, Imagens
 *
 * FASE 6 - Multimodalidade
 */

const path = require('path');
const fs = require('fs');
const { getRAGService } = require('../rag/rag-service');
const DocumentLoader = require('../rag/document-loader');

// Tesseract.js para OCR (visão computacional)
let tesseract = null;
try {
  tesseract = require('tesseract.js');
} catch (e) {
  console.warn('[FileProcessor] Tesseract.js não instalado. OCR não estará disponível.');
}

class FileProcessor {
  constructor() {
    this.documentLoader = new DocumentLoader();
    this.uploadDir = path.join(__dirname, '..', '..', 'data', 'uploads');
    this.supportedTypes = {
      '.pdf': 'PDF Document',
      '.docx': 'Word Document',
      '.doc': 'Word Document',
      '.xls': 'Excel Spreadsheet',
      '.xlsx': 'Excel Spreadsheet',
      '.txt': 'Text File',
      '.md': 'Markdown File',
      '.jpg': 'Image',
      '.jpeg': 'Image',
      '.png': 'Image',
      '.gif': 'Image'
    };
  }

  /**
   * Processa um arquivo enviado pelo usuário
   * @param {Object} file - Arquivo do multer
   * @returns {Promise<{content: string, indexed: boolean, metadata: Object}>}
   */
  async processFile(file) {
    const ext = path.extname(file.originalname).toLowerCase();
    const filePath = file.path;

    console.log(`[FileProcessor] Processando: ${file.originalname} (${ext})`);

    // Para imagens, extrai texto via OCR e indexa
    if (this._isImage(ext)) {
      console.log(`[FileProcessor] Processando imagem com OCR: ${file.originalname}`);
      
      let extractedText = '';
      let ocrConfidence = 0;
      
      // OCR com Tesseract.js
      if (tesseract) {
        try {
          const result = await tesseract.recognize(filePath, 'por+eng', {
            logger: (info) => {
              if (info.status === 'recognizing text') {
                console.log(`[OCR] Progresso: ${(info.progress * 100).toFixed(0)}%`);
              }
            }
          });
          extractedText = result.data.text || '';
          ocrConfidence = result.data.confidence || 0;
          console.log(`[OCR] Texto extraído (${extractedText.length} chars, confiança: ${ocrConfidence.toFixed(1)}%)`);
        } catch (ocrError) {
          console.warn(`[OCR] Erro: ${ocrError.message}`);
        }
      }
      
      // Indexa no RAG se houver texto extraído
      const ragService = getRAGService();
      let indexed = false;
      let chunks = 0;
      
      if (extractedText && extractedText.trim().length > 10) {
        try {
          // Cria arquivo temporário com o texto extraído para indexar
          const tempTxtPath = filePath.replace(path.extname(filePath), '_ocr.txt');
          fs.writeFileSync(tempTxtPath, extractedText, 'utf-8');
          
          const indexResult = await ragService.indexFile(tempTxtPath, {
            uploadedBy: 'user',
            uploadedAt: new Date().toISOString(),
            sourceImage: file.originalname,
            ocrConfidence: ocrConfidence
          });
          
          indexed = true;
          chunks = indexResult.chunks;
          console.log(`[FileProcessor] Imagem indexada no RAG: ${chunks} chunks`);
          
          // Remove arquivo temporário
          fs.unlinkSync(tempTxtPath);
        } catch (indexError) {
          console.warn(`[FileProcessor] Erro ao indexar imagem: ${indexError.message}`);
        }
      }
      
      return {
        content: extractedText,
        indexed: indexed,
        chunks: chunks,
        metadata: {
          fileName: file.originalname,
          type: 'image',
          size: file.size,
          mimeType: file.mimetype,
          ocrConfidence: ocrConfidence,
          message: indexed 
            ? `Imagem processada com OCR. ${chunks} trechos indexados.` 
            : 'Imagem recebida. Texto insuficiente para indexação.'
        }
      };
    }

    // Carrega e extrai conteúdo do documento
    const doc = await this.documentLoader.loadFile(filePath);

    // Indexa no RAG para permitir perguntas sobre o conteúdo
    const ragService = getRAGService();
    const indexResult = await ragService.indexFile(filePath, {
      uploadedBy: 'user',
      uploadedAt: new Date().toISOString()
    });

    console.log(`[FileProcessor] Arquivo processado e indexado: ${indexResult.chunks} chunks`);

    return {
      content: doc.content,
      indexed: true,
      chunks: indexResult.chunks,
      metadata: {
        ...doc.metadata,
        indexedChunks: indexResult.chunks
      }
    };
  }

  /**
   * Processa um arquivo a partir de um caminho
   * @param {string} filePath
   * @returns {Promise<Object>}
   */
  async processFilePath(filePath) {
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    if (this._isImage(ext)) {
      return {
        content: '',
        indexed: false,
        metadata: { fileName, type: 'image' }
      };
    }

    const doc = await this.documentLoader.loadFile(filePath);
    const ragService = getRAGService();
    const indexResult = await ragService.indexFile(filePath);

    return {
      content: doc.content,
      indexed: true,
      chunks: indexResult.chunks,
      metadata: doc.metadata
    };
  }

  /**
   * Garante que o diretório de uploads existe
   */
  ensureUploadDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
    return this.uploadDir;
  }

  /**
   * Verifica se o tipo de arquivo é suportado
   * @param {string} filename
   * @returns {boolean}
   */
  isSupported(filename) {
    const ext = path.extname(filename).toLowerCase();
    return ext in this.supportedTypes;
  }

  /**
   * Retorna os tipos suportados
   * @returns {Object}
   */
  getSupportedTypes() {
    return this.supportedTypes;
  }

  /**
   * Verifica se é uma imagem
   * @param {string} ext
   * @returns {boolean}
   */
  _isImage(ext) {
    return ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext);
  }

  /**
   * Limpa arquivos antigos do diretório de uploads
   * @param {number} maxAgeMs - Idade máxima em ms (padrão: 24h)
   */
  cleanupOldUploads(maxAgeMs = 86400000) {
    if (!fs.existsSync(this.uploadDir)) return;

    const files = fs.readdirSync(this.uploadDir);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(this.uploadDir, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath);
        console.log(`[FileProcessor] Arquivo antigo removido: ${file}`);
      }
    }
  }
}

// Singleton
let instance = null;

function getFileProcessor() {
  if (!instance) {
    instance = new FileProcessor();
  }
  return instance;
}

module.exports = { getFileProcessor, FileProcessor };