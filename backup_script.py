r"""
Tractor Ledger -- Secure Daily PostgreSQL Backup Script
=======================================================
Script location : C:\Users\ASUS VIVOBOOK\Downloads\Live_Tractor-Ledger-main\Tractor-Ledger-main\backup_script.py
Backup data     : D:\Tractor Ledger Backups\

Runs once per day at 11:00 PM via Windows Task Scheduler.

Operations (in order):
  1.  Validate SUPABASE_DB_URL environment variable
  2.  Create required backup data directories
  3.  Run full pg_dump  (--no-owner --no-privileges --clean --if-exists)
      NOTE: NO --schema-only; this is a FULL data dump.
  4.  Write dump to temp file first (safe swap)
  5.  Validate backup content
  6.  Monthly archive on last day of month
  7.  Local monthly retention (12 months)
  8.  Upload daily backup to Google Drive via rclone
  9.  Upload monthly archive to Google Drive (if created)
  10. Google Drive monthly retention (12 months)
  11. Final summary log

Security:
  - SUPABASE_DB_URL is read exclusively from the environment.
  - The password is NEVER written to logs or printed to stdout.

Usage:
  python backup_script.py
"""

import os
import sys
import shutil
import subprocess
import re
import logging
from datetime import datetime, date
from calendar import monthrange
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
# Backup DATA lives outside the Git project so it is never committed.
BACKUP_DATA_DIR = Path(r"D:\Tractor Ledger Backups")
DAILY_DIR       = BACKUP_DATA_DIR / "daily"
MONTHLY_DIR     = BACKUP_DATA_DIR / "monthly"
LOG_FILE        = BACKUP_DATA_DIR / "backup_log.txt"
DAILY_BACKUP    = DAILY_DIR / "backup-latest.sql"
DAILY_TMP       = DAILY_DIR / "backup-latest.tmp.sql"

RCLONE_EXE    = Path(r"C:\rclone\rclone.exe")
GDRIVE_DAILY   = "gdrive:TractorLedgerBackups/daily"
GDRIVE_MONTHLY = "gdrive:TractorLedgerBackups/monthly"

MONTHLY_RETENTION_MONTHS = 12

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------
def setup_logging() -> logging.Logger:
    """Configure logging to both file and stdout."""
    BACKUP_DATA_DIR.mkdir(parents=True, exist_ok=True)  # ensure dir exists early

    logger = logging.getLogger("tractor_backup")
    logger.setLevel(logging.INFO)

    fmt = logging.Formatter("[%(asctime)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")

    fh = logging.FileHandler(LOG_FILE, encoding="utf-8")
    fh.setFormatter(fmt)
    logger.addHandler(fh)

    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(fmt)
    logger.addHandler(ch)

    return logger


# ---------------------------------------------------------------------------
# Helper -- mask password in URL for safe logging
# ---------------------------------------------------------------------------
def _mask_url(url: str) -> str:
    """Replace the password portion of a postgres URL with ****."""
    return re.sub(r"(:)[^:@]+(@)", r"\1****\2", url)


# ---------------------------------------------------------------------------
# STEP 1 -- Validate environment variable
# ---------------------------------------------------------------------------
def validate_env(logger: logging.Logger) -> str:
    db_url = os.environ.get("SUPABASE_DB_URL", "")
    if not db_url:
        logger.error(
            "SUPABASE_DB_URL environment variable is not set. "
            "Set it with: [Environment]::SetEnvironmentVariable("
            "'SUPABASE_DB_URL','postgresql://...','User')"
        )
        sys.exit(1)

    if not db_url.startswith(("postgresql://", "postgres://")):
        logger.error(
            "SUPABASE_DB_URL does not look like a valid PostgreSQL connection URL "
            "(must start with 'postgresql://' or 'postgres://')."
        )
        sys.exit(1)

    logger.info("SUPABASE_DB_URL validated: %s", _mask_url(db_url))
    return db_url


# ---------------------------------------------------------------------------
# STEP 2 -- Create directories
# ---------------------------------------------------------------------------
def create_directories(logger: logging.Logger) -> None:
    for d in (BACKUP_DATA_DIR, DAILY_DIR, MONTHLY_DIR):
        d.mkdir(parents=True, exist_ok=True)
    logger.info("Backup data directories verified: %s", BACKUP_DATA_DIR)


# ---------------------------------------------------------------------------
# STEP 3 + 4 -- Run pg_dump (safe temp-file swap)
# ---------------------------------------------------------------------------
def run_pg_dump(db_url: str, logger: logging.Logger) -> bool:
    """
    Run a FULL pg_dump (including all data -- no --schema-only) to a temp file.
    Only replaces backup-latest.sql after verified success.
    Returns True on success, False on failure.
    """
    if DAILY_TMP.exists():
        DAILY_TMP.unlink()

    cmd = [
        "pg_dump",
        db_url,
        "--no-owner",
        "--no-privileges",
        "--clean",
        "--if-exists",
        "-f", str(DAILY_TMP),
    ]

    logger.info("Running pg_dump (full data dump, no --schema-only)...")

    env = os.environ.copy()

    try:
        result = subprocess.run(
            cmd,
            env=env,
            capture_output=True,
            text=True,
            timeout=600,
        )
    except FileNotFoundError:
        logger.error(
            "pg_dump not found. Install PostgreSQL client tools and ensure "
            "pg_dump is on the system PATH."
        )
        return False
    except subprocess.TimeoutExpired:
        logger.error("pg_dump timed out after 10 minutes.")
        if DAILY_TMP.exists():
            DAILY_TMP.unlink()
        return False

    if result.returncode != 0:
        logger.error("pg_dump failed (exit code %d).", result.returncode)
        if result.stderr:
            logger.error("pg_dump stderr: %s", _mask_url(result.stderr.strip()))
        if DAILY_TMP.exists():
            DAILY_TMP.unlink()
        return False

    if result.stderr:
        logger.info("pg_dump stderr (warnings): %s", _mask_url(result.stderr.strip()))

    logger.info("pg_dump completed successfully.")
    return True


# ---------------------------------------------------------------------------
# STEP 5 -- Validate the backup file
# ---------------------------------------------------------------------------
def validate_backup(tmp_file: Path, logger: logging.Logger) -> bool:
    """
    Verify the dump file:
      1. Exists
      2. Non-zero size
      3. Contains recognisable PostgreSQL dump markers
    On success, moves it to backup-latest.sql.
    """
    if not tmp_file.exists():
        logger.error("Backup temp file missing after pg_dump: %s", tmp_file)
        return False

    size_bytes = tmp_file.stat().st_size
    if size_bytes == 0:
        logger.error("Backup temp file is empty (0 bytes).")
        tmp_file.unlink()
        return False

    try:
        with tmp_file.open("r", encoding="utf-8", errors="replace") as f:
            header = f.read(4096)
    except OSError as exc:
        logger.error("Could not read backup temp file: %s", exc)
        return False

    pg_markers = ["PostgreSQL database dump", "pg_dump", "SET "]
    if not any(marker in header for marker in pg_markers):
        logger.error(
            "Backup file does not appear to be a valid PostgreSQL dump "
            "(no expected markers found in first 4 KB). Discarding."
        )
        tmp_file.unlink()
        return False

    shutil.move(str(tmp_file), str(DAILY_BACKUP))

    size_kb = size_bytes / 1024
    logger.info("Backup validation passed.")
    logger.info("Daily backup path : %s", DAILY_BACKUP)
    logger.info("Daily backup size : %.1f KB", size_kb)
    logger.info("Timestamp         : %s", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

    return True


# ---------------------------------------------------------------------------
# STEP 6 -- Monthly archive (last day of month only)
# ---------------------------------------------------------------------------
def handle_monthly_archive(logger: logging.Logger):
    """
    If today is the last day of the month, copy the validated daily backup
    to monthly/backup-YYYY-MM.sql.
    Returns (was_created, monthly_path_or_None).
    """
    today    = date.today()
    last_day = monthrange(today.year, today.month)[1]

    if today.day != last_day:
        logger.info(
            "No monthly archive required (day %d of %d).",
            today.day, last_day,
        )
        return False, None

    month_label  = today.strftime("%Y-%m")
    monthly_file = MONTHLY_DIR / f"backup-{month_label}.sql"

    logger.info("Today is the last day of the month -- creating monthly archive.")

    try:
        shutil.copy2(str(DAILY_BACKUP), str(monthly_file))
    except OSError as exc:
        logger.error("Failed to create monthly archive: %s", exc)
        return False, None

    logger.info("Monthly archive created: %s", monthly_file.name)
    return True, monthly_file


# ---------------------------------------------------------------------------
# STEP 7 -- Local monthly retention
# ---------------------------------------------------------------------------
def _cutoff(months_back: int):
    """Return (year, month) of the cutoff point."""
    today = date.today()
    m = today.month - months_back
    y = today.year + m // 12
    m = m % 12
    if m <= 0:
        m += 12
        y -= 1
    return y, m


def apply_local_monthly_retention(logger: logging.Logger) -> None:
    """Delete local monthly archives older than MONTHLY_RETENTION_MONTHS."""
    cutoff = _cutoff(MONTHLY_RETENTION_MONTHS)
    pattern = re.compile(r"^backup-(\d{4})-(\d{2})\.sql$")

    for f in sorted(MONTHLY_DIR.iterdir()):
        if not f.is_file():
            continue
        m = pattern.match(f.name)
        if not m:
            continue
        key = (int(m.group(1)), int(m.group(2)))
        if key < cutoff:
            try:
                f.unlink()
                logger.info("Deleted expired local monthly archive: %s", f.name)
            except OSError as exc:
                logger.error("Could not delete local archive %s: %s", f.name, exc)


# ---------------------------------------------------------------------------
# STEP 8 -- Google Drive daily upload
# ---------------------------------------------------------------------------
def upload_daily_to_gdrive(logger: logging.Logger) -> bool:
    if not RCLONE_EXE.exists():
        logger.error(
            "rclone not found at %s. Install rclone and configure 'gdrive' remote.",
            RCLONE_EXE,
        )
        return False

    logger.info("Uploading daily backup to Google Drive...")
    cmd = [str(RCLONE_EXE), "copy", str(DAILY_BACKUP), GDRIVE_DAILY, "--progress"]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    except subprocess.TimeoutExpired:
        logger.error("rclone daily upload timed out after 5 minutes.")
        return False

    if result.returncode != 0:
        logger.error(
            "Google Drive daily upload FAILED (exit code %d): %s",
            result.returncode, result.stderr.strip(),
        )
        return False

    logger.info("Google Drive daily upload: SUCCESS")
    return True


# ---------------------------------------------------------------------------
# STEP 9 -- Google Drive monthly upload
# ---------------------------------------------------------------------------
def upload_monthly_to_gdrive(monthly_file: Path, logger: logging.Logger) -> bool:
    if not RCLONE_EXE.exists():
        logger.error("rclone not found -- skipping Google Drive monthly upload.")
        return False

    logger.info("Uploading %s to Google Drive...", monthly_file.name)
    cmd = [str(RCLONE_EXE), "copy", str(monthly_file), GDRIVE_MONTHLY, "--progress"]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    except subprocess.TimeoutExpired:
        logger.error("rclone monthly upload timed out.")
        return False

    if result.returncode != 0:
        logger.error(
            "Google Drive monthly upload FAILED (exit code %d): %s",
            result.returncode, result.stderr.strip(),
        )
        return False

    logger.info("Google Drive monthly upload: SUCCESS (%s)", monthly_file.name)
    return True


# ---------------------------------------------------------------------------
# STEP 10 -- Google Drive monthly retention
# ---------------------------------------------------------------------------
def apply_gdrive_monthly_retention(logger: logging.Logger) -> None:
    if not RCLONE_EXE.exists():
        logger.warning("rclone not found -- skipping Google Drive retention check.")
        return

    try:
        result = subprocess.run(
            [str(RCLONE_EXE), "lsf", GDRIVE_MONTHLY],
            capture_output=True, text=True, timeout=60,
        )
    except subprocess.TimeoutExpired:
        logger.error("rclone lsf timed out -- skipping Google Drive retention.")
        return

    if result.returncode != 0:
        logger.warning(
            "Could not list Google Drive monthly archives (exit code %d): %s",
            result.returncode, result.stderr.strip(),
        )
        return

    cutoff  = _cutoff(MONTHLY_RETENTION_MONTHS)
    pattern = re.compile(r"^backup-(\d{4})-(\d{2})\.sql$")

    for line in result.stdout.splitlines():
        fname = line.strip()
        m = pattern.match(fname)
        if not m:
            continue
        key = (int(m.group(1)), int(m.group(2)))
        if key < cutoff:
            remote_path = f"{GDRIVE_MONTHLY}/{fname}"
            try:
                del_result = subprocess.run(
                    [str(RCLONE_EXE), "deletefile", remote_path],
                    capture_output=True, text=True, timeout=60,
                )
                if del_result.returncode == 0:
                    logger.info("Deleted expired GDrive monthly archive: %s", fname)
                else:
                    logger.error(
                        "Failed to delete GDrive archive %s: %s",
                        fname, del_result.stderr.strip(),
                    )
            except subprocess.TimeoutExpired:
                logger.error("Timeout deleting GDrive archive: %s", fname)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    logger = setup_logging()

    logger.info("=" * 60)
    logger.info("Tractor Ledger Backup Started")
    logger.info("=" * 60)

    db_url = validate_env(logger)            # STEP 1
    create_directories(logger)              # STEP 2

    if not run_pg_dump(db_url, logger):     # STEP 3+4
        logger.error("Backup FAILED at pg_dump stage. Exiting.")
        sys.exit(1)

    if not validate_backup(DAILY_TMP, logger):  # STEP 5
        logger.error("Backup FAILED at validation stage. Previous backup preserved.")
        sys.exit(1)

    logger.info("pg_dump successful")

    monthly_created, monthly_file = handle_monthly_archive(logger)  # STEP 6
    apply_local_monthly_retention(logger)                            # STEP 7

    daily_ok = upload_daily_to_gdrive(logger)                        # STEP 8
    if not daily_ok:
        logger.error("GDrive daily upload FAILED. Local backup intact: %s", DAILY_BACKUP)

    if monthly_created and monthly_file is not None:                 # STEP 9
        if not upload_monthly_to_gdrive(monthly_file, logger):
            logger.error(
                "GDrive monthly upload FAILED. Local archive intact: %s", monthly_file
            )

    apply_gdrive_monthly_retention(logger)                           # STEP 10

    logger.info("=" * 60)
    logger.info("Backup Complete")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
