"""
Tractor Ledger - Work Entry Pydantic Schemas
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from uuid import UUID
from datetime import date as DateType, datetime


WorkType = Literal[
    "Ploughing", "Rotavator", "Seeding", "Cultivation", "Harvesting", "Other"
]
QuantityUnit = Literal["hours", "acres"]


class WorkEntryCreate(BaseModel):
    """Schema for creating a new work entry."""
    farmer_id: UUID = Field(..., description="Associated farmer ID")
    farm_name: Optional[str] = Field(None, description="Name of the farm")
    date: DateType = Field(..., description="Date of work performed")
    work_type: WorkType = Field(..., description="Type of work performed")
    quantity: float = Field(..., gt=0, description="Amount of work done")
    quantity_unit: QuantityUnit = Field(..., description="Unit of quantity: hours or acres")
    rate: float = Field(..., ge=0, description="Rate per unit")
    total_amount: float = Field(..., ge=0, description="Total amount for this entry")
    notes: Optional[str] = Field(None, max_length=1000, description="Additional notes")
    whatsapp_sent: bool = Field(False, description="Whether WhatsApp notification was sent")


class WorkEntryUpdate(BaseModel):
    """Schema for updating a work entry. All fields optional."""
    farmer_id: Optional[UUID] = None
    farm_name: Optional[str] = None
    date: Optional[DateType] = None
    work_type: Optional[WorkType] = None
    quantity: Optional[float] = Field(None, gt=0)
    quantity_unit: Optional[QuantityUnit] = None
    rate: Optional[float] = Field(None, ge=0)
    total_amount: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=1000)
    whatsapp_sent: Optional[bool] = None


class WorkEntryResponse(BaseModel):
    """Schema for work entry response."""
    id: UUID
    user_id: UUID
    farmer_id: UUID
    farm_name: Optional[str] = None
    date: DateType
    work_type: str
    quantity: float
    quantity_unit: str
    rate: float
    total_amount: float
    notes: Optional[str] = None
    whatsapp_sent: bool = False
    created_at: datetime
    is_deleted: bool = False

    model_config = {"from_attributes": True}
