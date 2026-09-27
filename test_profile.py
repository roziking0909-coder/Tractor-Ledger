import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from fastapi import HTTPException
from unittest.mock import MagicMock, patch
from backend.utils.profile import ensure_user_profile

def test_ensure_profile_existing():
    mock_client = MagicMock()
    mock_client.table().select().eq().maybe_single().execute().data = {"id": "123"}
    
    with patch('backend.utils.profile.get_supabase_admin_client', return_value=mock_client):
        ensure_user_profile({"user_id": "123", "phone": "12345"})
        # Assert no upsert was called
        mock_client.table().upsert.assert_not_called()

def test_ensure_profile_missing():
    mock_client = MagicMock()
    # Mock maybe_single() returning empty data
    mock_client.table().select().eq().maybe_single().execute().data = None
    
    with patch('backend.utils.profile.get_supabase_admin_client', return_value=mock_client):
        ensure_user_profile({"user_id": "456", "phone": "999"})
        # Assert upsert was called with id, phone and on_conflict='id'
        mock_client.table().upsert.assert_called_once_with(
            {"id": "456", "phone": "999"},
            on_conflict="id"
        )

def test_ensure_profile_no_phone():
    mock_client = MagicMock()
    mock_client.table().select().eq().maybe_single().execute().data = None
    
    with patch('backend.utils.profile.get_supabase_admin_client', return_value=mock_client):
        try:
            ensure_user_profile({"user_id": "789", "phone": None})
            assert False, "Should have raised HTTPException"
        except HTTPException as e:
            assert e.status_code == 400
            assert "Phone number is required" in e.detail

def test_genuine_db_error():
    mock_client = MagicMock()
    # Mock a genuine exception
    mock_client.table().select().eq().maybe_single().execute.side_effect = Exception("Real network error")
    
    with patch('backend.utils.profile.get_supabase_admin_client', return_value=mock_client):
        try:
            ensure_user_profile({"user_id": "err", "phone": "111"})
            assert False, "Should have bubbled up exception"
        except Exception as e:
            assert str(e) == "Real network error"
            
if __name__ == "__main__":
    test_ensure_profile_existing()
    test_ensure_profile_missing()
    test_ensure_profile_no_phone()
    test_genuine_db_error()
    print("ALL MOCK TESTS PASSED")
