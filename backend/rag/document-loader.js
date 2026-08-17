/**
 * document-loader.js
 *
 * Carregador de documentos multi-formato para indexação no RAG.
 * Suporta: XLS, XLSX, PDF, DOCX, TXT, Markdown, URLs
 *
 * FASE 1 - RAG Enterprise
 * FASE 6 - Multimodalidade (compartilhado)
 */

const path = require('path');
const fs = require('fs');

class DocumentLoader {
  /**
   * Carrega um arquivo e extrai o texto
   * @param {string} filePath - Caminho do arquivo
   * @returns {Promise<{content: string, metadata: Object}>}
   */
  async loadFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    const stats = fs.statSync(filePath);

    const metadata = {
      fileName,
      filePath,
      extension: ext,
      size: stats.size,
      modified: stats.mtime.toISOString()
    };

    switch (ext) {
      case '.xls':
      case '.xlsx':
        return await this._loadExcel(filePath, metadata);
      case '.pdf':
        return await this._loadPDF(filePath, metadata);
      case '.docx':
        return await this._loadDOCX(filePath, metadata);
      case '.txt':
        return await this._loadText(filePath, metadata);
      case '.md':
        return await this._loadMarkdown(filePath, metadata);
      default:
        return await this._loadText(filePath, metadata);
    }
  }

  /**
   * Carrega conteúdo de uma URL
   * @param {string} url
   * @returns {Promise<{content: string, metadata: Object}>}
   */
  async loadURL(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erro ao carregar URL: HTTP ${response.status}`);
    }

    const html = await response.text();
    const text = this._stripHTML(html);

    return {
      content: text,
      metadata: {
        source: 'url',
        url,
        fileName: url,
        extension: '.html',
        size: text.length,
        loadedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Carrega um texto direto (para indexação programática)
   * @param {string} text
   * @param {Object} metadata
   * @returns {{content: string, metadata: Object}}
   */
  loadText(text, metadata = {}) {
    return {
      content: text,
      metadata: {
        source: 'text',
        ...metadata,
        size: text.length,
        loadedAt: new Date().toISOString()
      }
    };
  }

  // ============ FORMATOS SUPORTADOS ============

  async _loadExcel(filePath, metadata) {
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheets = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const lines = rows.map((row, index) => {
        if (index === 0) {
          return `Cabeçalho: ${row.join(' | ')}`;
        }
        return `Linha ${index}: ${row.join(' | ')}`;
      });

      sheets.push(`=== Planilha: ${sheetName} ===\n${lines.join('\n')}`);
    }

    return {
      content: sheets.join('\n\n'),
      metadata: { ...metadata, type: 'spreadsheet', sheets: workbook.SheetNames }
    };
  }

  async _loadPDF(filePath, metadata) {
    const pdfModule = require('pdf-parse');
    let text = '';
    let pages = 0;
    let info = {};

    if (typeof pdfModule === 'function') {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfModule(buffer);
      text = data.text;
      pages = data.numpages;
      info = data.info || {};
    } else if (pdfModule && pdfModule.PDFParse) {
      const buffer = fs.readFileSync(filePath);
      const parser = new pdfModule.PDFParse({ data: buffer });
      const result = await parser.getText();
      text = result.text || '';
      pages = result.total || result.pages || (await parser.getNumPages?.()) || 0;
      info = result.info || {};
    } else {
      throw new Error('Módulo pdf-parse não pôde ser carregado');
    }

    return {
      content: text,
      metadata: {
        ...metadata,
        type: 'pdf',
        pages,
        info
      }
    };
  }

  async _loadDOCX(filePath, metadata) {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });

    return {
      content: result.value,
      metadata: {
        ...metadata,
        type: 'docx',
        messages: result.messages
      }
    };
  }

  async _loadText(filePath, metadata) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return {
      content,
      metadata: { ...metadata, type: 'text' }
    };
  }

  async _loadMarkdown(filePath, metadata) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const text = content
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/^>\s+/gm, '');

    return {
      content: text,
      metadata: { ...metadata, type: 'markdown' }
    };
  }

  _stripHTML(html) {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

module.exports = DocumentLoader;