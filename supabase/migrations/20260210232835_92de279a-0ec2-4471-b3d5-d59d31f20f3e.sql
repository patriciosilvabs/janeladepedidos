
-- Fix: redistribute_offline_sector_items must NOT redistribute items from the edge sector
-- Items in BORDAS need to stay there until an operator processes them
CREATE OR REPLACE FUNCTION public.redistribute_offline_sector_items(p_offline_sector_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_available_sectors uuid[];
  v_sector_count integer;
  v_item record;
  v_target_sector uuid;
  v_updated integer := 0;
  v_edge_sector_id uuid;
BEGIN
  -- Get edge sector ID
  SELECT kds_edge_sector_id INTO v_edge_sector_id
  FROM app_settings WHERE id = 'default';

  -- If the offline sector IS the edge sector, do NOT redistribute
  -- Edge items must wait for the edge operator to come back online
  IF v_edge_sector_id IS NOT NULL AND p_offline_sector_id = v_edge_sector_id THEN
    RETURN 0;
  END IF;

  -- Buscar setores com operadores online (exceto o offline e edge sector)
  SELECT ARRAY_AGG(DISTINCT s.id)
  INTO v_available_sectors
  FROM sectors s
  JOIN sector_presence sp ON sp.sector_id = s.id
  WHERE s.view_type = 'kds'
    AND s.id != p_offline_sector_id
    AND (v_edge_sector_id IS NULL OR s.id != v_edge_sector_id)
    AND sp.is_online = true
    AND sp.last_seen_at > NOW() - INTERVAL '30 seconds';
  
  v_sector_count := COALESCE(array_length(v_available_sectors, 1), 0);
  
  IF v_sector_count = 0 THEN
    RETURN 0;
  END IF;
  
  -- Redistribuir itens pendentes do setor offline
  -- Exclude items with next_sector_id set (they're in a special routing flow)
  FOR v_item IN 
    SELECT id FROM order_items 
    WHERE assigned_sector_id = p_offline_sector_id
      AND status = 'pending'
      AND next_sector_id IS NULL
    ORDER BY created_at
  LOOP
    v_target_sector := get_least_loaded_sector(v_available_sectors);
    
    UPDATE order_items 
    SET assigned_sector_id = v_target_sector
    WHERE id = v_item.id;
    
    v_updated := v_updated + 1;
  END LOOP;
  
  RETURN v_updated;
END;
$function$;
