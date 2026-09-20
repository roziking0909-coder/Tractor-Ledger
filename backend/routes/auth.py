"""
Tractor Ledger - Auth Routes
Handles OTP verification, user profile, and JWT-based authentication.
"""

from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
import jwt

from config import get_settings
from database import get_supabase_client, get_supabase_admin_client

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class VerifyOTPRequest(BaseModel):
    """Request body for OTP verification."""
    phone: str = Field(..., description="Phone number with country code, e.g. +919876543210")
    token: str = Field(..., description="6-digit OTP token")


class AuthResponse(BaseModel):
    """Response after successful authentication."""
    access_token: str
    refresh_token: str
    user_id: str
    phone: str


class UserProfile(BaseModel):
    """User profile schema."""
    id: UUID
    phone: str
    name: Optional[str] = None
    created_at: Optional[str] = None


class ProfileUpdateRequest(BaseModel):
    """Request body for updating user profile."""
    name: str = Field(..., min_length=1, max_length=200, description="User's display name")


# ---------------------------------------------------------------------------
# JWT Dependency
# ---------------------------------------------------------------------------

async def get_current_user(authorization: str = Header(..., description="Bearer <JWT>")) -> dict:
    """
    Extract and verify the Supabase JWT from the Authorization header.
    Returns a dict with 'user_id' (UUID string) and 'access_token'.
    """
    settings = get_settings()

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Expected: Bearer <token>",
        )

    token = authorization[7:]  # Strip "Bearer "

    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please login again.",
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing 'sub' claim.",
        )

    return {
        "user_id": user_id,
        "access_token": token,
        "email": payload.get("email"),
        "phone": payload.get("phone"),
        "role": payload.get("role"),
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/verify-otp", response_model=AuthResponse)
async def verify_otp(request: VerifyOTPRequest):
    """
    Verify OTP sent to phone number via Supabase Auth.
    Returns access_token and refresh_token on success.
    """
    try:
        client = get_supabase_client()
        response = client.auth.verify_otp({
            "phone": request.phone,
            "token": request.token,
            "type": "sms",
        })

        if not response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="OTP verification failed. Invalid or expired token.",
            )

        session = response.session
        user = response.user

        # Upsert user record in our users table
        admin_client = get_supabase_admin_client()
        admin_client.table("users").upsert({
            "id": str(user.id),
            "phone": request.phone,
        }, on_conflict="id").execute()

        return AuthResponse(
            access_token=session.access_token,
            refresh_token=session.refresh_token,
            user_id=str(user.id),
            phone=request.phone,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OTP verification error: {str(e)}",
        )


@router.get("/me", response_model=UserProfile)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get the currently authenticated user's profile."""
    try:
        admin_client = get_supabase_admin_client()
        result = (
            admin_client.table("users")
            .select("*")
            .eq("id", current_user["user_id"])
            .single()
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found.",
            )

        return UserProfile(**result.data)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching profile: {str(e)}",
        )


@router.put("/profile", response_model=UserProfile)
async def update_profile(
    request: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update the authenticated user's profile name."""
    try:
        admin_client = get_supabase_admin_client()
        result = (
            admin_client.table("users")
            .update({"name": request.name})
            .eq("id", current_user["user_id"])
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )

        return UserProfile(**result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating profile: {str(e)}",
        )
