# Tractor Ledger — Setup Backup Scheduled Task
# Run this script ONCE as Administrator after testing backup_script.py
# Right-click PowerShell → Run as Administrator → run this script

$TaskName = "TractorLedgerDailyBackup"
$ScriptPath = "D:\Tractor Ledger\backup_script.py"
$PythonPath = (Get-Command python).Source

# Remove existing task if it exists
schtasks /delete /tn $TaskName /f 2>$null

# Create new daily task at 11:00 PM
$Action = New-ScheduledTaskAction `
    -Execute $PythonPath `
    -Argument "`"$ScriptPath`"" `
    -WorkingDirectory "D:\Tractor Ledger"

$Trigger = New-ScheduledTaskTrigger `
    -Daily `
    -At "23:00"

$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -RunLevel Highest `
    -Force

Write-Host "Task '$TaskName' created successfully!"
Write-Host "It will run every day at 11:00 PM"
Write-Host ""
Write-Host "To run manually right now:"
Write-Host "  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host ""
Write-Host "To verify it was created:"
Write-Host "  Get-ScheduledTask -TaskName '$TaskName'"
