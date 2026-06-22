"""
Tractor Ledger - Auth Routes
Handles OTP verification, user profile, and JWT-based authentication.
"""

from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
import jwt
import requests

from config import get_settings
from database import get_supabase_client, get_supabase_admin_client

router = APIRouter(prefix="/auth", tags=["Authentication"])


class VerifyOTPRequest(BaseModel):
    phone: str = Field(..., description="Phone number with country code, e.g. +919876543210")
    token: str = Field(..., description="6-digit OTP token")


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    user_id: str
    phone: str


class UserProfile(BaseModel):
    id: UUID
    phone: str
    name: Optional[str] = None
    created_at: Optional[str] = None


class ProfileUpdateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


# Cache JWKS public key so we don't fetch it on every request
_cached_jwks_key = None


async def get_current_user(authorization: str = Header(..., description="Bearer <JWT>")) -> dict:
    """
    Extract and verify the Supabase JWT from the Authorization header.
    Supports both HS256 (legacy) and ES256 (current Supabase default).
    """
    global _cached_jwks_key
    settings = get_settings()

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Expected: Bearer <token>",
        )

    token = authorization[7:]

    # Read the JWT header to detect algorithm
    unverified = jwt.get_unverified_header(token)
    alg = unverified.get("alg", "HS256")

    try:
        if alg == "HS256":
            # Legacy: verify with shared JWT secret
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
        else:
            # ES256: fetch public key from Supabase JWKS endpoint
            if _cached_jwks_key is None:
                jwks_url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
                jwks_response = requests.get(jwks_url, timeout=10)
                jwks_response.raise_for_status()
                jwks = jwks_response.json()
                if not jwks.get("keys"):
                    raise HTTPException(status_code=500, detail="No keys found in Supabase JWKS")
                _cached_jwks_key = jwt.algorithms.ECAlgorithm.from_jwk(jwks["keys"][0])

            payload = jwt.decode(
                token,
                _cached_jwks_key,
                algorithms=["ES256"],
                audience="authenticated",
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please login again.",
        )
    except jwt.InvalidTokenError as e:
        # Clear cached key in case it's stale
        _cached_jwks_key = None
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


@router.post("/verify-otp", response_model=AuthResponse)
async def verify_otp(request: VerifyOTPRequest):
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