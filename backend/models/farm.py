"""
Tractor Ledger - Farm Pydantic Schemas
"""

from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class FarmCreate(BaseModel):
    """Schema for creating a new farm."""
    farmer_id: UUID = Field(..., description="Associated farmer ID")
    name: str = Field(..., min_length=1, max_length=200, description="Farm name or identifier")
    location: Optional[str] = Field(None, max_length=500, description="Farm location/address")
    area_acres: Optional[float] = Field(None, ge=0, description="Farm area in acres")
    notes: Optional[str] = Field(None, max_length=1000, description="Additional notes")


class FarmUpdate(BaseModel):
    """Schema for updating a farm. All fields optional."""
    farmer_id: Optional[UUID] = None
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    location: Optional[str] = Field(None, max_length=500)
    area_acres: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=1000)


class FarmResponse(BaseModel):
    """Schema for farm response."""
    id: UUID
    farmer_id: UUID
    user_id: UUID
    name: str
    location: Optional[str] = None
    area_acres: Optional[float] = None
    notes: Optional[str] = None
    created_at: datetime
    is_deleted: bool = False

    model_config = {"from_attributes": True}
