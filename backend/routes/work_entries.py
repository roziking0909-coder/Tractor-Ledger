"""
Tractor Ledger - Work Entry Routes
CRUD operations for tractor work entries.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional
from uuid import UUID
from datetime import date

from models.work_entry import WorkEntryCreate, WorkEntryUpdate, WorkEntryResponse
from routes.auth import get_current_user
from database import get_supabase_client_with_token

router = APIRouter(prefix="/work-entries", tags=["Work Entries"])


@router.get("/", response_model=list[WorkEntryResponse])
async def list_work_entries(
    farmer_id: Optional[UUID] = Query(None, description="Filter by farmer ID"),
    farm_id: Optional[UUID] = Query(None, description="Filter by farm ID"),
    work_type: Optional[str] = Query(None, description="Filter by work type"),
    date_from: Optional[date] = Query(None, description="Filter from date (inclusive)"),
    date_to: Optional[date] = Query(None, description="Filter to date (inclusive)"),
    limit: int = Query(100, ge=1, le=500, description="Max records to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    current_user: dict = Depends(get_current_user),
):
    """List work entries with optional filters and pagination."""
    try:
        client = get_supabase_client_with_token(current_user["access_token"])
        query = (
            client.table("work_entries")
            .select("*")
            .eq("user_id", current_user["user_id"])
            .eq("is_deleted", False)
            .order("date", desc=True)
            .limit(limit)
            .offset(offset)
        )

        if farmer_id:
            query = query.eq("farmer_id", str(farmer_id))
        if farm_id:
            query = query.eq("farm_id", str(farm_id))
        if work_type:
            query = query.eq("work_type", work_type)
        if date_from:
            query = query.gte("date", date_from.isoformat())
        if date_to:
            query = query.lte("date", date_to.isoformat())

        result = query.execute()
        return result.data

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing work entries: {str(e)}",
        )


@router.get("/{entry_id}", response_model=WorkEntryResponse)
async def get_work_entry(
    entry_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    """Get a specific work entry by ID."""
    try:
        client = get_supabase_client_with_token(current_user["access_token"])
        result = (
            client.table("work_entries")
            .select("*")
            .eq("id", str(entry_id))
            .eq("user_id", current_user["user_id"])
            .eq("is_deleted", False)
            .single()
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Work entry not found.",
            )

        return result.data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching work entry: {str(e)}",
        )


@router.post("/", response_model=WorkEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_work_entry(
    entry: WorkEntryCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new work entry."""
    try:
        client = get_supabase_client_with_token(current_user["access_token"])

        # Verify farmer belongs to current user
        farmer_check = (
            client.table("farmers")
            .select("id")
            .eq("id", str(entry.farmer_id))
            .eq("user_id", current_user["user_id"])
            .eq("is_deleted", False)
            .execute()
        )

        if not farmer_check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Farmer not found or does not belong to you.",
            )

        # Verify farm belongs to farmer (if provided)
        if entry.farm_id:
            farm_check = (
                client.table("farms")
                .select("id")
                .eq("id", str(entry.farm_id))
                .eq("farmer_id", str(entry.farmer_id))
                .eq("user_id", current_user["user_id"])
                .eq("is_deleted", False)
                .execute()
            )

            if not farm_check.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Farm not found or does not belong to this farmer.",
                )

        data = entry.model_dump(exclude_none=True)
        data["user_id"] = current_user["user_id"]
        data["farmer_id"] = str(entry.farmer_id)
        data["date"] = entry.date.isoformat()

        if entry.farm_id:
            data["farm_id"] = str(entry.farm_id)

        result = client.table("work_entries").insert(data).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create work entry.",
            )

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating work entry: {str(e)}",
        )


@router.put("/{entry_id}", response_model=WorkEntryResponse)
async def update_work_entry(
    entry_id: UUID,
    entry: WorkEntryUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update an existing work entry."""
    try:
        client = get_supabase_client_with_token(current_user["access_token"])
        data = entry.model_dump(exclude_none=True)

        if not data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update.",
            )

        # Convert types for Supabase
        if "farmer_id" in data:
            data["farmer_id"] = str(data["farmer_id"])
        if "farm_id" in data:
            data["farm_id"] = str(data["farm_id"])
        if "date" in data:
            data["date"] = data["date"].isoformat()

        result = (
            client.table("work_entries")
            .update(data)
            .eq("id", str(entry_id))
            .eq("user_id", current_user["user_id"])
            .eq("is_deleted", False)
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Work entry not found.",
            )

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating work entry: {str(e)}",
        )


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_work_entry(
    entry_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    """Soft delete a work entry (sets is_deleted = TRUE)."""
    try:
        client = get_supabase_client_with_token(current_user["access_token"])
        result = (
            client.table("work_entries")
            .update({"is_deleted": True})
            .eq("id", str(entry_id))
            .eq("user_id", current_user["user_id"])
            .eq("is_deleted", False)
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Work entry not found.",
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting work entry: {str(e)}",
        )
