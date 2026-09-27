"""
Tractor Ledger — Subscription & Referral Routes
Manual activation codes, wallet balance, referral rewards.
"""

import random
import re
import string
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from database import get_supabase_admin_client
from routes.auth import get_current_user
from utils.profile import ensure_user_profile

router = APIRouter(prefix="/subscription", tags=["Subscription"])

SUBSCRIPTION_PRICE = 2000
REFERRAL_REWARD = 100
SAFE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_referral_code(name: str) -> str:
    """Vijay Patel → VIJA284"""
    clean = re.sub(r"[^A-Za-z]", "", name or "").upper()[:4]
    if len(clean) < 2:
        clean = "USER"
    suffix = "".join(random.choices(string.digits, k=3))
    return f"{clean}{suffix}"


def ensure_referral_code(supabase, user_id: str, name: str) -> str:
    """Assign referral code if user doesn't have one."""
    user = supabase.table("users").select("referral_code").eq("id", user_id).single().execute()
    if user.data and user.data.get("referral_code"):
        return user.data["referral_code"]

    for _ in range(10):
        code = make_referral_code(name)
        exists = supabase.table("users").select("id").eq("referral_code", code).execute()
        if not exists.data:
            supabase.table("users").update({"referral_code": code}).eq("id", user_id).execute()
            return code

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Could not generate referral code",
    )


def parse_date(value) -> Optional[date]:
    if not value:
        return None
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ActivateRequest(BaseModel):
    activation_code: str = Field(..., description="Code sent via WhatsApp")
    referral_code: Optional[str] = None


class ValidateCodeRequest(BaseModel):
    code: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/status")
async def get_status(current_user: dict = Depends(get_current_user)):
    """
    Called on app open after login.
    Returns subscription info, wallet balance, and referral code.
    """
    supabase = get_supabase_admin_client()
    user_id = current_user["user_id"]
    # 1. Lazily provision missing profile (if Google Auth bypassed OTP)
    ensure_user_profile(current_user)

    result = (
        supabase.table("users")
        .select(
            "subscription_status, subscription_start, subscription_end, "
            "referral_code, wallet_balance, name, phone"
        )
        .eq("id", user_id)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    data = result.data
    today = date.today()

    if data.get("subscription_end") and data.get("subscription_status") == "active":
        end = parse_date(data["subscription_end"])
        if end and end < today:
            supabase.table("users").update({"subscription_status": "expired"}).eq("id", user_id).execute()
            data["subscription_status"] = "expired"

    if not data.get("referral_code") and data.get("name"):
        data["referral_code"] = ensure_referral_code(supabase, user_id, data["name"])

    days_remaining = 0
    if data.get("subscription_end") and data.get("subscription_status") == "active":
        end = parse_date(data["subscription_end"])
        if end:
            days_remaining = max(0, (end - today).days)

    wallet = float(data.get("wallet_balance") or 0)
    amount_to_pay = max(0, SUBSCRIPTION_PRICE - wallet)

    return {
        "status": data.get("subscription_status", "inactive"),
        "is_active": data.get("subscription_status") == "active",
        "end_date": data.get("subscription_end"),
        "days_remaining": days_remaining,
        "referral_code": data.get("referral_code"),
        "wallet_balance": wallet,
        "amount_to_pay": amount_to_pay,
    }


import time
from collections import defaultdict
import asyncio

# Rate limiting state (In-memory, acceptable for single-worker Render deploy without Redis overhead)
# Format: { user_id: {"failures": int, "window_start": float} }
activation_failures = defaultdict(lambda: {"failures": 0, "window_start": 0.0})
MAX_FAILURES = 5
WINDOW_SECONDS = 600  # 10 minutes

@router.post("/activate")
async def activate(req: ActivateRequest, current_user: dict = Depends(get_current_user)):
    """Validate activation code, activate subscription, handle referral credit."""
    supabase = get_supabase_admin_client()
    user_id = current_user["user_id"]
    code = req.activation_code.strip().upper()

    # 1. Rate Limiting Check
    now = time.time()
    user_rate = activation_failures[user_id]

    if now - user_rate["window_start"] > WINDOW_SECONDS:
        user_rate["failures"] = 0
        user_rate["window_start"] = now

    if user_rate["failures"] >= MAX_FAILURES:
        raise HTTPException(
            status_code=429,
            detail="ઘણા નિષ્ફળ પ્રયાસો. કૃપા કરીને 10 મિનિટ પછી ફરી પ્રયાસ કરો." # Too many failed attempts
        )


    ensure_user_profile(current_user)

    try:
        rpc_result = supabase.rpc(
            "redeem_activation_code",
            {"p_user_id": user_id, "p_code": code}
        ).execute()

        rpc_data = rpc_result.data
        end_date = rpc_data["subscription_end"]
        valid_days = rpc_data["days_valid"]
        wallet_used = rpc_data["wallet_used"]

    except Exception as e:
        # Increment failure on any rejection
        user_rate["failures"] += 1

        err_msg = str(e)
        if "INVALID_CODE" in err_msg or "CODE_ALREADY_USED" in err_msg or "PHONE_MISMATCH" in err_msg or "CODE_EXPIRED" in err_msg:
            # UNIFIED ERROR MESSAGE to prevent leaking valid/used/phone-bound code states
            raise HTTPException(status_code=400, detail="અમાન્ય અથવા વપરાયેલ એક્ટિવેશન કોડ")
        else:
            raise HTTPException(status_code=500, detail="સર્વર ભૂલ")

    # Clear failures on successful activation
    if user_id in activation_failures:
        del activation_failures[user_id]



    referrer_name = None
    if req.referral_code:
        ref_code = req.referral_code.strip().upper()
        referrer_result = (
            supabase.table("users")
            .select("id, name, wallet_balance")
            .eq("referral_code", ref_code)
            .execute()
        )

        if referrer_result.data:
            referrer = referrer_result.data[0]
            if referrer["id"] != user_id:
                already = (
                    supabase.table("referrals")
                    .select("id")
                    .eq("referee_id", user_id)
                    .execute()
                )
                if not already.data:
                    reward = REFERRAL_REWARD
                    new_balance = float(referrer.get("wallet_balance") or 0) + reward

                    supabase.table("users").update(
                        {"wallet_balance": new_balance}
                    ).eq("id", referrer["id"]).execute()

                    referee_label = current_user.get("phone") or "નવો વપરાશકર્તા"
                    supabase.table("wallet_transactions").insert({
                        "user_id": referrer["id"],
                        "type": "credit",
                        "amount": reward,
                        "description": f"રેફરલ: {referee_label} એ એક્ટિવ કર્યું",
                        "balance_after": new_balance,
                    }).execute()

                    supabase.table("referrals").insert({
                        "referrer_id": referrer["id"],
                        "referee_id": user_id,
                        "referral_code": ref_code,
                        "reward_amount": reward,
                        "credited": True,
                    }).execute()

                    supabase.table("users").update(
                        {"referred_by": ref_code}
                    ).eq("id", user_id).execute()

                    referrer_name = referrer.get("name")

    return {
        "success": True,
        "subscription_end": end_date,
        "days_valid": valid_days,
        "wallet_used": wallet_used,
        "referral_credited_to": referrer_name,
    }


@router.post("/validate-activation-code")
async def validate_activation_code(
    req: ValidateCodeRequest,
    current_user: dict = Depends(get_current_user),
):
    """Quick check before submitting activation."""
    supabase = get_supabase_admin_client()
    code = req.code.strip().upper()

    result = supabase.table("activation_codes").select("is_used").eq("code", code).execute()
    if not result.data:
        return {"valid": False, "message": "કોડ મળ્યો નહીં"}
    if result.data[0].get("is_used"):
        return {"valid": False, "message": "આ કોડ પહેલેથી વપરાઈ ગયો છે"}
    return {"valid": True, "message": "કોડ સાચો છે ✓"}


@router.get("/validate-referral-code")
async def validate_referral_code(
    code: str = Query(..., min_length=2),
    current_user: dict = Depends(get_current_user),
):
    """Check if referral code belongs to another user."""
    supabase = get_supabase_admin_client()
    result = (
        supabase.table("users")
        .select("id, name")
        .eq("referral_code", code.strip().upper())
        .execute()
    )

    if not result.data:
        return {"valid": False}
    if result.data[0]["id"] == current_user["user_id"]:
        return {"valid": False, "message": "તમારો પોતાનો કોડ વાપરી શકાય નહીં"}
    return {"valid": True, "referrer_name": result.data[0].get("name")}


@router.get("/my-referrals")
async def my_referrals(current_user: dict = Depends(get_current_user)):
    """Referral code, wallet balance, referral history."""
    supabase = get_supabase_admin_client()
    user_id = current_user["user_id"]

    user = (
        supabase.table("users")
        .select("referral_code, wallet_balance, name")
        .eq("id", user_id)
        .single()
        .execute()
    )

    if user.data and not user.data.get("referral_code") and user.data.get("name"):
        user.data["referral_code"] = ensure_referral_code(
            supabase, user_id, user.data["name"]
        )

    referrals = (
        supabase.table("referrals")
        .select("*")
        .eq("referrer_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    referral_list = referrals.data or []
    for ref in referral_list:
        if ref.get("referee_id"):
            referee = (
                supabase.table("users")
                .select("name, phone")
                .eq("id", ref["referee_id"])
                .single()
                .execute()
            )
            ref["referee"] = referee.data

    transactions = (
        supabase.table("wallet_transactions")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )

    return {
        "referral_code": (user.data or {}).get("referral_code"),
        "wallet_balance": float((user.data or {}).get("wallet_balance") or 0),
        "total_referrals": len(referral_list),
        "referrals": referral_list,
        "wallet_transactions": transactions.data or [],
    }
