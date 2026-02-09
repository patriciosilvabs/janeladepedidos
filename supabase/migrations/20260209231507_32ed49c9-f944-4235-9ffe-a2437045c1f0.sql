
CREATE OR REPLACE FUNCTION public.check_order_completion(p_order_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total integer;
  v_ready integer;
  v_sectors integer;
  v_order_type text;
  v_new_status text;
BEGIN
  SELECT 
    COUNT(*),
    SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END),
    COUNT(DISTINCT assigned_sector_id)
  INTO v_total, v_ready, v_sectors
  FROM order_items
  WHERE order_id = p_order_id;
  
  IF v_total = v_ready THEN
    -- Consulta o tipo do pedido
    SELECT COALESCE(order_type, 'delivery')
    INTO v_order_type
    FROM orders
    WHERE id = p_order_id;

    -- Delivery (ou NULL) vai pro buffer; outros vão direto pra ready
    IF v_order_type = 'delivery' THEN
      v_new_status := 'waiting_buffer';
    ELSE
      v_new_status := 'ready';
    END IF;

    UPDATE orders
    SET 
      all_items_ready = true,
      mixed_origin = (v_sectors > 1),
      status = v_new_status,
      ready_at = NOW()
    WHERE id = p_order_id
      AND status = 'pending';
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$function$;
