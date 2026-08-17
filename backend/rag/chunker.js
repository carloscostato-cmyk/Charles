/**
 * chunker.js
 *
 * Chunking inteligente de documentos para RAG.
 * Estratégias:
 * - Recursive Character Splitter (como LangChain)
 * - Semantic chunking (respeita parágrafos e sentenças)
 * - Overlap entre chunks para manter contexto
 *
 * FASE 1 - RAG Enterprise
 */

class Chunker {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 500;
    this.chunkOverlap = options.chunkOverlap || 50;
    this.separators = options.separators || [
      '\n\n',
      '\n',
      '. ',
      ' ',
      ''
    ];
  }

  /**
   * Divide um texto em chunks inteligentes
   * @param {string} text - Texto a ser dividido
   * @param {Object} metadata - Metadata adicional para cada chunk
   * @returns {Array<{content: string, metadata: Object}>}
   */
  chunk(text, metadata = {}) {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // Adiciona o nome do arquivo no início de cada chunk para melhorar busca
    const filePrefix = metadata.fileName ? `[Documento: ${metadata.fileName}]\n\n` : '';

    if (text.length <= this.chunkSize) {
      return [{
        content: filePrefix + text.trim(),
        metadata: { ...metadata, chunkIndex: 0, totalChunks: 1 }
      }];
    }

    const chunks = this._recursiveSplit(text, this.separators);
    const merged = this._mergeSmallChunks(chunks);

    const result = merged.map((content, index) => ({
      content: filePrefix + content.trim(),
      metadata: {
        ...metadata,
        chunkIndex: index,
        totalChunks: merged.length
      }
    }));

    return result;
  }

  /**
   * Divide uma lista de documentos (Q&A pairs, etc.)
   * @param {Array<{pergunta: string, resposta: string}>} items
   * @param {Object} baseMetadata
   * @returns {Array<{content: string, metadata: Object}>}
   */
  chunkQAItems(items, baseMetadata = {}) {
    const chunks = [];

    for (const item of items) {
      const content = `Pergunta: ${item.pergunta}\nResposta: ${item.resposta}`;
      chunks.push({
        content,
        metadata: {
          ...baseMetadata,
          type: 'qa',
          pergunta: item.pergunta,
          source: 'faq'
        }
      });
    }

    return chunks;
  }

  // ============ MÉTODOS PRIVADOS ============

  _recursiveSplit(text, separators) {
    const chunks = [];
    let separator = separators[separators.length - 1];
    let newSeparators = [];

    for (let i = 0; i < separators.length; i++) {
      if (text.includes(separators[i])) {
        separator = separators[i];
        newSeparators = separators.slice(i + 1);
        break;
      }
    }

    const splits = text.split(separator);

    for (const split of splits) {
      if (split.length > this.chunkSize && newSeparators.length > 0) {
        const subChunks = this._recursiveSplit(split, newSeparators);
        chunks.push(...subChunks);
      } else if (split.trim().length > 0) {
        chunks.push(split);
      }
    }

    return this._mergeWithOverlap(chunks, separator);
  }

  _mergeWithOverlap(splits, separator) {
    const chunks = [];
    let currentChunk = '';
    let currentLength = 0;

    for (const split of splits) {
      const splitLength = split.length;

      if (currentLength + splitLength + separator.length > this.chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk);
        const overlapText = currentChunk.slice(-this.chunkOverlap);
        currentChunk = overlapText + separator + split;
        currentLength = currentChunk.length;
      } else {
        if (currentChunk.length > 0) {
          currentChunk += separator + split;
        } else {
          currentChunk = split;
        }
        currentLength = currentChunk.length;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  _mergeSmallChunks(chunks) {
    const MIN_CHUNK_SIZE = 50;
    const result = [];

    for (const chunk of chunks) {
      if (chunk.length < MIN_CHUNK_SIZE && result.length > 0) {
        result[result.length - 1] += ' ' + chunk;
      } else {
        result.push(chunk);
      }
    }

    return result;
  }
}

module.exports = Chunker;