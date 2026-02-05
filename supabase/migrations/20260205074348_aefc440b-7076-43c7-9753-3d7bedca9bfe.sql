-- Criar função que marca todos os itens de um pedido como ready
-- Isso unifica o fluxo do Dashboard com o KDS
CREATE OR REPLACE FUNCTION mark_order_items_ready(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Marcar todos os itens como ready de uma vez
  UPDATE order_items
  SET 
    status = 'ready',
    ready_at = NOW()
  WHERE order_id = p_order_id
    AND status IN ('pending', 'in_prep', 'in_oven');
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Verificar se pedido deve ir para buffer (chama a função existente)
  PERFORM check_order_completion(p_order_id);
  
  RETURN jsonb_build_object(
    'success', true,
    'items_marked', v_count,
    'order_id', p_order_id
  );
END;
$$;