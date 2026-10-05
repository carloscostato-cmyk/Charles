<# 
  Setup Quality Agent no Windows Task Scheduler
  Executa 3x ao dia (11:00, 15:00 e 17:50), de segunda a sexta, quando o computador estiver ligado
#>

$scriptPath = "C:\Users\carlos.costato\Documents\Charles_chatbot\backend\scripts\run-quality-agent.bat"
$taskName = "Charles-Quality-Agent"

# Cria diretório de logs se não existir
$logDir = "C:\Users\carlos.costato\Documents\Charles_chatbot\backend\logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

# Remove tarefa antiga se existir
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "Tarefa antiga removida."
}

# Define ação: executa o .bat
$action = New-ScheduledTaskAction -Execute $scriptPath

# Define triggers: segunda a sexta às 11h, 15h e 17:50
$triggers = @(
    (New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At 10:00),
    (New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At 15:00),
    (New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At 17:50)
)

# Configurações: só roda se rede disponível, reinicia se falhar
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 10) `
    -DontStopOnIdleEnd `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries

# Registra a tarefa
Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $triggers `
    -Settings $settings `
    -Description "Charles Chatbot Quality Improvement Agent - roda seg-sex as 10:00, 15:00 e 17:50 para melhorar score do chatbot" `
    -Force

Write-Host "✅ Tarefa '$taskName' criada com sucesso!"
Write-Host "   Executa às: 11:00, 15:00 e 17:50 (segunda a sexta, quando PC ligado)"
Write-Host "   Logs em: $logDir\quality-agent.log"
Write-Host ""
Write-Host "Para ver logs: Get-Content $logDir\quality-agent.log -Tail 50 -Wait"
Write-Host "Para desativar: Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
