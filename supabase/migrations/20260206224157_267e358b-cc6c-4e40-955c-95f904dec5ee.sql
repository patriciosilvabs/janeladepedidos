
-- Remove the pending redistribution column
ALTER TABLE public.app_settings DROP COLUMN IF EXISTS pending_redistribution_minutes;

-- Drop the stale pending redistribution function
DROP FUNCTION IF EXISTS public.redistribute_stale_pending_items();
