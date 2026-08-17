/**
 * pdf-thumbnail-service.js - SERVIÇO DE THUMBNAIL DE PDF
 * 
 * Gera miniaturas de PDFs para preview amigável no chat
 * Usa pdf-parse para extração de metadados e @napi-rs/canvas para conversão de imagem
 * 
 * "Preview visual de documentos antes de baixar"
 */

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { createCanvas } = require('@napi-rs/canvas');

class PDFThumbnailService {
  constructor() {
    // Diretório de cache para thumbnails
    this.cacheDir = path.join(__dirname, '..', '..', 'thumbnails');
    this.ensureCacheDir();
  }

  /**
   * Garante que o diretório de cache existe
   */
  ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      console.log('[PDFThumbnailService] Diretório de cache criado:', this.cacheDir);
    }
  }

  /**
   * Gera nome de arquivo para cache
   */
  getCacheFilename(pdfPath, page = 1) {
    const hash = this._hashString(pdfPath);
    return `thumb_${hash}_page${page}.png`;
  }

  /**
   * Hash simples para nome de arquivo
   */
  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Verifica se thumbnail existe em cache
   */
  hasThumbnail(pdfPath, page = 1) {
    const cacheFile = path.join(this.cacheDir, this.getCacheFilename(pdfPath, page));
    return fs.existsSync(cacheFile);
  }

  /**
   * Retorna caminho do thumbnail em cache
   */
  getCachedThumbnailPath(pdfPath, page = 1) {
    const cacheFile = path.join(this.cacheDir, this.getCacheFilename(pdfPath, page));
    if (fs.existsSync(cacheFile)) {
      return cacheFile;
    }
    return null;
  }

  /**
   * Gera thumbnail de PDF (placeholder genérico)
   * Como pdf-parse não suporta renderização de imagem, criamos um placeholder visual
   * @param {string} pdfPath - Caminho do PDF
   * @param {number} page - Página a renderizar (ignorado no placeholder)
   * @param {number} scale - Escala da imagem (ignorado no placeholder)
   * @returns {Promise<string>} Caminho do thumbnail gerado
   */
  async generateThumbnail(pdfPath, page = 1, scale = 1.5) {
    // Verifica se já existe em cache
    const cached = this.getCachedThumbnailPath(pdfPath, page);
    if (cached) {
      console.log('[PDFThumbnailService] Thumbnail em cache:', cached);
      return cached;
    }

    console.log(`[PDFThumbnailService] Gerando thumbnail placeholder para: ${pdfPath}`);

    try {
      // Obtém metadados do PDF
      const dataBuffer = fs.readFileSync(pdfPath);
      const data = await pdfParse(dataBuffer);
      
      // Cria canvas para placeholder
      const canvas = createCanvas(400, 300);
      const context = canvas.getContext('2d');

      // Fundo gradiente
      const gradient = context.createLinearGradient(0, 0, 400, 300);
      gradient.addColorStop(0, '#f8fafc');
      gradient.addColorStop(1, '#e2e8f0');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 400, 300);

      // Ícone de PDF
      context.fillStyle = '#cc0000';
      context.fillRect(150, 50, 100, 140);
      
      // Detalhes do ícone
      context.fillStyle = '#ffffff';
      context.font = 'bold 24px Arial';
      context.fillText('PDF', 175, 130);

      // Nome do arquivo
      context.fillStyle = '#1a1a1a';
      context.font = '14px Arial';
      const fileName = path.basename(pdfPath);
      const truncatedName = fileName.length > 35 ? fileName.substring(0, 32) + '...' : fileName;
      context.fillText(truncatedName, 20, 240);

      // Número de páginas
      context.fillStyle = '#666666';
      context.font = '12px Arial';
      context.fillText(`${data.numpages} página${data.numpages > 1 ? 's' : ''}`, 20, 260);

      // Tamanho do arquivo
      const stats = fs.statSync(pdfPath);
      const sizeFormatted = this._formatBytes(stats.size);
      context.fillText(sizeFormatted, 20, 280);

      // Converte para PNG
      const pngBuffer = canvas.toBuffer('image/png');

      // Salva em cache
      const cacheFile = path.join(this.cacheDir, this.getCacheFilename(pdfPath, page));
      fs.writeFileSync(cacheFile, pngBuffer);

      console.log('[PDFThumbnailService] Thumbnail placeholder gerado:', cacheFile);
      return cacheFile;

    } catch (error) {
      console.error('[PDFThumbnailService] Erro ao gerar thumbnail:', error.message);
      throw new Error(`Falha ao gerar thumbnail: ${error.message}`);
    }
  }

  /**
   * Gera thumbnail como buffer (para resposta HTTP direta)
   * @param {string} pdfPath - Caminho do PDF
   * @param {number} page - Página a renderizar
   * @returns {Promise<Buffer>} Buffer da imagem PNG
   */
  async generateThumbnailBuffer(pdfPath, page = 1) {
    const thumbnailPath = await this.generateThumbnail(pdfPath, page);
    return fs.readFileSync(thumbnailPath);
  }

  /**
   * Limpa cache de thumbnails antigos
   * @param {number} maxAge - Idade máxima em ms (padrão: 7 dias)
   */
  clearOldCache(maxAge = 7 * 24 * 60 * 60 * 1000) {
    try {
      const files = fs.readdirSync(this.cacheDir);
      const now = Date.now();
      let deleted = 0;

      files.forEach(file => {
        const filePath = path.join(this.cacheDir, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      });

      console.log(`[PDFThumbnailService] Cache limpo: ${deleted} arquivos removidos`);
      return deleted;
    } catch (error) {
      console.error('[PDFThumbnailService] Erro ao limpar cache:', error.message);
      return 0;
    }
  }

  /**
   * Limpa todo o cache
   */
  clearAllCache() {
    try {
      const files = fs.readdirSync(this.cacheDir);
      files.forEach(file => {
        const filePath = path.join(this.cacheDir, file);
        fs.unlinkSync(filePath);
      });
      console.log(`[PDFThumbnailService] Todo o cache limpo: ${files.length} arquivos removidos`);
      return files.length;
    } catch (error) {
      console.error('[PDFThumbnailService] Erro ao limpar cache:', error.message);
      return 0;
    }
  }
}

// Singleton
let instance = null;

function getPDFThumbnailService() {
  if (!instance) {
    instance = new PDFThumbnailService();
  }
  return instance;
}

module.exports = {
  getPDFThumbnailService,
  PDFThumbnailService
};
