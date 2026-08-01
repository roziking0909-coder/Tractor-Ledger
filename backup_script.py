"""
Tractor Ledger — Automated Backup Script
Runs daily via Windows Task Scheduler
Saves to: Local PC + Google Drive
Cost: ₹0 | No credit card needed
"""

import subprocess
import shutil
import sys
from datetime import datetime, date
from pathlib import Path
from dateutil.relativedelta import relativedelta

# ══════════════════════════════════════════════════════════════
# CONFIGURATION — Update SUPABASE_DB_URL with real password
# ══════════════════════════════════════════════════════════════
SUPABASE_DB_URL = "postgresql://postgres:[PASSWORD]@db.eexdcakosmckdmdzjojx.supabase.co:5432/postgres"

# Local backup directories
BACKUP_DIR   = Path(r"D:\Tractor Ledger\backups")
DAILY_DIR    = BACKUP_DIR / "daily"
MONTHLY_DIR  = BACKUP_DIR / "monthly"

# Google Drive folder name (rclone remote must be named "gdrive")
GDRIVE_DAILY   = "gdrive:TractorLedgerBackups/daily"
GDRIVE_MONTHLY = "gdrive:TractorLedgerBackups/monthly"

# How many months to keep monthly archives (older ones auto-deleted)
KEEP_MONTHS = 12

# ══════════════════════════════════════════════════════════════
# SETUP — Create folders if they don't exist
# ══════════════════════════════════════════════════════════════
BACKUP_DIR.mkdir(parents=True, exist_ok=True)
DAILY_DIR.mkdir(parents=True, exist_ok=True)
MONTHLY_DIR.mkdir(parents=True, exist_ok=True)

# Log file — keeps a record of every backup run
LOG_FILE = BACKUP_DIR / "backup_log.txt"

def log(message: str):
    """Print to console and append to log file"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {message}"
    print(line)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")

# ══════════════════════════════════════════════════════════════
# STEP 1 — Dump Supabase database to local file
# ══════════════════════════════════════════════════════════════
log("=" * 60)
log("Tractor Ledger Backup Started")

daily_file = DAILY_DIR / "backup-latest.sql"

log(f"Running pg_dump → {daily_file}")

result = subprocess.run(
    [
        "pg_dump",
        SUPABASE_DB_URL,
        "--no-owner",
        "--no-privileges",
        "--clean",
        "--if-exists",
        "-f", str(daily_file)
    ],
    capture_output=True,
    text=True
)

if result.returncode != 0:
    log(f"ERROR: pg_dump failed!")
    log(f"Details: {result.stderr}")
    log("Backup FAILED. Check connection string and internet.")
    sys.exit(1)

file_size_kb = daily_file.stat().st_size / 1024
log(f"Local daily backup saved: {daily_file}")
log(f"File size: {file_size_kb:.1f} KB")

# ══════════════════════════════════════════════════════════════
# STEP 2 — Check if today is the last day of the month
#          If yes, save a permanent monthly archive copy
# ══════════════════════════════════════════════════════════════
today = date.today()

# Last day of month: tomorrow's day number is less than today's
try:
    next_day = date(today.year, today.month, today.day + 1)
    is_last_day = False
except ValueError:
    # today.day + 1 overflows — means today IS the last day
    is_last_day = True

monthly_file = None
if is_last_day:
    month_label = today.strftime("%Y-%m")
    monthly_file = MONTHLY_DIR / f"backup-{month_label}.sql"
    shutil.copy2(daily_file, monthly_file)
    log(f"Monthly archive saved: {monthly_file}")
else:
    log(f"Not last day of month ({today}) — skipping monthly archive")

# ══════════════════════════════════════════════════════════════
# STEP 3 — Delete monthly archives older than 12 months
# ══════════════════════════════════════════════════════════════
cutoff = today - relativedelta(months=KEEP_MONTHS)
deleted_count = 0

for f in MONTHLY_DIR.glob("backup-*.sql"):
    try:
        file_month_str = f.stem.replace("backup-", "")
        file_date = datetime.strptime(file_month_str, "%Y-%m").date()
        if file_date < cutoff:
            f.unlink()
            log(f"Deleted old monthly backup: {f.name}")
            deleted_count += 1
    except Exception as e:
        log(f"Could not process file {f.name}: {e}")

if deleted_count == 0:
    log("No old monthly backups to delete")

# ══════════════════════════════════════════════════════════════
# STEP 4 — Upload daily backup to Google Drive via rclone
# ══════════════════════════════════════════════════════════════
log(f"Uploading daily backup to Google Drive...")

result_gdrive = subprocess.run(
    [
        "rclone", "copy",
        str(daily_file),
        GDRIVE_DAILY,
        "--drive-use-trash=false",
        "--log-level=ERROR"
    ],
    capture_output=True,
    text=True
)

if result_gdrive.returncode == 0:
    log(f"Google Drive daily backup uploaded to: {GDRIVE_DAILY}")
else:
    # NOT a fatal error — local backup already saved safely
    log(f"WARNING: Google Drive upload failed (local backup still safe)")
    log(f"rclone error: {result_gdrive.stderr}")

# ══════════════════════════════════════════════════════════════
# STEP 5 — Upload monthly archive to Google Drive (if created)
# ══════════════════════════════════════════════════════════════
if monthly_file and monthly_file.exists():
    log(f"Uploading monthly archive to Google Drive...")

    result_monthly = subprocess.run(
        [
            "rclone", "copy",
            str(monthly_file),
            GDRIVE_MONTHLY,
            "--drive-use-trash=false",
            "--log-level=ERROR"
        ],
        capture_output=True,
        text=True
    )

    if result_monthly.returncode == 0:
        log(f"Google Drive monthly archive uploaded to: {GDRIVE_MONTHLY}")
    else:
        log(f"WARNING: Google Drive monthly upload failed")
        log(f"rclone error: {result_monthly.stderr}")

# ══════════════════════════════════════════════════════════════
# STEP 6 — Also delete old monthly archives from Google Drive
# ══════════════════════════════════════════════════════════════
log("Cleaning old monthly archives from Google Drive...")

list_result = subprocess.run(
    ["rclone", "lsf", GDRIVE_MONTHLY, "--log-level=ERROR"],
    capture_output=True,
    text=True
)

if list_result.returncode == 0:
    for filename in list_result.stdout.strip().split("\n"):
        filename = filename.strip()
        if not filename or not filename.startswith("backup-"):
            continue
        try:
            month_str = filename.replace("backup-", "").replace(".sql", "")
            file_date = datetime.strptime(month_str, "%Y-%m").date()
            if file_date < cutoff:
                del_result = subprocess.run(
                    [
                        "rclone", "deletefile",
                        f"{GDRIVE_MONTHLY}/{filename}",
                        "--drive-use-trash=false"
                    ],
                    capture_output=True, text=True
                )
                if del_result.returncode == 0:
                    log(f"Deleted old Google Drive backup: {filename}")
        except Exception as e:
            log(f"Could not check {filename}: {e}")
else:
    log("Could not list Google Drive backups (may not exist yet — OK on first run)")

# ══════════════════════════════════════════════════════════════
# DONE
# ══════════════════════════════════════════════════════════════
log("Backup Complete!")
log("=" * 60)
