/**
 * system-status-tool.js
 *
 * Ferramenta que retorna o status do sistema Charles.
 * Útil para diagnóstico e monitoramento.
 *
 * FASE 2 - Tool Calling
 */

const BaseTool = require('./base-tool');
const os = require('os');

class SystemStatusTool extends BaseTool {
  constructor() {
    super({
      name: 'SystemStatusTool',
      description: 'Retorna o status do sistema Charles: uptime, memória, CPU, serviços ativos. Use quando o usuário perguntar sobre o status do sistema.',
      timeout: 2000,
      inputSchema: {
        type: 'object',
        properties: {
          detail: {
            type: 'string',
            description: 'Nível de detalhe: "basic" ou "full"'
          }
        }
      },
      outputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Status geral do sistema' },
          uptime: { type: 'number', description: 'Uptime em segundos' },
          memory: { type: 'object', description: 'Informações de memória' },
          cpu: { type: 'object', description: 'Informações de CPU' }
        }
      }
    });
  }

  async execute(params = {}) {
    const { detail = 'basic' } = params;

    const memTotal = os.totalmem();
    const memFree = os.freemem();
    const memUsed = memTotal - memFree;
    const memUsagePercent = ((memUsed / memTotal) * 100).toFixed(1);

    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0].model : 'Desconhecido';
    const cpuCores = cpus.length;

    const uptimeSeconds = os.uptime();
    const uptimeHours = Math.floor(uptimeSeconds / 3600);
    const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);

    const result = {
      status: 'online',
      uptime: uptimeSeconds,
      uptimeFormatted: `${uptimeHours}h ${uptimeMinutes}m`,
      memory: {
        total: `${(memTotal / 1024 / 1024 / 1024).toFixed(2)} GB`,
        used: `${(memUsed / 1024 / 1024 / 1024).toFixed(2)} GB`,
        free: `${(memFree / 1024 / 1024 / 1024).toFixed(2)} GB`,
        usagePercent: `${memUsagePercent}%`
      },
      cpu: {
        model: cpuModel,
        cores: cpuCores,
        loadAverage: os.loadavg()
      },
      platform: `${os.type()} ${os.release()}`,
      hostname: os.hostname()
    };

    if (detail === 'full') {
      result.nodeVersion = process.version;
      result.pid = process.pid;
      result.memoryProcess = `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`;
    }

    return result;
  }
}

module.exports = SystemStatusTool;