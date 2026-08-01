Write-Host "=== Tractor Ledger Backup Test ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: pg_dump installed?
Write-Host "Test 1: Checking pg_dump..." -ForegroundColor Yellow
try {
    $pgVersion = & pg_dump --version 2>&1
    Write-Host "  PASS: $pgVersion" -ForegroundColor Green
} catch {
    Write-Host "  FAIL: pg_dump not found. Install PostgreSQL Client Tools first." -ForegroundColor Red
    exit 1
}

# Test 2: Python installed?
Write-Host "Test 2: Checking Python..." -ForegroundColor Yellow
try {
    $pyVersion = & python --version 2>&1
    Write-Host "  PASS: $pyVersion" -ForegroundColor Green
} catch {
    Write-Host "  FAIL: Python not found." -ForegroundColor Red
    exit 1
}

# Test 3: python-dateutil installed?
Write-Host "Test 3: Checking python-dateutil..." -ForegroundColor Yellow
$dateutil = & python -c "import dateutil; print('OK')" 2>&1
if ($dateutil -eq "OK") {
    Write-Host "  PASS: python-dateutil installed" -ForegroundColor Green
} else {
    Write-Host "  Installing python-dateutil..." -ForegroundColor Yellow
    pip install python-dateutil
    Write-Host "  PASS: python-dateutil installed" -ForegroundColor Green
}

# Test 4: rclone installed?
Write-Host "Test 4: Checking rclone..." -ForegroundColor Yellow
try {
    $rcloneVersion = & rclone version 2>&1 | Select-Object -First 1
    Write-Host "  PASS: $rcloneVersion" -ForegroundColor Green
} catch {
    Write-Host "  WARN: rclone not found. Google Drive upload will be skipped." -ForegroundColor Yellow
    Write-Host "  Install from: rclone.org/downloads" -ForegroundColor Yellow
}

# Test 5: rclone Google Drive configured?
Write-Host "Test 5: Checking rclone Google Drive config..." -ForegroundColor Yellow
$remotes = & rclone listremotes 2>&1
if ($remotes -match "gdrive") {
    Write-Host "  PASS: Google Drive remote 'gdrive' configured" -ForegroundColor Green
} else {
    Write-Host "  WARN: Google Drive not configured in rclone" -ForegroundColor Yellow
    Write-Host "  Run: rclone config — and set up 'gdrive' remote" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Running backup script now ===" -ForegroundColor Cyan
python "D:\Tractor Ledger\backup_script.py"

Write-Host ""
Write-Host "=== Checking results ===" -ForegroundColor Cyan
$backupFile = "D:\Tractor Ledger\backups\daily\backup-latest.sql"
if (Test-Path $backupFile) {
    $size = (Get-Item $backupFile).Length / 1KB
    Write-Host "  LOCAL BACKUP: FOUND ($([math]::Round($size, 1)) KB)" -ForegroundColor Green
} else {
    Write-Host "  LOCAL BACKUP: NOT FOUND — something went wrong" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan
