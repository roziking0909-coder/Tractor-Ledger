"""
Tractor Ledger - Payment Pydantic Schemas
"""

from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime, date as DateType


class PaymentCreate(BaseModel):
    """Schema for recording a new payment."""
    farmer_id: UUID = Field(..., description="Farmer who made the payment")
    amount: float = Field(..., gt=0, description="Payment amount")
    payment_date: DateType = Field(..., description="Date payment was received")
    notes: Optional[str] = Field(None, max_length=1000, description="Payment notes")
    whatsapp_sent: bool = Field(False, description="Whether WhatsApp notification was sent")


class PaymentUpdate(BaseModel):
    """Schema for updating a payment. All fields optional."""
    farmer_id: Optional[UUID] = None
    amount: Optional[float] = Field(None, gt=0)
    payment_date: Optional[DateType] = None
    notes: Optional[str] = Field(None, max_length=1000)
    whatsapp_sent: Optional[bool] = None


class PaymentResponse(BaseModel):
    """Schema for payment response."""
    id: UUID
    user_id: UUID
    farmer_id: UUID
    amount: float
    payment_date: DateType
    notes: Optional[str] = None
    whatsapp_sent: bool = False
    created_at: datetime
    is_deleted: bool = False

    model_config = {"from_attributes": True}
