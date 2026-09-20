# ==============================================================================
# Tractor Ledger -- Windows Task Scheduler Setup
# ==============================================================================
# Creates the "TractorLedgerDailyBackup" scheduled task that runs:
#   python backup_script.py
# every day at 11:00 PM from the current project directory.
#
# Usage (run once, as Administrator if needed):
#   powershell -ExecutionPolicy Bypass -File "C:\Users\ASUS VIVOBOOK\Downloads\Live_Tractor-Ledger-main\Tractor-Ledger-main\setup_backup_task.ps1"
# ==============================================================================

$TaskName     = "TractorLedgerDailyBackup"
$ProjectRoot  = "C:\Users\ASUS VIVOBOOK\Downloads\Live_Tractor-Ledger-main\Tractor-Ledger-main"
$PythonScript = Join-Path $ProjectRoot "backup_script.py"
$ScheduleTime = "23:00"   # 11:00 PM -- DO NOT CHANGE

# ---------------------------------------------------------------------------
# Verify python is available
# ---------------------------------------------------------------------------
$PythonExe = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $PythonExe) {
    Write-Error "Python not found on PATH. Install Python and re-run."
    exit 1
}
Write-Host "Python found: $PythonExe"

# ---------------------------------------------------------------------------
# Verify the backup script exists
# ---------------------------------------------------------------------------
if (-not (Test-Path $PythonScript)) {
    Write-Error "backup_script.py not found at: $PythonScript"
    exit 1
}
Write-Host "Backup script: $PythonScript"

# ---------------------------------------------------------------------------
# Remove any existing task with this name (safe re-registration)
# ---------------------------------------------------------------------------
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Removing existing task '$TaskName' (re-registering with updated path)..."
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# ---------------------------------------------------------------------------
# Build task components
# ---------------------------------------------------------------------------
$Action = New-ScheduledTaskAction `
    -Execute    $PythonExe `
    -Argument   "`"$PythonScript`"" `
    -WorkingDirectory $ProjectRoot

# Every day at 11:00 PM
$Trigger = New-ScheduledTaskTrigger -Daily -At $ScheduleTime

$Principal = New-ScheduledTaskPrincipal `
    -UserId    ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel  Limited

$Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

# ---------------------------------------------------------------------------
# Register — with proper error handling
# ---------------------------------------------------------------------------
try {
    $registered = Register-ScheduledTask `
        -TaskName   $TaskName `
        -Action     $Action `
        -Trigger    $Trigger `
        -Principal  $Principal `
        -Settings   $Settings `
        -Description "Tractor Ledger daily PostgreSQL backup -- every day at 11:00 PM" `
        -Force `
        -ErrorAction Stop

    # Verify the task actually exists after registration
    $verify = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if (-not $verify) {
        Write-Error "Register-ScheduledTask returned but task '$TaskName' not found. Registration may have failed."
        exit 1
    }

    # Enable the task explicitly (compatible with all PS versions)
    Enable-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue | Out-Null

    Write-Host ""
    Write-Host "=============================================="
    Write-Host " Task created successfully"
    Write-Host " Task name : $TaskName"
    Write-Host " Script    : $PythonScript"
    Write-Host " Schedule  : Every day at 11:00 PM"
    Write-Host "=============================================="
    Write-Host ""
    Write-Host "Useful management commands:"
    Write-Host ""
    Write-Host "  # Run immediately (for testing):"
    Write-Host "  Start-ScheduledTask -TaskName `"$TaskName`""
    Write-Host ""
    Write-Host "  # Check last run result:"
    Write-Host "  Get-ScheduledTaskInfo -TaskName `"$TaskName`""
    Write-Host ""
    Write-Host "  # Disable (pause) the task:"
    Write-Host "  Disable-ScheduledTask -TaskName `"$TaskName`""
    Write-Host ""
    Write-Host "  # Remove the task entirely:"
    Write-Host "  Unregister-ScheduledTask -TaskName `"$TaskName`" -Confirm:`$false"
    Write-Host ""
    Write-Host "  # Tail the backup log:"
    Write-Host "  Get-Content `"D:\Tractor Ledger Backups\backup_log.txt`" -Tail 30"

} catch {
    Write-Error "Task registration FAILED: $_"
    exit 1
}
