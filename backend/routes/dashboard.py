"""
Tractor Ledger - Dashboard Routes
Aggregated stats for the home screen.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from routes.auth import get_current_user
from database import get_supabase_client_with_token
from models.farmer import format_indian_currency

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


class DashboardStats(BaseModel):
    """Aggregated dashboard statistics."""
    total_farmers: int = 0
    total_farms: int = 0
    total_work_entries: int = 0
    total_work_amount: float = 0.0
    total_work_amount_formatted: str = "₹0.00"
    total_payments: int = 0
    total_paid_amount: float = 0.0
    total_paid_amount_formatted: str = "₹0.00"
    total_remaining_due: float = 0.0
    total_remaining_due_formatted: str = "₹0.00"
    farmers_with_dues: int = 0
    recent_work_entries: list[dict] = []
    recent_payments: list[dict] = []
    top_debtors: list[dict] = []


@router.get("/", response_model=DashboardStats)
async def get_dashboard(
    current_user: dict = Depends(get_current_user),
):
    """
    Get aggregated dashboard statistics for the authenticated user.
    Includes counts, totals, recent activity, and top debtors.
    """
    try:
        client = get_supabase_client_with_token(current_user["access_token"])
        user_id = current_user["user_id"]

        # ---- Counts ----
        farmers_result = (
            client.table("farmers")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("is_deleted", False)
            .execute()
        )
        total_farmers = farmers_result.count or 0

        farms_result = (
            client.table("farms")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("is_deleted", False)
            .execute()
        )
        total_farms = farms_result.count or 0

        # ---- Work entries aggregate ----
        work_result = (
            client.table("work_entries")
            .select("id, total_amount")
            .eq("user_id", user_id)
            .eq("is_deleted", False)
            .execute()
        )
        total_work_entries = len(work_result.data) if work_result.data else 0
        total_work_amount = sum(
            (entry.get("total_amount", 0) or 0) for entry in (work_result.data or [])
        )

        # ---- Payments aggregate ----
        payments_result = (
            client.table("payments")
            .select("id, amount")
            .eq("user_id", user_id)
            .eq("is_deleted", False)
            .execute()
        )
        total_payments = len(payments_result.data) if payments_result.data else 0
        total_paid_amount = sum(
            (p.get("amount", 0) or 0) for p in (payments_result.data or [])
        )

        total_remaining_due = total_work_amount - total_paid_amount

        # ---- Recent work entries (last 5) ----
        recent_work = (
            client.table("work_entries")
            .select("id, farmer_id, date, work_type, total_amount")
            .eq("user_id", user_id)
            .eq("is_deleted", False)
            .order("date", desc=True)
            .limit(5)
            .execute()
        )

        # Enrich with farmer names
        recent_work_entries = []
        if recent_work.data:
            farmer_ids = list({e["farmer_id"] for e in recent_work.data})
            farmers_lookup = (
                client.table("farmers")
                .select("id, name")
                .in_("id", farmer_ids)
                .execute()
            )
            farmer_names = {f["id"]: f["name"] for f in (farmers_lookup.data or [])}

            for entry in recent_work.data:
                recent_work_entries.append({
                    "id": entry["id"],
                    "farmer_name": farmer_names.get(entry["farmer_id"], "Unknown"),
                    "date": entry["date"],
                    "work_type": entry["work_type"],
                    "total_amount": entry["total_amount"],
                    "total_amount_formatted": format_indian_currency(entry["total_amount"] or 0),
                })

        # ---- Recent payments (last 5) ----
        recent_pay = (
            client.table("payments")
            .select("id, farmer_id, amount, payment_date")
            .eq("user_id", user_id)
            .eq("is_deleted", False)
            .order("payment_date", desc=True)
            .limit(5)
            .execute()
        )

        recent_payments = []
        if recent_pay.data:
            farmer_ids = list({p["farmer_id"] for p in recent_pay.data})
            farmers_lookup = (
                client.table("farmers")
                .select("id, name")
                .in_("id", farmer_ids)
                .execute()
            )
            farmer_names = {f["id"]: f["name"] for f in (farmers_lookup.data or [])}

            for payment in recent_pay.data:
                recent_payments.append({
                    "id": payment["id"],
                    "farmer_name": farmer_names.get(payment["farmer_id"], "Unknown"),
                    "payment_date": payment["payment_date"],
                    "amount": payment["amount"],
                    "amount_formatted": format_indian_currency(payment["amount"] or 0),
                })

        # ---- Top debtors from farmer_dues view (top 5) ----
        dues_result = (
            client.table("farmer_dues")
            .select("*")
            .eq("user_id", user_id)
            .gt("remaining_due", 0)
            .order("remaining_due", desc=True)
            .limit(5)
            .execute()
        )

        farmers_with_dues = 0
        top_debtors = []
        if dues_result.data:
            # Count all farmers with dues
            all_dues = (
                client.table("farmer_dues")
                .select("farmer_id", count="exact")
                .eq("user_id", user_id)
                .gt("remaining_due", 0)
                .execute()
            )
            farmers_with_dues = all_dues.count or 0

            for d in dues_result.data:
                top_debtors.append({
                    "farmer_id": d["farmer_id"],
                    "farmer_name": d["farmer_name"],
                    "village": d.get("village"),
                    "remaining_due": d["remaining_due"],
                    "remaining_due_formatted": format_indian_currency(d["remaining_due"] or 0),
                })

        return DashboardStats(
            total_farmers=total_farmers,
            total_farms=total_farms,
            total_work_entries=total_work_entries,
            total_work_amount=total_work_amount,
            total_work_amount_formatted=format_indian_currency(total_work_amount),
            total_payments=total_payments,
            total_paid_amount=total_paid_amount,
            total_paid_amount_formatted=format_indian_currency(total_paid_amount),
            total_remaining_due=total_remaining_due,
            total_remaining_due_formatted=format_indian_currency(total_remaining_due),
            farmers_with_dues=farmers_with_dues,
            recent_work_entries=recent_work_entries,
            recent_payments=recent_payments,
            top_debtors=top_debtors,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching dashboard: {str(e)}",
        )
