# ==============================================================================
# Tractor Ledger -- Backup System Pre-flight Test
# ==============================================================================
# Tests all prerequisites and then runs a real backup end-to-end.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\ASUS VIVOBOOK\Downloads\Live_Tractor-Ledger-main\Tractor-Ledger-main\test_backup.ps1"
# ==============================================================================

$ProjectRoot       = "C:\Users\ASUS VIVOBOOK\Downloads\Live_Tractor-Ledger-main\Tractor-Ledger-main"
$PythonScript      = Join-Path $ProjectRoot "backup_script.py"
$BackupDataDir     = "D:\Tractor Ledger Backups"
$DailyBackup       = "$BackupDataDir\daily\backup-latest.sql"
$LogFile           = "$BackupDataDir\backup_log.txt"
$RcloneExe         = "C:\rclone\rclone.exe"
$GdriveDailyFolder = "gdrive:TractorLedgerBackups/daily"

$Results = [ordered]@{}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " TRACTOR LEDGER BACKUP TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
function Pass($key) {
    $Results[$key] = "PASS"
    Write-Host ("  [PASS] " + $key) -ForegroundColor Green
}
function Fail($key, $reason) {
    $Results[$key] = "FAIL"
    Write-Host ("  [FAIL] " + $key + " -- " + $reason) -ForegroundColor Red
}
function Info($msg) {
    Write-Host ("         " + $msg) -ForegroundColor Gray
}

# ---------------------------------------------------------------------------
# TEST 1 -- pg_dump
# ---------------------------------------------------------------------------
Write-Host "Test 1 -- pg_dump" -ForegroundColor Yellow
try {
    $pgver = & pg_dump --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Pass "Test 1 - pg_dump"; Info $pgver
    } else {
        Fail "Test 1 - pg_dump" "non-zero exit"
    }
} catch {
    Fail "Test 1 - pg_dump" "pg_dump not found on PATH -- install PostgreSQL client tools"
}

# ---------------------------------------------------------------------------
# TEST 2 -- Python
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "Test 2 -- Python" -ForegroundColor Yellow
try {
    $pyver = & python --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Pass "Test 2 - Python"; Info $pyver
    } else {
        Fail "Test 2 - Python" "non-zero exit"
    }
} catch {
    Fail "Test 2 - Python" "python not found on PATH"
}

# ---------------------------------------------------------------------------
# TEST 3 -- python-dateutil
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "Test 3 -- python-dateutil" -ForegroundColor Yellow
$duCheck = & python -c "import dateutil; print(dateutil.__version__)" 2>&1
if ($LASTEXITCODE -eq 0) {
    Pass "Test 3 - python-dateutil"; Info "version: $duCheck"
} else {
    Info "Not found -- attempting pip install..."
    & python -m pip install python-dateutil --quiet
    $duCheck2 = & python -c "import dateutil; print(dateutil.__version__)" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Pass "Test 3 - python-dateutil"; Info "Installed: $duCheck2"
    } else {
        Fail "Test 3 - python-dateutil" "could not import even after pip install"
    }
}

# ---------------------------------------------------------------------------
# TEST 4 -- rclone
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "Test 4 -- rclone" -ForegroundColor Yellow
if (Test-Path $RcloneExe) {
    $rv = & $RcloneExe version 2>&1 | Select-Object -First 1
    Pass "Test 4 - rclone"; Info $rv
} else {
    Fail "Test 4 - rclone" "rclone.exe not found at $RcloneExe -- download from https://rclone.org/downloads/"
}

# ---------------------------------------------------------------------------
# TEST 5 -- Google Drive remote
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "Test 5 -- Google Drive remote ('gdrive')" -ForegroundColor Yellow
if (Test-Path $RcloneExe) {
    $remotes = & $RcloneExe listremotes 2>&1
    if ($remotes -match "gdrive:") {
        Pass "Test 5 - Google Drive remote"
        Info "gdrive remote is configured"
    } else {
        Fail "Test 5 - Google Drive remote" "'gdrive' remote not found -- run: $RcloneExe config"
        Info "Current remotes: $remotes"
    }
} else {
    Fail "Test 5 - Google Drive remote" "rclone not available (see Test 4)"
}

# ---------------------------------------------------------------------------
# TEST 6 -- SUPABASE_DB_URL
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "Test 6 -- SUPABASE_DB_URL" -ForegroundColor Yellow
$dbUrl = [Environment]::GetEnvironmentVariable("SUPABASE_DB_URL", "User")
if ([string]::IsNullOrWhiteSpace($dbUrl)) { $dbUrl = $env:SUPABASE_DB_URL }

if ([string]::IsNullOrWhiteSpace($dbUrl)) {
    Fail "Test 6 - SUPABASE_DB_URL" "Variable not set. Run: [Environment]::SetEnvironmentVariable('SUPABASE_DB_URL','postgresql://...','User')"
} elseif ($dbUrl -notmatch "^postgres(ql)?://") {
    Fail "Test 6 - SUPABASE_DB_URL" "Does not look like a valid PostgreSQL URL"
} elseif ($dbUrl -match "YOUR_REAL_PASSWORD|example\.com|placeholder") {
    Fail "Test 6 - SUPABASE_DB_URL" "Contains a placeholder value -- set the real connection URL"
} else {
    $masked = $dbUrl -replace '(:)[^:@]+(@)', '$1****$2'
    Pass "Test 6 - SUPABASE_DB_URL"; Info "Connection: $masked"
}

# ---------------------------------------------------------------------------
# TEST 7 -- Actual backup execution
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "Test 7 -- Running actual backup..." -ForegroundColor Yellow

if ($Results["Test 2 - Python"] -eq "PASS" -and $Results["Test 6 - SUPABASE_DB_URL"] -eq "PASS") {
    Info "Executing: python `"$PythonScript`""
    & python $PythonScript
    $backupExitCode = $LASTEXITCODE

    if ($backupExitCode -ne 0) {
        Fail "Test 7 - Local backup" "backup_script.py exited with code $backupExitCode -- see output above"
    } elseif (Test-Path $DailyBackup) {
        $item   = Get-Item $DailyBackup
        $sizeKB = [math]::Round($item.Length / 1KB, 1)

        if ($item.Length -eq 0) {
            Fail "Test 7 - Local backup" "backup-latest.sql is 0 bytes"
        } else {
            $header = Get-Content $DailyBackup -TotalCount 20 -ErrorAction SilentlyContinue
            $hText  = $header -join "`n"
            $valid  = ($hText -match "PostgreSQL database dump") -or
                      ($hText -match "pg_dump") -or
                      ($hText -match "SET ")

            if ($valid) {
                Pass "Test 7 - Local backup"
                Write-Host "         LOCAL BACKUP   : FOUND" -ForegroundColor Green
                Write-Host "         BACKUP SIZE    : $sizeKB KB" -ForegroundColor Green
                Write-Host "         BACKUP CONTENT : VALID PostgreSQL dump" -ForegroundColor Green
                Write-Host "         BACKUP PATH    : $DailyBackup" -ForegroundColor Green
            } else {
                Fail "Test 7 - Local backup" "File exists but content does not look like a valid PostgreSQL dump"
                Write-Host "         BACKUP CONTENT : INVALID" -ForegroundColor Red
            }
        }
    } else {
        Fail "Test 7 - Local backup" "backup-latest.sql not found at $DailyBackup"
    }
} else {
    Fail "Test 7 - Local backup" "Skipped -- Python or SUPABASE_DB_URL prerequisite failed"
}

# ---------------------------------------------------------------------------
# TEST 8 -- Google Drive backup
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "Test 8 -- Google Drive backup verification" -ForegroundColor Yellow

if ($Results["Test 4 - rclone"] -eq "PASS" -and
    $Results["Test 5 - Google Drive remote"] -eq "PASS" -and
    $Results["Test 7 - Local backup"] -eq "PASS") {

    Info "Checking $GdriveDailyFolder for backup-latest.sql..."
    $glist = & $RcloneExe lsf $GdriveDailyFolder 2>&1
    if ($glist -match "backup-latest\.sql") {
        Pass "Test 8 - Google Drive backup"
        Write-Host "         GOOGLE DRIVE BACKUP : PASS" -ForegroundColor Green
    } else {
        Fail "Test 8 - Google Drive backup" "backup-latest.sql not found in Google Drive daily folder"
        Write-Host "         LOCAL BACKUP        : PASS" -ForegroundColor Green
        Write-Host "         GOOGLE DRIVE BACKUP : FAIL" -ForegroundColor Red
        Info "rclone output: $glist"
    }
} elseif ($Results["Test 7 - Local backup"] -eq "PASS") {
    Fail "Test 8 - Google Drive backup" "rclone/gdrive not available -- cannot verify"
    Write-Host "         LOCAL BACKUP        : PASS" -ForegroundColor Green
    Write-Host "         GOOGLE DRIVE BACKUP : FAIL (rclone/remote not ready)" -ForegroundColor Red
} else {
    Fail "Test 8 - Google Drive backup" "Skipped -- local backup test did not pass"
}

# ---------------------------------------------------------------------------
# TEST 9 -- Backup log
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "Test 9 -- Backup log file" -ForegroundColor Yellow

if (Test-Path $LogFile) {
    $tail = Get-Content $LogFile -Tail 30
    $ok   = $tail | Where-Object { $_ -match "Backup Complete|pg_dump successful|Backup validation passed" }
    if ($ok) {
        Pass "Test 9 - Backup log"
        Info "Log: $LogFile"
        $tail | Select-Object -Last 5 | ForEach-Object { Info "  $_" }
    } else {
        Fail "Test 9 - Backup log" "Log exists but no successful backup entry found"
    }
} else {
    Fail "Test 9 - Backup log" "Log not found at $LogFile"
}

# ---------------------------------------------------------------------------
# TEST 10 -- Monthly logic
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "Test 10 -- Monthly backup logic" -ForegroundColor Yellow

if (Test-Path $PythonScript) {
    $sc = Get-Content $PythonScript -Raw
    $ok = ($sc -match "monthrange") -and ($sc -match "last_day") -and ($sc -match "monthly_file")
    if ($ok) {
        Pass "Test 10 - Monthly logic"
        Info "Script contains last-day-of-month detection and archive creation."

        $today   = Get-Date
        $lastDay = [DateTime]::DaysInMonth($today.Year, $today.Month)
        if ($today.Day -eq $lastDay) {
            $label    = $today.ToString("yyyy-MM")
            $mFile    = "$BackupDataDir\monthly\backup-$label.sql"
            if (Test-Path $mFile) {
                Info "Today IS the last day -- monthly archive exists: backup-$label.sql"
            } else {
                Info "Today IS the last day -- monthly archive will be created after backup runs."
            }
        } else {
            Info "Today is day $($today.Day) of $lastDay -- monthly archive will be created on day $lastDay."
        }
    } else {
        Fail "Test 10 - Monthly logic" "Script does not contain expected monthly archive logic"
    }
} else {
    Fail "Test 10 - Monthly logic" "backup_script.py not found at $PythonScript"
}

# ---------------------------------------------------------------------------
# SUMMARY
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " TRACTOR LEDGER BACKUP TEST RESULTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allPassed = $true
$keys = @(
    "Test 1 - pg_dump",
    "Test 2 - Python",
    "Test 3 - python-dateutil",
    "Test 4 - rclone",
    "Test 5 - Google Drive remote",
    "Test 6 - SUPABASE_DB_URL",
    "Test 7 - Local backup",
    "Test 8 - Google Drive backup",
    "Test 9 - Backup log",
    "Test 10 - Monthly logic"
)

foreach ($k in $keys) {
    $status = if ($Results.Contains($k)) { $Results[$k] } else { "SKIP" }
    $color  = switch ($status) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        default { "Yellow" }
    }
    $label  = $k + ":"
    $line   = "  " + $label.PadRight(38) + " " + $status
    Write-Host $line -ForegroundColor $color
    if ($status -ne "PASS") { $allPassed = $false }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host " BACKUP SYSTEM TEST: PASS" -ForegroundColor Green
} else {
    Write-Host " BACKUP SYSTEM TEST: FAIL (see details above)" -ForegroundColor Red
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------------------------
# Restore reference (read-only info)
# ---------------------------------------------------------------------------
Write-Host "RESTORE COMMANDS (reference -- do not run unless needed):" -ForegroundColor Yellow
Write-Host '  Daily:   psql "$env:SUPABASE_DB_URL" -f "D:\Tractor Ledger Backups\daily\backup-latest.sql"'
Write-Host '  Monthly: psql "$env:SUPABASE_DB_URL" -f "D:\Tractor Ledger Backups\monthly\backup-YYYY-MM.sql"'
Write-Host ""
