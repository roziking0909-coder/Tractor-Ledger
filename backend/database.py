"""
Tractor Ledger - Database Client
Initializes Supabase clients (anon for user-context, service_role for admin).
"""

from supabase import create_client, Client
from config import get_settings


def get_supabase_client() -> Client:
    """Get Supabase client with anon key (respects RLS)."""
    settings = get_settings()
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)


def get_supabase_admin_client() -> Client:
    """Get Supabase client with service role key (bypasses RLS)."""
    settings = get_settings()
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def get_supabase_client_with_token(access_token: str) -> Client:
    """
    Get Supabase client authenticated with the user's JWT.
    This ensures RLS policies filter by the authenticated user.
    """
    settings = get_settings()
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    client.postgrest.auth(access_token)
    return client
