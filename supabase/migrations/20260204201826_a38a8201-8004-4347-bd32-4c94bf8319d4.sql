-- Atualizar a função check_order_completion para mover pedido para buffer automaticamente
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
BEGIN
  SELECT 
    COUNT(*),
    SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END),
    COUNT(DISTINCT assigned_sector_id)
  INTO v_total, v_ready, v_sectors
  FROM order_items
  WHERE order_id = p_order_id;
  
  IF v_total = v_ready THEN
    -- Quando todos os itens estão prontos, mover pedido para buffer automaticamente
    UPDATE orders
    SET 
      all_items_ready = true,
      mixed_origin = (v_sectors > 1),
      status = 'waiting_buffer',
      ready_at = NOW()
    WHERE id = p_order_id
      AND status = 'pending';  -- Só atualiza se ainda estava pendente
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$function$;