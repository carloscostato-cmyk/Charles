/**
 * search-knowledge-tool.js
 *
 * Ferramenta de busca na base de conhecimento usando RAG.
 * Permite ao LLM buscar informações semanticamente.
 *
 * FASE 2 - Tool Calling
 */

const BaseTool = require('./base-tool');
const { getRAGService } = require('../rag/rag-service');

class SearchKnowledgeTool extends BaseTool {
  constructor() {
    super({
      name: 'SearchKnowledgeTool',
      description: 'Busca informacoes na base de conhecimento usando RAG semantico. Use para perguntas sobre procedimentos, normas, processos e conhecimento de Data Center.',
      timeout: 10000,
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Pergunta ou termo de busca'
          },
          topK: {
            type: 'number',
            description: 'Numero maximo de resultados (padrao: 5)'
          }
        },
        required: ['query']
      },
      outputSchema: {
        type: 'object',
        properties: {
          context: { type: 'string', description: 'Contexto recuperado' },
          sources: { type: 'array', description: 'Lista de fontes' },
          hasContext: { type: 'boolean', description: 'Se encontrou contexto' }
        }
      }
    });
  }

  async execute(params) {
    const { query, topK = 5 } = params;
    const ragService = getRAGService();
    const result = await ragService.retrieveContextForPrompt(query, topK);

    // Se a validação RAG não permitir responder, informa claramente
    if (!result.hasContext || !result.validation?.canAnswer) {
      return {
        context: '',
        sources: [],
        hasContext: false,
        canAnswer: false,
        reason: result.validation?.reason || 'A informação não foi encontrada na base de conhecimento.',
        confidence: result.validation?.confidence || 0,
        confidenceLevel: result.validation?.confidenceLevel || 'none',
        query
      };
    }

    return {
      context: result.context,
      sources: result.sources || [],
      hasContext: true,
      canAnswer: true,
      reason: result.validation?.reason,
      confidence: result.validation?.confidence,
      confidenceLevel: result.validation?.confidenceLevel,
      query
    };
  }
}

module.exports = SearchKnowledgeTool;