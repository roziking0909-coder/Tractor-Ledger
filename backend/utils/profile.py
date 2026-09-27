from fastapi import HTTPException, status
from database import get_supabase_admin_client

def ensure_user_profile(current_user: dict):
    """
    Ensure the public.users profile exists for the authenticated user.
    """
    user_id = str(current_user["user_id"])
    phone = current_user.get("phone")
    
    admin_client = get_supabase_admin_client()
    
    # 1. Use maybe_single() to check if row exists without throwing 406
    result = admin_client.table("users").select("id").eq("id", user_id).maybe_single().execute()
    
    if result.data:
        return  # Profile already exists
        
    # 2. Profile missing, safely provision
    # Since phone is NOT NULL, if we don't have it (e.g. Google Auth without phone),
    # we raise a specific error to force onboarding rather than inventing a fake number.
    if not phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number is required to complete user profile."
        )
        
    # 3. Safely provision profile using idempotent targeted upsert
    # Rely on DB defaults for subscription_status, wallet_balance, etc.
    # Never overwrite existing wallet/subscription fields.
    admin_client.table("users").upsert(
        {
            "id": user_id,
            "phone": phone,
        },
        on_conflict="id",
    ).execute()
