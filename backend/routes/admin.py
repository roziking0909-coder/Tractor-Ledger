"""
Tractor Ledger — Admin Routes
Protected by X-Admin-Key header. Generate activation codes, view subscribers.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field

from config import get_settings
from database import get_supabase_admin_client
from utils.activation import generate_unique_code

router = APIRouter(prefix="/admin", tags=["Admin"])


def verify_admin(x_admin_key: str = Header(..., alias="X-Admin-Key")):
    settings = get_settings()
    if x_admin_key != settings.ADMIN_SECRET_KEY:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")


class GenerateCodeRequest(BaseModel):
    phone: str = Field(..., description="User phone e.g. +919876543210")
    notes: Optional[str] = None
    valid_days: int = 365


@router.post("/generate-code")
async def generate_code(req: GenerateCodeRequest, _: None = Depends(verify_admin)):
    """Generate activation code for a user who paid."""
    supabase = get_supabase_admin_client()
    code = generate_unique_code(supabase)

    supabase.table("activation_codes").insert({
        "code": code,
        "created_for_phone": req.phone,
        "notes": req.notes,
        "valid_days": req.valid_days,
    }).execute()

    whatsapp_message = (
        f"નમસ્તે! 🚜\n"
        f"Tractor Ledger એક્ટિવેશન કોડ:\n\n"
        f"*{code}*\n\n"
        f"આ કોડ એપમાં નાખો → 1 વર્ષ સક્રિય થશે.\n"
        f"કોઈ સવાલ હોય તો WhatsApp કરો."
    )

    return {
        "code": code,
        "for_phone": req.phone,
        "valid_days": req.valid_days,
        "whatsapp_message": whatsapp_message,
    }


@router.get("/list-codes")
async def list_codes(_: None = Depends(verify_admin)):
    supabase = get_supabase_admin_client()
    codes = (
        supabase.table("activation_codes")
        .select("*")
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return codes.data


@router.get("/subscribers")
async def list_subscribers(_: None = Depends(verify_admin)):
    supabase = get_supabase_admin_client()
    users = (
        supabase.table("users")
        .select(
            "name, phone, subscription_status, subscription_end, "
            "wallet_balance, referral_code, referred_by"
        )
        .in_("subscription_status", ["active", "expired"])
        .order("subscription_end", desc=False)
        .execute()
    )
    return users.data


@router.get("/pending-referrals")
async def pending_referrals(_: None = Depends(verify_admin)):
    supabase = get_supabase_admin_client()
    result = (
        supabase.table("referrals")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )

    rows = result.data or []
    for row in rows:
        if row.get("referrer_id"):
            referrer = (
                supabase.table("users")
                .select("name, phone, wallet_balance")
                .eq("id", row["referrer_id"])
                .single()
                .execute()
            )
            row["referrer"] = referrer.data
        if row.get("referee_id"):
            referee = (
                supabase.table("users")
                .select("name, phone")
                .eq("id", row["referee_id"])
                .single()
                .execute()
            )
            row["referee"] = referee.data

    return rows
