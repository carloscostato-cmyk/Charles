/**
 * calculate-tool.js
 *
 * Ferramenta de cálculo matemático.
 * Avalia expressões matemáticas com segurança (sem eval direto).
 *
 * FASE 2 - Tool Calling
 */

const BaseTool = require('./base-tool');

class CalculateTool extends BaseTool {
  constructor() {
    super({
      name: 'CalculateTool',
      description: 'Realiza calculos matematicos. Suporta operacoes: +, -, *, /, parenteses, potencia (^). Exemplo: "2 + 3 * 4" retorna 14.',
      timeout: 3000,
      inputSchema: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Expressao matematica a ser calculada. Ex: "2 + 3 * 4", "(10 - 5) / 2", "100 * 0.15"'
          }
        },
        required: ['expression']
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: { type: 'number', description: 'Resultado do calculo' },
          expression: { type: 'string', description: 'Expressao original avaliada' }
        }
      }
    });
  }

  async execute(params) {
    const { expression } = params;

    const sanitized = expression.replace(/\s+/g, '').replace(/[^0-9+\-*/().^]/g, '');

    if (!sanitized || sanitized.length === 0) {
      throw new Error('Expressao matematica invalida');
    }

    try {
      const jsExpression = sanitized.replace(/\^/g, '**');
      const result = Function(`"use strict"; return (${jsExpression})`)();

      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Resultado nao e um numero valido');
      }

      const rounded = Math.round(result * 1e10) / 1e10;

      return {
        result: rounded,
        expression: sanitized,
        formatted: this._formatResult(rounded)
      };
    } catch (error) {
      throw new Error(`Erro ao calcular: ${error.message}`);
    }
  }

  _formatResult(num) {
    if (Number.isInteger(num)) {
      return num.toString();
    }
    return num.toFixed(2).replace(/\.?0+$/, '');
  }
}

module.exports = CalculateTool;