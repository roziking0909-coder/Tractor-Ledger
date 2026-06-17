"""
Tractor Ledger - Offline Sync Service
Handles bidirectional sync for the mobile app's offline-first architecture.

Flow:
1. Client sends all pending (locally created/modified) records since last sync.
2. Server upserts them and returns the delta (server-side changes since last_sync_at).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
from uuid import UUID

from routes.auth import get_current_user
from database import get_supabase_client_with_token

router = APIRouter(prefix="/sync", tags=["Sync"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class SyncFarmer(BaseModel):
    id: Optional[str] = None
    name: str
    mobile: Optional[str] = None
    village: Optional[str] = None
    notes: Optional[str] = None
    is_deleted: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class SyncFarm(BaseModel):
    id: Optional[str] = None
    farmer_id: str
    name: str
    location: Optional[str] = None
    area_acres: Optional[float] = None
    notes: Optional[str] = None
    is_deleted: bool = False
    created_at: Optional[str] = None


class SyncWorkEntry(BaseModel):
    id: Optional[str] = None
    farmer_id: str
    farm_id: Optional[str] = None
    date: str
    work_type: str
    quantity: float
    quantity_unit: str
    rate: float
    total_amount: float
    notes: Optional[str] = None
    whatsapp_sent: bool = False
    is_deleted: bool = False
    created_at: Optional[str] = None


class SyncPayment(BaseModel):
    id: Optional[str] = None
    farmer_id: str
    amount: float
    payment_date: str
    notes: Optional[str] = None
    whatsapp_sent: bool = False
    is_deleted: bool = False
    created_at: Optional[str] = None


class SyncRequest(BaseModel):
    """Request payload for sync endpoint."""
    last_sync_at: Optional[str] = Field(
        None,
        description="ISO timestamp of last successful sync. Null for first sync.",
    )
    farmers: list[SyncFarmer] = []
    farms: list[SyncFarm] = []
    work_entries: list[SyncWorkEntry] = []
    payments: list[SyncPayment] = []


class SyncResponse(BaseModel):
    """Response payload with server-side delta."""
    sync_timestamp: str = Field(..., description="Server timestamp for this sync")
    farmers: list[dict] = []
    farms: list[dict] = []
    work_entries: list[dict] = []
    payments: list[dict] = []
    conflicts: list[dict] = Field(
        default=[],
        description="Records that had conflicts (server wins, client copy returned)",
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _prepare_record(record: dict, user_id: str, table: str) -> dict:
    """Prepare a record for upsert by adding user_id and cleaning fields."""
    data = {k: v for k, v in record.items() if v is not None}
    data["user_id"] = user_id
    return data


async def _upsert_records(
    client,
    table: str,
    records: list,
    user_id: str,
) -> tuple[list[dict], list[dict]]:
    """
    Upsert a list of records into a table.
    Returns (upserted_records, conflicts).
    """
    upserted = []
    conflicts = []

    for record in records:
        data = _prepare_record(record.model_dump(), user_id, table)

        try:
            result = (
                client.table(table)
                .upsert(data, on_conflict="id")
                .execute()
            )
            if result.data:
                upserted.extend(result.data)
        except Exception as e:
            conflicts.append({
                "table": table,
                "record": data,
                "error": str(e),
            })

    return upserted, conflicts


async def _fetch_delta(
    client,
    table: str,
    user_id: str,
    last_sync_at: Optional[str],
) -> list[dict]:
    """Fetch records modified since last_sync_at for this user."""
    query = (
        client.table(table)
        .select("*")
        .eq("user_id", user_id)
    )

    if last_sync_at:
        query = query.gt("created_at", last_sync_at)

    result = query.execute()
    return result.data or []


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/", response_model=SyncResponse)
async def sync_data(
    request: SyncRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Bidirectional sync endpoint for offline-first mobile app.

    1. Receives pending records from client.
    2. Upserts them into Supabase (server wins on conflict).
    3. Returns all records modified since client's last_sync_at.
    """
    try:
        client = get_supabase_client_with_token(current_user["access_token"])
        user_id = current_user["user_id"]
        all_conflicts = []

        # ---- Phase 1: Upsert client records ----

        if request.farmers:
            _, conflicts = await _upsert_records(
                client, "farmers", request.farmers, user_id
            )
            all_conflicts.extend(conflicts)

        if request.farms:
            _, conflicts = await _upsert_records(
                client, "farms", request.farms, user_id
            )
            all_conflicts.extend(conflicts)

        if request.work_entries:
            _, conflicts = await _upsert_records(
                client, "work_entries", request.work_entries, user_id
            )
            all_conflicts.extend(conflicts)

        if request.payments:
            _, conflicts = await _upsert_records(
                client, "payments", request.payments, user_id
            )
            all_conflicts.extend(conflicts)

        # ---- Phase 2: Fetch server delta ----

        sync_timestamp = datetime.now(timezone.utc).isoformat()

        delta_farmers = await _fetch_delta(
            client, "farmers", user_id, request.last_sync_at
        )
        delta_farms = await _fetch_delta(
            client, "farms", user_id, request.last_sync_at
        )
        delta_work_entries = await _fetch_delta(
            client, "work_entries", user_id, request.last_sync_at
        )
        delta_payments = await _fetch_delta(
            client, "payments", user_id, request.last_sync_at
        )

        return SyncResponse(
            sync_timestamp=sync_timestamp,
            farmers=delta_farmers,
            farms=delta_farms,
            work_entries=delta_work_entries,
            payments=delta_payments,
            conflicts=all_conflicts,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sync error: {str(e)}",
        )
