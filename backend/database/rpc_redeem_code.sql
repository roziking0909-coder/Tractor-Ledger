CREATE OR REPLACE FUNCTION public.redeem_activation_code(
  p_user_id UUID,
  p_code TEXT
) RETURNS json AS $$
DECLARE
  v_code_row RECORD;
  v_user_row RECORD;
  v_base_date DATE;
  v_new_end_date DATE;
  v_new_start_date DATE;
  v_wallet_used DECIMAL(10,2);
BEGIN
  -- 1. Lock the activation code row
  SELECT * INTO v_code_row
  FROM public.activation_codes
  WHERE code = p_code
  FOR UPDATE;

  -- 2. Verify code exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_CODE';
  END IF;

  -- 3. Verify not already used
  IF v_code_row.is_used THEN
    RAISE EXCEPTION 'CODE_ALREADY_USED';
  END IF;

  -- 3.5 Verify not expired
  IF v_code_row.code_expires_at IS NOT NULL AND v_code_row.code_expires_at <= NOW() THEN
    RAISE EXCEPTION 'CODE_EXPIRED';
  END IF;

  -- 4. Lock User row and Validate Phone
  SELECT phone, subscription_status, subscription_start, subscription_end, wallet_balance 
  INTO v_user_row
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;

  IF v_code_row.created_for_phone IS NOT NULL AND v_code_row.created_for_phone != v_user_row.phone THEN
    RAISE EXCEPTION 'PHONE_MISMATCH';
  END IF;

  -- 5. Calculate extension and start date semantics
  IF v_user_row.subscription_end IS NULL OR v_user_row.subscription_end < CURRENT_DATE THEN
    v_base_date := CURRENT_DATE;
    v_new_start_date := CURRENT_DATE;
  ELSE
    v_base_date := v_user_row.subscription_end;
    v_new_start_date := v_user_row.subscription_start;
  END IF;

  v_new_end_date := v_base_date + (COALESCE(v_code_row.valid_days, 365) || ' days')::interval;
  v_wallet_used := COALESCE(v_user_row.wallet_balance, 0);

  -- 6. Update user subscription and reset wallet
  UPDATE public.users
  SET subscription_status = 'active',
      subscription_start = v_new_start_date,
      subscription_end = v_new_end_date,
      wallet_balance = 0
  WHERE id = p_user_id;

  -- 7. Insert wallet transaction ATOMICALLY if wallet balance was used
  IF v_wallet_used > 0 THEN
    INSERT INTO public.wallet_transactions (user_id, type, amount, description, balance_after)
    VALUES (
      p_user_id, 
      'debit', 
      v_wallet_used, 
      'સબ્સ્ક્રિપ્શન નવીનીકરણ પર ₹' || TRUNC(v_wallet_used)::TEXT || ' વાપર્યા', 
      0
    );
  END IF;

  -- 8. Mark activation code as used
  UPDATE public.activation_codes
  SET is_used = TRUE,
      used_by_user_id = p_user_id,
      used_at = NOW()
  WHERE id = v_code_row.id;

  -- 9. Return success data
  RETURN json_build_object(
    'success', true,
    'subscription_end', v_new_end_date,
    'days_valid', COALESCE(v_code_row.valid_days, 365),
    'wallet_used', v_wallet_used
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Revoke execute from public/anon/authenticated to prevent direct escalation
REVOKE EXECUTE ON FUNCTION public.redeem_activation_code(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.redeem_activation_code(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.redeem_activation_code(UUID, TEXT) FROM authenticated;

-- Grant execution explicitly to service_role (backend)
GRANT EXECUTE ON FUNCTION public.redeem_activation_code(UUID, TEXT) TO service_role;
