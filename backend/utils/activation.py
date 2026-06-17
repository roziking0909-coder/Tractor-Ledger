"""
Tractor Ledger — Activation Code Generation
Format: TL-YYYY-XXXXXX (safe chars, no 0/O/I/1/L confusion)
"""

import random
from datetime import datetime

from database import get_supabase_admin_client

SAFE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def generate_activation_code() -> str:
    """Generate code like TL-2026-X7K9M2"""
    year = datetime.now().year
    random_part = "".join(random.choices(SAFE_CHARS, k=6))
    return f"TL-{year}-{random_part}"


def generate_unique_code(supabase=None) -> str:
    """Generate and ensure uniqueness in activation_codes table."""
    client = supabase or get_supabase_admin_client()
    for _ in range(20):
        code = generate_activation_code()
        existing = client.table("activation_codes").select("id").eq("code", code).execute()
        if not existing.data:
            return code
    raise RuntimeError("Could not generate unique code after 20 attempts")
