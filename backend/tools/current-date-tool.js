/**
 * current-date-tool.js
 *
 * Ferramenta que retorna data e hora atuais.
 * Útil para o LLM responder perguntas temporais.
 *
 * FASE 2 - Tool Calling
 */

const BaseTool = require('./base-tool');

class CurrentDateTool extends BaseTool {
  constructor() {
    super({
      name: 'CurrentDateTool',
      description: 'Retorna a data e hora atuais. Use quando o usuário perguntar que dia é hoje, que horas são, ou precisar de contexto temporal.',
      timeout: 1000,
      inputSchema: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            description: 'Formato desejado: "date" (apenas data), "time" (apenas hora), "full" (completo)'
          }
        }
      },
      outputSchema: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Data atual formatada' },
          time: { type: 'string', description: 'Hora atual formatada' },
          iso: { type: 'string', description: 'Data em formato ISO' },
          dayOfWeek: { type: 'string', description: 'Dia da semana' }
        }
      }
    });
  }

  async execute(params = {}) {
    const { format = 'full' } = params;
    const now = new Date();

    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    const dateStr = `${now.getDate()} de ${meses[now.getMonth()]} de ${now.getFullYear()}`;
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dayOfWeek = diasSemana[now.getDay()];

    const result = {
      date: dateStr,
      time: timeStr,
      iso: now.toISOString(),
      dayOfWeek,
      full: `${dayOfWeek}, ${dateStr} às ${timeStr}`
    };

    if (format === 'date') {
      return { ...result, formatted: `${dayOfWeek}, ${dateStr}` };
    } else if (format === 'time') {
      return { ...result, formatted: timeStr };
    }

    return { ...result, formatted: result.full };
  }
}

module.exports = CurrentDateTool;