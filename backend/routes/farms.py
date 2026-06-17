"""
Tractor Ledger - Farm Routes
CRUD operations for farms (fields belonging to farmers).
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional
from uuid import UUID

from models.farm import FarmCreate, FarmUpdate, FarmResponse
from routes.auth import get_current_user
from database import get_supabase_client_with_token

router = APIRouter(prefix="/farms", tags=["Farms"])


@router.get("/", response_model=list[FarmResponse])
async def list_farms(
    farmer_id: Optional[UUID] = Query(None, description="Filter by farmer ID"),
    current_user: dict = Depends(get_current_user),
):
    """List all farms for the authenticated user, optionally filtered by farmer."""
    try:
        client = get_supabase_client_with_token(current_user["access_token"])
        query = (
            client.table("farms")
            .select("*")
            .eq("user_id", current_user["user_id"])
            .eq("is_deleted", False)
            .order("name")
        )

        if farmer_id:
            query = query.eq("farmer_id", str(farmer_id))

        result = query.execute()
        return result.data

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing farms: {str(e)}",
        )


@router.get("/{farm_id}", response_model=FarmResponse)
async def get_farm(
    farm_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    """Get a specific farm by ID."""
    try:
        client = get_supabase_client_with_token(current_user["access_token"])
        result = (
            client.table("farms")
            .select("*")
            .eq("id", str(farm_id))
            .eq("user_id", current_user["user_id"])
            .eq("is_deleted", False)
            .single()
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Farm not found.",
            )

        return result.data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching farm: {str(e)}",
        )


@router.post("/", response_model=FarmResponse, status_code=status.HTTP_201_CREATED)
async def create_farm(
    farm: FarmCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new farm."""
    try:
        client = get_supabase_client_with_token(current_user["access_token"])

        # Verify farmer belongs to current user
        farmer_check = (
            client.table("farmers")
            .select("id")
            .eq("id", str(farm.farmer_id))
            .eq("user_id", current_user["user_id"])
            .eq("is_deleted", False)
            .execute()
        )

        if not farmer_check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Farmer not found or does not belong to you.",
            )

        data = farm.model_dump(exclude_none=True)
        data["user_id"] = current_user["user_id"]
        data["farmer_id"] = str(farm.farmer_id)

        result = client.table("farms").insert(data).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create farm.",
            )

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating farm: {str(e)}",
        )


@router.put("/{farm_id}", response_model=FarmResponse)
async def update_farm(
    farm_id: UUID,
    farm: FarmUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update an existing farm."""
    try:
        client = get_supabase_client_with_token(current_user["access_token"])
        data = farm.model_dump(exclude_none=True)

        if not data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update.",
            )

        # Convert UUID to string for Supabase
        if "farmer_id" in data:
            data["farmer_id"] = str(data["farmer_id"])

        result = (
            client.table("farms")
            .update(data)
            .eq("id", str(farm_id))
            .eq("user_id", current_user["user_id"])
            .eq("is_deleted", False)
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Farm not found.",
            )

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating farm: {str(e)}",
        )


@router.delete("/{farm_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_farm(
    farm_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    """Soft delete a farm (sets is_deleted = TRUE)."""
    try:
        client = get_supabase_client_with_token(current_user["access_token"])
        result = (
            client.table("farms")
            .update({"is_deleted": True})
            .eq("id", str(farm_id))
            .eq("user_id", current_user["user_id"])
            .eq("is_deleted", False)
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Farm not found.",
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting farm: {str(e)}",
        )
