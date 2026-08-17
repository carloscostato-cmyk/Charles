/**
 * tool-registry.js
 *
 * Registro central de ferramentas (Tool Registry).
 * Gerencia registro, descoberta e execução de ferramentas.
 * Permite que o LLM escolha automaticamente qual ferramenta usar.
 *
 * FASE 2 - Tool Calling
 */

const BaseTool = require('./base-tool');
const CalculateTool = require('./calculate-tool');
const SearchKnowledgeTool = require('./search-knowledge-tool');
const CurrentDateTool = require('./current-date-tool');
const SystemStatusTool = require('./system-status-tool');

class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.executionHistory = [];
    this._registerDefaults();
  }

  register(tool) {
    if (!(tool instanceof BaseTool)) {
      throw new Error('Ferramenta deve estender BaseTool');
    }
    this.tools.set(tool.name, tool);
    console.log(`[ToolRegistry] Ferramenta registrada: ${tool.name}`);
  }

  unregister(toolName) {
    this.tools.delete(toolName);
  }

  getTool(name) {
    return this.tools.get(name);
  }

  listTools() {
    return Array.from(this.tools.values());
  }

  getToolDefinitions() {
    return this.listTools().map((t) => t.getDefinition());
  }

  async executeTool(toolName, params = {}) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        result: null,
        error: `Ferramenta '${toolName}' nao encontrada`,
        duration: 0,
        tool: toolName
      };
    }

    console.log(`[ToolRegistry] Executando ferramenta: ${toolName}`, params);
    const result = await tool.run(params);

    this.executionHistory.push({
      tool: toolName,
      params,
      result,
      timestamp: new Date().toISOString()
    });

    if (this.executionHistory.length > 100) {
      this.executionHistory = this.executionHistory.slice(-100);
    }

    console.log(`[ToolRegistry] ${toolName} concluida em ${result.duration}ms (sucesso: ${result.success})`);
    return result;
  }

  selectTools(query) {
    const lowerQuery = query.toLowerCase();
    const selections = [];

    // PATRÃO BASEADO EM REGEX - serÁ reemplacado por function calling do LLM
    const mathPattern = /(\d+(\.\d+)?)\s*([+\-*/x÷]\s*)+(\d+(\.\d+)?)/;
    if (mathPattern.test(query) || /\b(calcule|calcular|quanto e|soma|subtrai|multiplica|divide)\b/i.test(lowerQuery)) {
      const expression = this._extractMathExpression(query);
      if (expression) {
        selections.push({
          tool: 'CalculateTool',
          params: { expression },
          confidence: 0.9
        });
      }
    }

    if (/\b(que dia|que horas|data de hoje|hora atual|que data|hoje)\b/i.test(lowerQuery)) {
      selections.push({
        tool: 'CurrentDateTool',
        params: {},
        confidence: 0.95
      });
    }

    if (/\b(status do sistema|sistema online|como esta o sistema|status do servidor)\b/i.test(lowerQuery)) {
      selections.push({
        tool: 'SystemStatusTool',
        params: {},
        confidence: 0.9
      });
    }

    if (/\b(o que e|como funciona|qual o procedimento|norma|politica|regra|processo|procedimento)\b/i.test(lowerQuery)) {
      selections.push({
        tool: 'SearchKnowledgeTool',
        params: { query },
        confidence: 0.7
      });
    }

    return selections;
  }

  /**
   * Enhanced tool selection using LLM function calling
   * Esta mÃ©todo serÃ¡ reemplacado por funÃ§Ã£o nativa do provedor LLM
   * @param {string} query - Pergunta do usuÃ¡rio
   * @returns {Array} Selections com alta confianÃ§a
   */
  async selectToolsWithLLM(query, userId = 'default') {
    // Inicialmente usar o padrÃ£o antigo atÃ© que funÃ§Ã£o nativa nÃ£o estÃ¡ implementada
    const legacySelections = this.selectTools(query);
    
    if (legacySelections.length > 0) {
      console.log(`[ToolRegistry] Usando ferramenta com alta confianÃ§a (legacy): ${legacySelections.map(s => s.tool).join(', ')}`);
      return legacySelections;
    }
    
    // Em uma implementaÃ§Ã£o futura, isto chamarÃ¡ o LLM com funÃ§Ã£o calling
    console.log(`[ToolRegistry] Nenhuma ferramenta com alta confianÃ§a encontrada, solicitando ao LLM`);
    
    // Por enquanto retornar vazio para forÃ§ar o LLM a decidir
    return [];
  }

  /**
   * Gera definiÃ§Ã£o de funÃ§Ã£o para o LLM calling
   * @param {string} userId 
   * @returns {Array} DefiniÃ§Ãµes de ferramentas para funÃ§Ã£o calling
   */
  getFunctionDefinitions(userId = 'default') {
    // Base tools with enhanced descriptions for function calling
    return this.listTools().map(tool => ({
      name: tool.name,
      description: this._enhanceToolDescription(tool),
      parameters: {
        type: "object",
        properties: tool.parameters || {},
        required: tool.required || []
      }
    }));
  }

  /**
   * Aumenta a descriÃ§Ã£o da ferramenta para melhor entendimento do LLM
   * @param {Object} tool 
   * @returns {string}
   */
  _enhanceToolDescription(tool) {
    const enhancedDescriptions = {
      'CalculateTool': 'Calcula expressÃµes matemÃ¡ticas e aritmÃ©ticas. Usado para cÃ¡lculos, equivalÃªncias e respostas numÃ©ricas.',
      'SearchKnowledgeTool': 'Busca na base de conhecimento. Ideal para perguntas sobre Data Center, infraestrutura, procedimentas e conhecimento tÃ©cnico.',
      'CurrentDateTool': 'Retorna a data e hora atual do servidor. \'Que dia\' ou \'Que hora\' perguntou?.',
      'SystemStatusTool': 'Verifica o status operacional do sistema. Monitora serviÃ§os, recursos e health check.'
    };
    
    return enhancedDescriptions[tool.name] || tool.description || 'Ferramenta para execuÃ§Ã£o de tarefas especializadas';
  }

  /**
   * Processa resultados de funÃ§Ã£o calling do LLM
   * @param {Array} toolCalls - Array de chamadas de ferramentas do LLM
   * @returns {Promise<Object>} Resultado da execuÃ§Ã£o das ferramentas
   */
  async processFunctionCalls(toolCalls, userId = 'default') {
    const results = [];
    
    for (const toolCall of toolCalls) {
      const { name, arguments: params } = toolCall;
      console.log(`[ToolRegistry] Processando chamada de funÃ§Ã£o do LLM: ${name} com parÃ¢metros: ${JSON.stringify(params)}`);
      
      try {
        const result = await this.executeTool(name, JSON.parse(params));
        results.push({
          ...result,
          toolName: name,
          llmReasoning: true
        });
      } catch (error) {
        console.error(`[ToolRegistry] Erro na ferramenta ${name}:`, error.message);
        results.push({
          success: false,
          result: null,
          error: error.message,
          duration: 0,
          tool: name,
          llmReasoning: true
        });
      }
    }
    
    return {
      toolsExecuted: toolCalls.map(tc => tc.name),
      results,
      llmReasoned: true
    };
  }

  async autoExecute(query, userId = 'default') {
    // Primeira etapa: tenta usar o padrão legado de alta confiança para tarefas simples
    const legacySelections = this.selectTools(query);
    
    if (legacySelections.length > 0) {
      console.log(`[ToolRegistry] Usando seleçÃ£o legada (${legacySelections.length} ferramentas)`);
      const results = [];

      for (const selection of legacySelections) {
        const result = await this.executeTool(selection.tool, selection.params);
        results.push({
          ...result,
          confidence: selection.confidence
        });
      }

      return {
        toolsExecuted: legacySelections.map((s) => s.tool),
        results,
        llmReasoned: false
      };
    }
    
    // Segunda etapa: tenta usar LLM function calling para tarefas complexas
    // A implementação futura requererÃ¡ que o llm-provider suporte funÃ§Ã£o calling
    console.log(`[ToolRegistry] Tentando funÃ§Ã£o calling do LLM para: "${query.substring(0, 50)}..."`);
    
    // Por enquanto retornar sucesso vazio para permitir que o LLM decida
    return {
      toolsExecuted: [],
      results: [],
      llmReasoned: true,
      note: 'Agendado para funÃ§Ã£o calling do LLM (implementaÃ§Ã£o futura)'
    };
  }

  _extractMathExpression(text) {
    const match = text.match(/(\d+(\.\d+)?\s*[+\-*/x÷]\s*\d+(\.\d+)?(\s*[+\-*/x÷]\s*\d+(\.\d+)?)*)/);
    if (match) {
      return match[0].replace(/x/g, '*').replace(/÷/g, '/');
    }

    const calcMatch = text.match(/(?:calcule|calcular|quanto e|soma|subtrai|multiplica|divide)\s+(.+)/i);
    if (calcMatch) {
      return calcMatch[1].replace(/x/g, '*').replace(/÷/g, '/').trim();
    }

    return null;
  }

  getStats() {
    const total = this.executionHistory.length;
    const success = this.executionHistory.filter((e) => e.result.success).length;
    const byTool = {};

    for (const entry of this.executionHistory) {
      if (!byTool[entry.tool]) {
        byTool[entry.tool] = { total: 0, success: 0, avgDuration: 0 };
      }
      byTool[entry.tool].total++;
      if (entry.result.success) byTool[entry.tool].success++;
      byTool[entry.tool].avgDuration += entry.result.duration;
    }

    for (const tool of Object.keys(byTool)) {
      byTool[tool].avgDuration = byTool[tool].total > 0
        ? Math.round(byTool[tool].avgDuration / byTool[tool].total)
        : 0;
      byTool[tool].successRate = byTool[tool].total > 0
        ? Math.round((byTool[tool].success / byTool[tool].total) * 100)
        : 0;
    }

    return {
      totalExecutions: total,
      totalSuccess: success,
      successRate: total > 0 ? Math.round((success / total) * 100) : 0,
      registeredTools: this.listTools().map((t) => t.name),
      byTool
    };
  }

  _registerDefaults() {
    this.register(new CalculateTool());
    this.register(new SearchKnowledgeTool());
    this.register(new CurrentDateTool());
    this.register(new SystemStatusTool());
  }
}

let instance = null;

function getToolRegistry() {
  if (!instance) {
    instance = new ToolRegistry();
  }
  return instance;
}

module.exports = { getToolRegistry, ToolRegistry };