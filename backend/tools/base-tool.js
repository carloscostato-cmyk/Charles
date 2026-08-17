/**
 * base-tool.js
 *
 * Classe base abstrata para ferramentas do Agent.
 * Cada ferramenta deve ter: name, description, input schema, output schema,
 * validation, timeout.
 *
 * FASE 2 - Tool Calling
 */

class BaseTool {
  constructor(config = {}) {
    this.name = config.name || this.constructor.name;
    this.description = config.description || '';
    this.timeout = config.timeout || 5000;
    this.inputSchema = config.inputSchema || {};
    this.outputSchema = config.outputSchema || {};
  }

  /**
   * Executa a ferramenta com os parâmetros fornecidos.
   * Deve ser implementado por cada ferramenta.
   * @param {Object} params - Parâmetros de entrada
   * @returns {Promise<Object>} - Resultado da execução
   */
  async execute(params) {
    throw new Error('Método execute() deve ser implementado pela ferramenta');
  }

  /**
   * Valida os parâmetros de entrada contra o input schema.
   * @param {Object} params
   * @returns {{valid: boolean, errors: string[]}}
   */
  validateInput(params) {
    const errors = [];

    if (!this.inputSchema.properties) {
      return { valid: true, errors: [] };
    }

    for (const [field, schema] of Object.entries(this.inputSchema.properties)) {
      const value = params?.[field];
      const isRequired = this.inputSchema.required?.includes(field);

      if (isRequired && (value === undefined || value === null)) {
        errors.push(`Campo '${field}' é obrigatório`);
        continue;
      }

      if (value === undefined || value === null) continue;

      if (schema.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (schema.type === 'number' && actualType !== 'number') {
          errors.push(`Campo '${field}' deve ser number, recebeu ${actualType}`);
        } else if (schema.type === 'string' && actualType !== 'string') {
          errors.push(`Campo '${field}' deve ser string, recebeu ${actualType}`);
        } else if (schema.type === 'boolean' && actualType !== 'boolean') {
          errors.push(`Campo '${field}' deve ser boolean, recebeu ${actualType}`);
        } else if (schema.type === 'array' && actualType !== 'array') {
          errors.push(`Campo '${field}' deve ser array, recebeu ${actualType}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Executa a ferramenta com validação e timeout.
   * @param {Object} params
   * @returns {Promise<{success: boolean, result: Object, error: string|null, duration: number}>}
   */
  async run(params = {}) {
    const startTime = Date.now();

    const validation = this.validateInput(params);
    if (!validation.valid) {
      return {
        success: false,
        result: null,
        error: `Validação falhou: ${validation.errors.join(', ')}`,
        duration: Date.now() - startTime,
        tool: this.name
      };
    }

    try {
      const result = await this._executeWithTimeout(params);
      const duration = Date.now() - startTime;

      return {
        success: true,
        result,
        error: null,
        duration,
        tool: this.name
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        result: null,
        error: error.message,
        duration,
        tool: this.name
      };
    }
  }

  async _executeWithTimeout(params) {
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout: ferramenta '${this.name}' excedeu ${this.timeout}ms`));
      }, this.timeout);

      try {
        const result = await this.execute(params);
        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * Retorna a definição da ferramenta para o LLM
   * @returns {Object}
   */
  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
      outputSchema: this.outputSchema
    };
  }
}

module.exports = BaseTool;