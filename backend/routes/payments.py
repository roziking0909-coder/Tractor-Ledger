"""
Tractor Ledger - Payment Routes
CRUD operations for farmer payments.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional
from uuid import UUID
from datetime import date

from models.payment import PaymentCreate, PaymentUpdate, PaymentResponse
from routes.auth import get_current_user
from database import get_supabase_client_with_token

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.get("/", response_model=list[PaymentResponse])
async def list_payments(
    farmer_id: Optional[UUID] = Query(None, description="Filter by farmer ID"),
    date_from: Optional[date] = Query(None, description="Filter from date (inclusive)"),
    date_to: Optional[date] = Query(None, description="Filter to date (inclusive)"),
    limit: int = Query(100, ge=1, le=500, description="Max records to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    current_user: dict = Depends(get_current_user),
):
    """List payments with optional filters and pagination."""
    try:
        client = get_supabase_client_with_token(current_user["access_token"])
        query = (
            client.table("payments")
            .select("*")
            .eq("user_id", current_user["user_id"])
            .eq("is_deleted", False)
            .order("payment_date", desc=True)
            .limit(limit)
            .offset(offset)
        )

        if farmer_id:
            query = query.eq("farmer_id", str(farmer_id))
        if date_from:
            query = query.gte("payment_date", date_from.isoformat())
        if date_to:
            query = query.lte("payment_date", date_to.isoformat())

        result = query.execute()
        return result.data

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing payments: {str(e)}",
        )


@router.get("/{payment_id}", response_model=PaymentResponse)
async def get_payment(
    payment_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    """Get a specific payment by ID."""
    try:
        client = get_supabase_client_with_token(current_user["access_token"])
        result = (
            client.table("payments")
            .select("*")
            .eq("id", str(payment_id))
            .eq("user_id", current_user["user_id"])
            .eq("is_deleted", False)
            .single()
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment not found.",
            )

        return result.data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching payment: {str(e)}",
        )


@router.post("/", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def create_payment(
    payment: PaymentCreate,
    current_user: dict = Depends(get_current_user),
):
    """Record a new payment from a farmer."""
    try:
        client = get_supabase_client_with_token(current_user["access_token"])

        # Verify farmer belongs to current user
        farmer_check = (
            client.table("farmers")
            .select("id")
            .eq("id", str(payment.farmer_id))
            .eq("user_id", current_user["user_id"])
            .eq("is_deleted", False)
            .execute()
        )

        if not farmer_check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Farmer not found or does not belong to you.",
            )

        data = payment.model_dump(exclude_none=True)
        data["user_id"] = current_user["user_id"]
        data["farmer_id"] = str(payment.farmer_id)
        data["payment_date"] = payment.payment_date.isoformat()

        result = client.table("payments").insert(data).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create payment.",
            )

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating payment: {str(e)}",
        )


@router.put("/{payment_id}", response_model=PaymentResponse)
async def update_payment(
    payment_id: UUID,
    payment: PaymentUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update an existing payment."""
    try:
        client = get_supabase_client_with_token(current_user["access_token"])
        data = payment.model_dump(exclude_none=True)

        if not data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update.",
            )

        # Convert types for Supabase
        if "farmer_id" in data:
            data["farmer_id"] = str(data["farmer_id"])
        if "payment_date" in data:
            data["payment_date"] = data["payment_date"].isoformat()

        result = (
            client.table("payments")
            .update(data)
            .eq("id", str(payment_id))
            .eq("user_id", current_user["user_id"])
            .eq("is_deleted", False)
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment not found.",
            )

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating payment: {str(e)}",
        )


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment(
    payment_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    """Soft delete a payment (sets is_deleted = TRUE)."""
    try:
        client = get_supabase_client_with_token(current_user["access_token"])
        result = (
            client.table("payments")
            .update({"is_deleted": True})
            .eq("id", str(payment_id))
            .eq("user_id", current_user["user_id"])
            .eq("is_deleted", False)
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment not found.",
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting payment: {str(e)}",
        )
