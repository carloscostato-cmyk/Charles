/**
 * metrics.js
 *
 * Coleta de Métricas e Dashboard Operacional.
 * Agrega dados do Tracer para visualização em tempo real.
 *
 * FASE 7 - Observabilidade
 */

const { getTracer } = require('./tracer');

class MetricsCollector {
  constructor() {
    this.tracer = getTracer();
    this.realtimeStats = {
      activeConnections: 0,
      requestsPerMinute: 0,
      lastMinuteRequests: []
    };
  }

  /**
   * Registra início de requisição
   */
  recordRequestStart() {
    this.realtimeStats.activeConnections++;
    const now = Date.now();
    this.realtimeStats.lastMinuteRequests.push(now);
    // Limpa requisições antigas (> 1 minuto)
    this.realtimeStats.lastMinuteRequests = this.realtimeStats.lastMinuteRequests
      .filter((t) => now - t < 60000);
    this.realtimeStats.requestsPerMinute = this.realtimeStats.lastMinuteRequests.length;
  }

  /**
   * Registra fim de requisição
   */
  recordRequestEnd() {
    this.realtimeStats.activeConnections = Math.max(0, this.realtimeStats.activeConnections - 1);
  }

  /**
   * Retorna dados do dashboard
   * @returns {Promise<Object>}
   */
  async getDashboard() {
    const stats24h = await this.tracer.getStats(24);
    const stats1h = await this.tracer.getStats(1);
    const recentTraces = await this.tracer.getRecentTraces(10);

    return {
      realtime: {
        activeConnections: this.realtimeStats.activeConnections,
        requestsPerMinute: this.realtimeStats.requestsPerMinute
      },
      last24h: stats24h,
      last1h: stats1h,
      recentTraces
    };
  }

  /**
   * Retorna métricas resumidas para o endpoint /api/status
   * @returns {Promise<Object>}
   */
  async getSummary() {
    const stats = await this.tracer.getStats(24);
    return {
      totalRequests24h: stats.totalRequests,
      avgResponseTime: stats.avgDuration,
      totalTokens24h: stats.totalTokens,
      totalCost24h: stats.totalCost,
      successRate: stats.successRate,
      topModel: stats.byModel[0]?.model || 'N/A',
      topIntent: stats.byIntent[0]?.intent || 'N/A'
    };
  }
}

// Singleton
let instance = null;

function getMetricsCollector() {
  if (!instance) {
    instance = new MetricsCollector();
  }
  return instance;
}

module.exports = { getMetricsCollector, MetricsCollector };