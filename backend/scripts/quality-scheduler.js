/**
 * quality-scheduler.js
 * Scheduler para execução automática do QualityImprovementAgent.
 * Roda a cada N horas (configurável) e aplica melhorias contínuas.
 *
 * Uso:
 *   node backend/scripts/quality-scheduler.js          # Executa uma vez
 *   node backend/scripts/quality-scheduler.js --daemon # Roda em loop
 *   npm run quality:schedule                           # Via package.json
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { getQualityImprovementAgent } = require('../agents/quality-improvement-agent');

const agent = getQualityImprovementAgent();

async function runOnce() {
  console.log('[QualityScheduler] Iniciando ciclo de avaliação...');
  try {
    const result = await agent.runOnce();
    console.log('[QualityScheduler] Ciclo concluído.');
    console.log(`Score: ${result.score}/10`);
    process.exit(result.score >= agent.config.targetScore ? 0 : 1);
  } catch (error) {
    console.error('[QualityScheduler] Erro:', error.message);
    process.exit(1);
  }
}

async function runDaemon() {
  const intervalHours = agent.config.evaluationIntervalHours || 6;
  const intervalMs = intervalHours * 60 * 60 * 1000;

  console.log(`[QualityScheduler] Modo daemon iniciado — intervalo: ${intervalHours}h`);

  // Executa imediatamente
  await runCycle();

  // Agenda execuções periódicas
  setInterval(async () => {
    await runCycle();
  }, intervalMs);

  async function runCycle() {
    console.log(`\n[${new Date().toISOString()}] Iniciando ciclo agendado...`);
    try {
      await agent.runOnce();
    } catch (error) {
      console.error('[QualityScheduler] Erro no ciclo:', error.message);
    }
  }
}

// CLI
const args = process.argv.slice(2);
if (args.includes('--daemon') || args.includes('-d')) {
  runDaemon();
} else if (args.includes('--dashboard') || args.includes('--status')) {
  const dashboard = agent.getDashboard();
  console.log('\n==============================================');
  console.log('  QUALITY IMPROVEMENT DASHBOARD');
  console.log('==============================================');
  console.log(`Score Atual:     ${dashboard.currentScore}/10`);
  console.log(`Target:          ${dashboard.targetScore}/10`);
  console.log(`Progresso:       ${dashboard.progress}`);
  console.log(`Tendência:       ${dashboard.trend}`);
  console.log(`Avaliações:      ${dashboard.totalEvaluations}`);
  console.log(`Última execução: ${dashboard.lastEvaluation || 'nunca'}`);
  console.log('\nHistórico Recente:');
  dashboard.recentScores.forEach(r => {
    console.log(`  ${r.date.split('T')[0]} — ${r.score}/10`);
  });
  console.log('==============================================\n');
} else {
  runOnce();
}