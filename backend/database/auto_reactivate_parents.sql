-- 1. Update the anti-resurrection trigger to allow authorized reactivation
CREATE OR REPLACE FUNCTION prevent_stale_resurrection()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_deleted = true AND NEW.is_deleted = false THEN
    IF current_setting('tractorledger.authorized_reactivation', true) = 'true' THEN
      -- Authorized reactivation from a child trigger, allow it
      NULL;
    ELSE
      -- Stale client direct update, block undelete
      NEW.is_deleted := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- Apply to farmers
DROP TRIGGER IF EXISTS trg_prevent_stale_resurrection_farmers ON public.farmers;
CREATE TRIGGER trg_prevent_stale_resurrection_farmers
  BEFORE UPDATE ON public.farmers
  FOR EACH ROW
  EXECUTE FUNCTION prevent_stale_resurrection();

-- Apply to farms
DROP TRIGGER IF EXISTS trg_prevent_stale_resurrection_farms ON public.farms;
CREATE TRIGGER trg_prevent_stale_resurrection_farms
  BEFORE UPDATE ON public.farms
  FOR EACH ROW
  EXECUTE FUNCTION prevent_stale_resurrection();


-- 2. Create the child AFTER INSERT trigger
CREATE OR REPLACE FUNCTION auto_reactivate_parents()
RETURNS TRIGGER AS $$
BEGIN
  -- Set authorized flag
  PERFORM set_config('tractorledger.authorized_reactivation', 'true', true);

  -- If this is a farm, reactivate the farmer
  IF TG_TABLE_NAME = 'farms' THEN
    IF NEW.farmer_id IS NOT NULL THEN
      UPDATE public.farmers SET is_deleted = false WHERE id = NEW.farmer_id AND user_id = NEW.user_id AND is_deleted = true;
    END IF;
  END IF;

  -- If this is work or payment, reactivate the farmer
  IF TG_TABLE_NAME = 'work_entries' OR TG_TABLE_NAME = 'payments' THEN
    IF NEW.farmer_id IS NOT NULL THEN
      UPDATE public.farmers SET is_deleted = false WHERE id = NEW.farmer_id AND user_id = NEW.user_id AND is_deleted = true;
    END IF;
  END IF;

  -- If this is work, also reactivate the farm if farm_id is provided
  IF TG_TABLE_NAME = 'work_entries' THEN
    IF NEW.farm_id IS NOT NULL THEN
      UPDATE public.farms SET is_deleted = false WHERE id = NEW.farm_id AND user_id = NEW.user_id AND is_deleted = true;
    END IF;
  END IF;

  -- Reset authorized flag
  PERFORM set_config('tractorledger.authorized_reactivation', 'false', true);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ensure flag is reset on error
  PERFORM set_config('tractorledger.authorized_reactivation', 'false', true);
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- Apply AFTER INSERT to work_entries
DROP TRIGGER IF EXISTS trg_auto_reactivate_work ON public.work_entries;
CREATE TRIGGER trg_auto_reactivate_work
  AFTER INSERT ON public.work_entries
  FOR EACH ROW
  EXECUTE FUNCTION auto_reactivate_parents();

-- Apply AFTER INSERT to payments
DROP TRIGGER IF EXISTS trg_auto_reactivate_payments ON public.payments;
CREATE TRIGGER trg_auto_reactivate_payments
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION auto_reactivate_parents();

-- Apply AFTER INSERT to farms
DROP TRIGGER IF EXISTS trg_auto_reactivate_farms ON public.farms;
CREATE TRIGGER trg_auto_reactivate_farms
  AFTER INSERT ON public.farms
  FOR EACH ROW
  EXECUTE FUNCTION auto_reactivate_parents();
