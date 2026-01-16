-- Função para marcar pedido como pronto usando timestamp do servidor
CREATE OR REPLACE FUNCTION public.mark_order_ready(order_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE orders
  SET
    status = 'waiting_buffer',
    group_id = NULL,
    ready_at = NOW()
  WHERE id = order_id;
END;
$$;

-- Permissão para usuários autenticados
GRANT EXECUTE ON FUNCTION public.mark_order_ready(UUID) TO authenticated;