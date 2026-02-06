
-- Add pending_redistribution_minutes to app_settings
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS pending_redistribution_minutes integer DEFAULT 3;

-- Create function to redistribute stale pending items
CREATE OR REPLACE FUNCTION public.redistribute_stale_pending_items(p_timeout_minutes integer DEFAULT 3)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item record;
  v_available_sectors uuid[];
  v_target_sector uuid;
  v_current_sector_online boolean;
  v_updated integer := 0;
  v_edge_sector_id uuid;
BEGIN
  -- Get edge sector to exclude from redistribution
  SELECT kds_edge_sector_id INTO v_edge_sector_id
  FROM app_settings WHERE id = 'default';

  -- Find pending items older than timeout
  FOR v_item IN
    SELECT oi.id, oi.assigned_sector_id
    FROM order_items oi
    WHERE oi.status = 'pending'
      AND oi.created_at < NOW() - (p_timeout_minutes || ' minutes')::interval
      AND oi.assigned_sector_id IS NOT NULL
      -- Exclude edge sector items (they follow a special flow)
      AND (v_edge_sector_id IS NULL OR oi.assigned_sector_id != v_edge_sector_id)
    ORDER BY oi.created_at
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Check if current sector has online operators
    SELECT EXISTS(
      SELECT 1 FROM sector_presence sp
      WHERE sp.sector_id = v_item.assigned_sector_id
        AND sp.is_online = true
        AND sp.last_seen_at > NOW() - INTERVAL '30 seconds'
    ) INTO v_current_sector_online;

    -- Only redistribute if current sector IS online but item is stuck
    -- (offline sectors are handled by existing redistribute_offline_sector_items)
    IF v_current_sector_online THEN
      -- Find other online sectors (excluding current and edge sector)
      SELECT ARRAY_AGG(DISTINCT s.id)
      INTO v_available_sectors
      FROM sectors s
      JOIN sector_presence sp ON sp.sector_id = s.id
      WHERE s.view_type = 'kds'
        AND s.id != v_item.assigned_sector_id
        AND (v_edge_sector_id IS NULL OR s.id != v_edge_sector_id)
        AND sp.is_online = true
        AND sp.last_seen_at > NOW() - INTERVAL '30 seconds';

      IF v_available_sectors IS NOT NULL AND array_length(v_available_sectors, 1) > 0 THEN
        v_target_sector := get_least_loaded_sector(v_available_sectors);

        IF v_target_sector IS NOT NULL THEN
          UPDATE order_items
          SET assigned_sector_id = v_target_sector
          WHERE id = v_item.id;

          v_updated := v_updated + 1;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN v_updated;
END;
$function$;
