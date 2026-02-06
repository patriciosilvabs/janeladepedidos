
-- Add 'cancelled' to item_status enum
ALTER TYPE item_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Create function to cancel all items of an order and mark order as cancelled
CREATE OR REPLACE FUNCTION public.cancel_order_with_alert(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_items_cancelled integer;
BEGIN
  -- Mark all non-ready items as cancelled
  UPDATE order_items
  SET status = 'cancelled'
  WHERE order_id = p_order_id
    AND status IN ('pending', 'in_prep', 'in_oven');
  
  GET DIAGNOSTICS v_items_cancelled = ROW_COUNT;
  
  -- Mark order as cancelled
  UPDATE orders
  SET status = 'cancelled'
  WHERE id = p_order_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'items_cancelled', v_items_cancelled
  );
END;
$function$;

-- Create function to acknowledge cancellation and delete the order
CREATE OR REPLACE FUNCTION public.acknowledge_cancellation(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Delete order items first
  DELETE FROM order_items WHERE order_id = p_order_id;
  
  -- Delete the order
  DELETE FROM orders WHERE id = p_order_id AND status = 'cancelled';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_not_found_or_not_cancelled');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'order_id', p_order_id);
END;
$function$;
