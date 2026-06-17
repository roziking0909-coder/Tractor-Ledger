"""
Tractor Ledger - Farmer Pydantic Schemas
"""

from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class FarmerCreate(BaseModel):
    """Schema for creating a new farmer."""
    name: str = Field(..., min_length=1, max_length=200, description="Farmer's full name")
    mobile: Optional[str] = Field(None, max_length=15, description="Mobile number")
    village: Optional[str] = Field(None, max_length=200, description="Village name")
    notes: Optional[str] = Field(None, max_length=1000, description="Additional notes")


class FarmerUpdate(BaseModel):
    """Schema for updating a farmer. All fields optional."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    mobile: Optional[str] = Field(None, max_length=15)
    village: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = Field(None, max_length=1000)


class FarmerResponse(BaseModel):
    """Schema for farmer response."""
    id: UUID
    user_id: UUID
    name: str
    mobile: Optional[str] = None
    village: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_deleted: bool = False

    model_config = {"from_attributes": True}


class FarmerWithDues(BaseModel):
    """Schema for farmer with dues summary (from farmer_dues view)."""
    farmer_id: UUID
    user_id: UUID
    farmer_name: str
    mobile: Optional[str] = None
    village: Optional[str] = None
    total_work_amount: float = 0.0
    total_paid: float = 0.0
    remaining_due: float = 0.0

    model_config = {"from_attributes": True}

    @property
    def total_work_amount_formatted(self) -> str:
        return format_indian_currency(self.total_work_amount)

    @property
    def total_paid_formatted(self) -> str:
        return format_indian_currency(self.total_paid)

    @property
    def remaining_due_formatted(self) -> str:
        return format_indian_currency(self.remaining_due)


def format_indian_currency(amount: float) -> str:
    """Format amount in Indian currency style: ₹1,23,456.00"""
    if amount < 0:
        return f"-{format_indian_currency(-amount)}"

    amount_str = f"{amount:.2f}"
    integer_part, decimal_part = amount_str.split(".")

    if len(integer_part) <= 3:
        return f"₹{integer_part}.{decimal_part}"

    # Last 3 digits
    last_three = integer_part[-3:]
    remaining = integer_part[:-3]

    # Group remaining digits in pairs from right
    groups = []
    while remaining:
        groups.insert(0, remaining[-2:])
        remaining = remaining[:-2]

    formatted = ",".join(groups) + "," + last_three
    return f"₹{formatted}.{decimal_part}"
