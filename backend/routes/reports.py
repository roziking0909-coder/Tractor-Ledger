"""
Tractor Ledger - Report Routes
Farmer reports, monthly summaries, and PDF ledger generation.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import date, datetime

from routes.auth import get_current_user
from database import get_supabase_client_with_token
from models.farmer import format_indian_currency
from utils.pdf import generate_farmer_ledger_html

router = APIRouter(prefix="/reports", tags=["Reports"])


class FarmerReport(BaseModel):
    """Complete farmer report with work entries, payments, and totals."""
    farmer_id: str
    farmer_name: str
    mobile: Optional[str] = None
    village: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    work_entries: list[dict] = []
    payments: list[dict] = []
    total_work_amount: float = 0.0
    total_work_amount_formatted: str = "₹0.00"
    total_paid: float = 0.0
    total_paid_formatted: str = "₹0.00"
    remaining_due: float = 0.0
    remaining_due_formatted: str = "₹0.00"


class MonthlyReport(BaseModel):
    """Monthly summary report."""
    month: str
    year: int
    total_work_entries: int = 0
    total_work_amount: float = 0.0
    total_work_amount_formatted: str = "₹0.00"
    total_payments: int = 0
    total_paid: float = 0.0
    total_paid_formatted: str = "₹0.00"
    net_due: float = 0.0
    net_due_formatted: str = "₹0.00"
    work_type_breakdown: list[dict] = []
    farmer_breakdown: list[dict] = []


@router.get("/farmer/{farmer_id}", response_model=FarmerReport)
async def get_farmer_report(
    farmer_id: UUID,
    date_from: Optional[date] = Query(None, description="Report start date"),
    date_to: Optional[date] = Query(None, description="Report end date"),
    current_user: dict = Depends(get_current_user),
):
    """
    Get a detailed report for a specific farmer including all
    work entries, payments, and summary totals.
    """
    try:
        client = get_supabase_client_with_token(current_user["access_token"])
        user_id = current_user["user_id"]

        # Fetch farmer
        farmer_result = (
            client.table("farmers")
            .select("*")
            .eq("id", str(farmer_id))
            .eq("user_id", user_id)
            .eq("is_deleted", False)
            .single()
            .execute()
        )

        if not farmer_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Farmer not found.",
            )

        farmer = farmer_result.data

        # Fetch work entries
        work_query = (
            client.table("work_entries")
            .select("*, farms(name)")
            .eq("farmer_id", str(farmer_id))
            .eq("user_id", user_id)
            .eq("is_deleted", False)
            .order("date", desc=True)
        )

        if date_from:
            work_query = work_query.gte("date", date_from.isoformat())
        if date_to:
            work_query = work_query.lte("date", date_to.isoformat())

        work_result = work_query.execute()

        # Fetch payments
        pay_query = (
            client.table("payments")
            .select("*")
            .eq("farmer_id", str(farmer_id))
            .eq("user_id", user_id)
            .eq("is_deleted", False)
            .order("payment_date", desc=True)
        )

        if date_from:
            pay_query = pay_query.gte("payment_date", date_from.isoformat())
        if date_to:
            pay_query = pay_query.lte("payment_date", date_to.isoformat())

        pay_result = pay_query.execute()

        # Calculate totals
        work_entries = []
        total_work_amount = 0.0
        for entry in (work_result.data or []):
            farm_name = ""
            if entry.get("farms"):
                farm_name = entry["farms"].get("name", "")

            total_work_amount += entry.get("total_amount", 0) or 0
            work_entries.append({
                "id": entry["id"],
                "date": entry["date"],
                "farm_name": farm_name,
                "work_type": entry["work_type"],
                "quantity": entry["quantity"],
                "quantity_unit": entry["quantity_unit"],
                "rate": entry["rate"],
                "total_amount": entry["total_amount"],
                "total_amount_formatted": format_indian_currency(entry["total_amount"] or 0),
                "notes": entry.get("notes"),
            })

        payments = []
        total_paid = 0.0
        for payment in (pay_result.data or []):
            total_paid += payment.get("amount", 0) or 0
            payments.append({
                "id": payment["id"],
                "payment_date": payment["payment_date"],
                "amount": payment["amount"],
                "amount_formatted": format_indian_currency(payment["amount"] or 0),
                "notes": payment.get("notes"),
            })

        remaining_due = total_work_amount - total_paid

        return FarmerReport(
            farmer_id=str(farmer_id),
            farmer_name=farmer["name"],
            mobile=farmer.get("mobile"),
            village=farmer.get("village"),
            date_from=date_from.isoformat() if date_from else None,
            date_to=date_to.isoformat() if date_to else None,
            work_entries=work_entries,
            payments=payments,
            total_work_amount=total_work_amount,
            total_work_amount_formatted=format_indian_currency(total_work_amount),
            total_paid=total_paid,
            total_paid_formatted=format_indian_currency(total_paid),
            remaining_due=remaining_due,
            remaining_due_formatted=format_indian_currency(remaining_due),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating farmer report: {str(e)}",
        )


@router.get("/monthly", response_model=MonthlyReport)
async def get_monthly_report(
    year: int = Query(..., description="Year (e.g. 2026)"),
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    current_user: dict = Depends(get_current_user),
):
    """
    Get a monthly summary report with breakdowns by work type and farmer.
    """
    try:
        client = get_supabase_client_with_token(current_user["access_token"])
        user_id = current_user["user_id"]

        # Calculate date range
        month_start = date(year, month, 1)
        if month == 12:
            month_end = date(year + 1, 1, 1)
        else:
            month_end = date(year, month + 1, 1)

        month_names = [
            "", "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ]

        # Fetch work entries for the month
        work_result = (
            client.table("work_entries")
            .select("*, farmers(name)")
            .eq("user_id", user_id)
            .eq("is_deleted", False)
            .gte("date", month_start.isoformat())
            .lt("date", month_end.isoformat())
            .execute()
        )

        # Fetch payments for the month
        pay_result = (
            client.table("payments")
            .select("*, farmers(name)")
            .eq("user_id", user_id)
            .eq("is_deleted", False)
            .gte("payment_date", month_start.isoformat())
            .lt("payment_date", month_end.isoformat())
            .execute()
        )

        # Aggregate work entries
        total_work_amount = 0.0
        work_type_totals: dict[str, float] = {}
        farmer_work_totals: dict[str, dict] = {}

        for entry in (work_result.data or []):
            amount = entry.get("total_amount", 0) or 0
            total_work_amount += amount

            wt = entry.get("work_type", "Other")
            work_type_totals[wt] = work_type_totals.get(wt, 0) + amount

            fid = entry.get("farmer_id", "")
            farmer_name = ""
            if entry.get("farmers"):
                farmer_name = entry["farmers"].get("name", "Unknown")

            if fid not in farmer_work_totals:
                farmer_work_totals[fid] = {
                    "farmer_id": fid,
                    "farmer_name": farmer_name,
                    "work_amount": 0,
                    "paid_amount": 0,
                }
            farmer_work_totals[fid]["work_amount"] += amount

        # Aggregate payments
        total_paid = 0.0
        for payment in (pay_result.data or []):
            amount = payment.get("amount", 0) or 0
            total_paid += amount

            fid = payment.get("farmer_id", "")
            farmer_name = ""
            if payment.get("farmers"):
                farmer_name = payment["farmers"].get("name", "Unknown")

            if fid not in farmer_work_totals:
                farmer_work_totals[fid] = {
                    "farmer_id": fid,
                    "farmer_name": farmer_name,
                    "work_amount": 0,
                    "paid_amount": 0,
                }
            farmer_work_totals[fid]["paid_amount"] += amount

        net_due = total_work_amount - total_paid

        # Format work type breakdown
        work_type_breakdown = [
            {
                "work_type": wt,
                "total_amount": amt,
                "total_amount_formatted": format_indian_currency(amt),
            }
            for wt, amt in sorted(work_type_totals.items(), key=lambda x: -x[1])
        ]

        # Format farmer breakdown
        farmer_breakdown = []
        for fdata in sorted(farmer_work_totals.values(), key=lambda x: -(x["work_amount"] - x["paid_amount"])):
            net = fdata["work_amount"] - fdata["paid_amount"]
            farmer_breakdown.append({
                "farmer_id": fdata["farmer_id"],
                "farmer_name": fdata["farmer_name"],
                "work_amount": fdata["work_amount"],
                "work_amount_formatted": format_indian_currency(fdata["work_amount"]),
                "paid_amount": fdata["paid_amount"],
                "paid_amount_formatted": format_indian_currency(fdata["paid_amount"]),
                "net_due": net,
                "net_due_formatted": format_indian_currency(net),
            })

        return MonthlyReport(
            month=month_names[month],
            year=year,
            total_work_entries=len(work_result.data or []),
            total_work_amount=total_work_amount,
            total_work_amount_formatted=format_indian_currency(total_work_amount),
            total_payments=len(pay_result.data or []),
            total_paid=total_paid,
            total_paid_formatted=format_indian_currency(total_paid),
            net_due=net_due,
            net_due_formatted=format_indian_currency(net_due),
            work_type_breakdown=work_type_breakdown,
            farmer_breakdown=farmer_breakdown,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating monthly report: {str(e)}",
        )


@router.get("/farmer/{farmer_id}/pdf", response_class=HTMLResponse)
async def get_farmer_pdf(
    farmer_id: UUID,
    date_from: Optional[date] = Query(None, description="Report start date"),
    date_to: Optional[date] = Query(None, description="Report end date"),
    current_user: dict = Depends(get_current_user),
):
    """
    Generate a printable HTML ledger for a farmer.
    Returns styled HTML suitable for PDF rendering on the client or print.
    """
    try:
        client = get_supabase_client_with_token(current_user["access_token"])
        user_id = current_user["user_id"]

        # Fetch owner profile
        owner_result = (
            client.table("users")
            .select("name, phone")
            .eq("id", user_id)
            .single()
            .execute()
        )
        owner = owner_result.data or {"name": "Tractor Owner", "phone": ""}

        # Fetch farmer
        farmer_result = (
            client.table("farmers")
            .select("*")
            .eq("id", str(farmer_id))
            .eq("user_id", user_id)
            .eq("is_deleted", False)
            .single()
            .execute()
        )

        if not farmer_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Farmer not found.",
            )

        farmer = farmer_result.data

        # Fetch work entries
        work_query = (
            client.table("work_entries")
            .select("*, farms(name)")
            .eq("farmer_id", str(farmer_id))
            .eq("user_id", user_id)
            .eq("is_deleted", False)
            .order("date")
        )

        if date_from:
            work_query = work_query.gte("date", date_from.isoformat())
        if date_to:
            work_query = work_query.lte("date", date_to.isoformat())

        work_result = work_query.execute()

        # Fetch payments
        pay_query = (
            client.table("payments")
            .select("*")
            .eq("farmer_id", str(farmer_id))
            .eq("user_id", user_id)
            .eq("is_deleted", False)
            .order("payment_date")
        )

        if date_from:
            pay_query = pay_query.gte("payment_date", date_from.isoformat())
        if date_to:
            pay_query = pay_query.lte("payment_date", date_to.isoformat())

        pay_result = pay_query.execute()

        # Process entries
        work_entries = []
        total_work_amount = 0.0
        for entry in (work_result.data or []):
            farm_name = ""
            if entry.get("farms"):
                farm_name = entry["farms"].get("name", "")
            total_work_amount += entry.get("total_amount", 0) or 0
            work_entries.append({
                "date": entry["date"],
                "farm_name": farm_name,
                "work_type": entry["work_type"],
                "quantity": entry["quantity"],
                "quantity_unit": entry["quantity_unit"],
                "rate": entry["rate"],
                "total_amount": entry["total_amount"],
            })

        payments = []
        total_paid = 0.0
        for payment in (pay_result.data or []):
            total_paid += payment.get("amount", 0) or 0
            payments.append({
                "payment_date": payment["payment_date"],
                "amount": payment["amount"],
                "notes": payment.get("notes", ""),
            })

        remaining_due = total_work_amount - total_paid

        # Generate HTML
        html = generate_farmer_ledger_html(
            owner_name=owner.get("name") or "Tractor Owner",
            farmer_name=farmer["name"],
            farmer_village=farmer.get("village", ""),
            farmer_mobile=farmer.get("mobile", ""),
            date_from=date_from.isoformat() if date_from else "All time",
            date_to=date_to.isoformat() if date_to else "Present",
            work_entries=work_entries,
            payments=payments,
            total_work_amount=total_work_amount,
            total_paid=total_paid,
            remaining_due=remaining_due,
        )

        return HTMLResponse(content=html)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating PDF: {str(e)}",
        )
