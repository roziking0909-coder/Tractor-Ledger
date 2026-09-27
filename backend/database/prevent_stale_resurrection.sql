-- Create the trigger function
CREATE OR REPLACE FUNCTION prevent_stale_resurrection()
RETURNS TRIGGER AS $$
BEGIN
  -- If the record is already deleted in the cloud,
  -- and a stale client tries to update it with is_deleted = false,
  -- we force it to remain deleted.
  IF OLD.is_deleted = true AND NEW.is_deleted = false THEN
    NEW.is_deleted := true;
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
