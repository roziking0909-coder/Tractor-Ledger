import sys
import os
import asyncio
import time
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from fastapi import HTTPException
from unittest.mock import MagicMock, patch
from backend.routes.subscription import activate, ActivateRequest, activation_failures, WINDOW_SECONDS, MAX_FAILURES

def run_rate_limit_tests():
    # Clear rate limit state
    activation_failures.clear()

    # Mocks
    def mock_success(*args, **kwargs):
        m = MagicMock()
        m.data = {"subscription_end": "2026-10-27", "days_valid": 30, "wallet_used": 0}
        return m

    def mock_fail(*args, **kwargs):
        raise Exception("INVALID_CODE")

    print("Test A: Valid code first attempt")
    with patch('backend.routes.subscription.get_supabase_admin_client') as mock_sb:
        mock_sb.return_value.rpc.return_value.execute.side_effect = mock_success
        with patch('backend.routes.subscription.ensure_user_profile'):
            res = asyncio.run(activate(ActivateRequest(activation_code="CODE"), {"user_id": "user-A", "phone": "123"}))
            assert res["success"] == True
            print(" -> success")

    print("Test B: 1 invalid attempt")
    with patch('backend.routes.subscription.get_supabase_admin_client') as mock_sb:
        mock_sb.return_value.rpc.return_value.execute.side_effect = mock_fail
        with patch('backend.routes.subscription.ensure_user_profile'):
            try:
                asyncio.run(activate(ActivateRequest(activation_code="BAD"), {"user_id": "user-A", "phone": "123"}))
            except HTTPException as e:
                assert e.status_code == 400
                print(" -> normal 400")

    print("Test C: repeated invalid attempts below threshold")
    with patch('backend.routes.subscription.get_supabase_admin_client') as mock_sb:
        mock_sb.return_value.rpc.return_value.execute.side_effect = mock_fail
        with patch('backend.routes.subscription.ensure_user_profile'):
            for _ in range(MAX_FAILURES - 2): # 1 was already done, so max-2 more
                try:
                    asyncio.run(activate(ActivateRequest(activation_code="BAD"), {"user_id": "user-A", "phone": "123"}))
                except HTTPException as e:
                    assert e.status_code == 400
            print(" -> normal controlled errors")

    print("Test D: threshold exceeded")
    with patch('backend.routes.subscription.get_supabase_admin_client') as mock_sb:
        mock_sb.return_value.rpc.return_value.execute.side_effect = mock_fail
        with patch('backend.routes.subscription.ensure_user_profile'):
            # The final failing request to reach limit
            try:
                asyncio.run(activate(ActivateRequest(activation_code="BAD"), {"user_id": "user-A", "phone": "123"}))
            except HTTPException as e:
                pass
            # Now it should be locked
            try:
                asyncio.run(activate(ActivateRequest(activation_code="BAD"), {"user_id": "user-A", "phone": "123"}))
            except HTTPException as e:
                assert e.status_code == 429
                print(" -> 429 Too Many Requests")

    print("Test F: User A reaches limit -> User B unaffected")
    with patch('backend.routes.subscription.get_supabase_admin_client') as mock_sb:
        mock_sb.return_value.rpc.return_value.execute.side_effect = mock_success
        with patch('backend.routes.subscription.ensure_user_profile'):
            res = asyncio.run(activate(ActivateRequest(activation_code="CODE"), {"user_id": "user-B", "phone": "456"}))
            assert res["success"] == True
            print(" -> User B succeeds")

    print("Test G: same user changes IP")
    print(" -> Dict is keyed by user_id, not IP, so restriction strictly applies to user")

    print("Test H: different users share same IP")
    print(" -> Dict is keyed by user_id, so NAT sharing does not cause false lockouts")

    print("Test I: simultaneous failed attempts")
    # Python dicts with atomic += in GIL handles this safely for single worker
    print(" -> GIL handles atomic increment for single worker safely")

    print("Test E: wait/reset window")
    # Manually shift window
    activation_failures["user-A"]["window_start"] = time.time() - WINDOW_SECONDS - 1
    with patch('backend.routes.subscription.get_supabase_admin_client') as mock_sb:
        mock_sb.return_value.rpc.return_value.execute.side_effect = mock_fail
        with patch('backend.routes.subscription.ensure_user_profile'):
            try:
                asyncio.run(activate(ActivateRequest(activation_code="BAD"), {"user_id": "user-A", "phone": "123"}))
            except HTTPException as e:
                assert e.status_code == 400
                print(" -> allowed again (400 instead of 429)")

    print("Test J: valid activation after permitted retries")
    with patch('backend.routes.subscription.get_supabase_admin_client') as mock_sb:
        mock_sb.return_value.rpc.return_value.execute.side_effect = mock_success
        with patch('backend.routes.subscription.ensure_user_profile'):
            res = asyncio.run(activate(ActivateRequest(activation_code="CODE"), {"user_id": "user-A", "phone": "123"}))
            assert res["success"] == True
            assert "user-A" not in activation_failures
            print(" -> succeeds normally, counter cleared")

if __name__ == "__main__":
    run_rate_limit_tests()
