"""
Tractor Ledger - Farmer Routes
Full CRUD for farmers with soft delete.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional
from uuid import UUID
from datetime import datetime, timezone

from models.farmer import FarmerCreate, FarmerUpdate, FarmerResponse, FarmerWithDues
from routes.auth import get_current_user
from database import get_supabase_client_with_token

router = APIRouter(prefix="/farmers", tags=["Farmers"])


@router.get("/", response_model=list[FarmerResponse])
async def list_farmers(
    search: Optional[str] = Query(None, description="Search by name or village"),
    include_deleted: bool = Query(False, description="Include soft-deleted farmers"),
    current_user: dict = Depends(get_current_user),
):
    """List all farmers for the authenticated user."""
    try:
        client = get_supabase_client_with_token(current_user["access_token"])
        query = (
            client.table("farmers")
            .select("*")
            .eq("user_id", current_user["user_id"])
            .order("name")
        )

        if not include_deleted:
            query = query.eq("is_deleted", False)

        if search:
            query = query.or_(f"name.ilike.%{search}%,village.ilike.%{search}%")

        result = query.execute()
        return result.data

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing farmers: {str(e)}",
        )


@router.get("/dues", response_model=list[FarmerWithDues])
async def list_farmers_with_dues(
    current_user: dict = Depends(get_current_user),
):
    """List all farmers with their dues summary from the farmer_dues view."""
    try:
        client = get_supabase_client_with_token(current_user["access_token"])
        result = (
            client.table("farmer_dues")
            .select("*")
            .eq("user_id", current_user["user_id"])
            .order("remaining_due", desc=True)
            .execute()
        )
        return result.data

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching farmer dues: {str(e)}",
        )


@router.get("/{farmer_id}", response_model=FarmerResponse)
async def get_farmer(
    farmer_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    """Get a specific farmer by ID."""
    try:
        client = get_supabase_client_with_token(current_user["access_token"])
        result = (
            client.table("farmers")
            .select("*")
            .eq("id", str(farmer_id))
            .eq("user_id", current_user["user_id"])
            .eq("is_deleted", False)
            .single()
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Farmer not found.",
            )

        return result.data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching farmer: {str(e)}",
        )


@router.post("/", response_model=FarmerResponse, status_code=status.HTTP_201_CREATED)
async def create_farmer(
    farmer: FarmerCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new farmer."""
    try:
        client = get_supabase_client_with_token(current_user["access_token"])
        data = farmer.model_dump(exclude_none=True)
        data["user_id"] = current_user["user_id"]

        result = client.table("farmers").insert(data).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create farmer.",
            )

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating farmer: {str(e)}",
        )


@router.put("/{farmer_id}", response_model=FarmerResponse)
async def update_farmer(
    farmer_id: UUID,
    farmer: FarmerUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update an existing farmer."""
    try:
        client = get_supabase_client_with_token(current_user["access_token"])
        data = farmer.model_dump(exclude_none=True)

        if not data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update.",
            )

        data["updated_at"] = datetime.now(timezone.utc).isoformat()

        result = (
            client.table("farmers")
            .update(data)
            .eq("id", str(farmer_id))
            .eq("user_id", current_user["user_id"])
            .eq("is_deleted", False)
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Farmer not found.",
            )

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating farmer: {str(e)}",
        )


@router.delete("/{farmer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_farmer(
    farmer_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    """Soft delete a farmer (sets is_deleted = TRUE)."""
    try:
        client = get_supabase_client_with_token(current_user["access_token"])
        result = (
            client.table("farmers")
            .update({
                "is_deleted": True,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            .eq("id", str(farmer_id))
            .eq("user_id", current_user["user_id"])
            .eq("is_deleted", False)
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Farmer not found.",
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting farmer: {str(e)}",
        )
