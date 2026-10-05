@echo off
REM Quality Agent - Executa avaliacao 3x ao dia
REM Agende no Windows Task Scheduler para rodar a cada 8 horas (ex: 6h, 14h, 22h)

cd /d "C:\Users\carlos.costato\Documents\Charles_chatbot\backend"
node scripts/quality-scheduler.js >> logs\quality-agent.log 2>&1
echo [%date% %time%] Ciclo concluido >> logs\quality-agent.log