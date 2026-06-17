"""
Tractor Ledger - Expenses API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional
from uuid import UUID
from datetime import date as DateType
from models.expense import ExpenseCreate, ExpenseUpdate, ExpenseResponse
from routes.auth import get_current_user
from database import get_supabase_client_with_token

router = APIRouter(prefix="/expenses", tags=["Expenses"])


@router.get("", response_model=list[ExpenseResponse])
async def list_expenses(
    month: Optional[str] = Query(None, description="Filter by month YYYY-MM"),
    expense_type: Optional[str] = Query(None, description="Filter by expense type"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
):
    """List all expenses for the authenticated user."""
    try:
        supabase = get_supabase_client_with_token(current_user["token"])
        query = supabase.table("expenses").select("*").eq("user_id", current_user["id"]).eq("is_deleted", False).order("date", desc=True)
        
        if month:
            query = query.gte("date", f"{month}-01").lt("date", f"{month}-32")
        if expense_type:
            query = query.eq("expense_type", expense_type)
        
        result = query.range(offset, offset + limit - 1).execute()
        return result.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(
    expense: ExpenseCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new expense entry."""
    try:
        supabase = get_supabase_client_with_token(current_user["token"])
        data = expense.model_dump()
        data["user_id"] = current_user["id"]
        data["date"] = data["date"].isoformat()
        result = supabase.table("expenses").insert(data).execute()
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{expense_id}", status_code=status.HTTP_200_OK)
async def delete_expense(
    expense_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    """Soft-delete an expense."""
    try:
        supabase = get_supabase_client_with_token(current_user["token"])
        result = supabase.table("expenses").update({"is_deleted": True}).eq("id", str(expense_id)).eq("user_id", current_user["id"]).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Expense not found")
        return {"message": "Expense deleted", "id": str(expense_id)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary/monthly")
async def monthly_expense_summary(
    month: Optional[str] = Query(None, description="Month in YYYY-MM format"),
    current_user: dict = Depends(get_current_user),
):
    """Get monthly expense summary with breakdown by type."""
    try:
        supabase = get_supabase_client_with_token(current_user["token"])
        
        if not month:
            from datetime import datetime
            month = datetime.now().strftime("%Y-%m")
        
        # Get expenses
        expenses = supabase.table("expenses").select("*").eq("user_id", current_user["id"]).eq("is_deleted", False).gte("date", f"{month}-01").lt("date", f"{month}-32").execute()
        
        total_expenses = sum(e["amount"] for e in expenses.data)
        
        # Get income from work entries
        work = supabase.table("work_entries").select("total_amount").eq("user_id", current_user["id"]).eq("is_deleted", False).gte("date", f"{month}-01").lt("date", f"{month}-32").execute()
        
        total_income = sum(w["total_amount"] for w in work.data)
        
        # Breakdown by type
        breakdown = {}
        for e in expenses.data:
            t = e["expense_type"]
            breakdown[t] = breakdown.get(t, 0) + e["amount"]
        
        return {
            "month": month,
            "total_expenses": total_expenses,
            "total_income": total_income,
            "net_profit": total_income - total_expenses,
            "breakdown": breakdown,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
