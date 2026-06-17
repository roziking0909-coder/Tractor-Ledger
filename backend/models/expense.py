"""
Tractor Ledger - Expense Pydantic Schemas
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import date as DateType, datetime
from uuid import UUID

ExpenseType = Literal['diesel', 'engine_oil', 'repair', 'driver_wages', 'other']


class ExpenseCreate(BaseModel):
    """Schema for creating an expense."""
    date: DateType = Field(..., description="Date of expense")
    expense_type: ExpenseType = Field(..., description="Type of expense")
    custom_type: Optional[str] = Field(None, description="Custom type name when expense_type is 'other'")
    amount: float = Field(..., gt=0, description="Expense amount")
    quantity: Optional[float] = Field(None, description="Quantity (e.g. liters of diesel)")
    unit: Optional[str] = Field(None, description="Unit (e.g. liters)")
    rate: Optional[float] = Field(None, description="Rate per unit")
    notes: Optional[str] = Field(None, max_length=1000, description="Additional notes")


class ExpenseUpdate(BaseModel):
    """Schema for updating an expense."""
    date: Optional[DateType] = None
    expense_type: Optional[ExpenseType] = None
    custom_type: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)
    quantity: Optional[float] = None
    unit: Optional[str] = None
    rate: Optional[float] = None
    notes: Optional[str] = Field(None, max_length=1000)


class ExpenseResponse(BaseModel):
    """Schema for expense response."""
    id: UUID
    user_id: UUID
    date: DateType
    expense_type: str
    custom_type: Optional[str] = None
    amount: float
    quantity: Optional[float] = None
    unit: Optional[str] = None
    rate: Optional[float] = None
    notes: Optional[str] = None
    created_at: datetime
    is_deleted: bool = False

    model_config = {"from_attributes": True}
