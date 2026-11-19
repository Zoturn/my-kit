# Registers the daily review in Windows Task Scheduler (runs for your user, no admin needed).
# Usage: powershell -ExecutionPolicy Bypass -File <kit>\scripts\install-task.ps1 [-Time 19:00]
param([string]$Time = "19:00")
$node = (Get-Command node -ErrorAction Stop).Source
$action = New-ScheduledTaskAction -Execute $node -Argument ('"' + (Join-Path $PSScriptRoot "daily-review.mjs") + '"')
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "my-kit daily review" -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Write-Host "Scheduled daily at $Time. Digests: $HOME\.my-kit\digests"
