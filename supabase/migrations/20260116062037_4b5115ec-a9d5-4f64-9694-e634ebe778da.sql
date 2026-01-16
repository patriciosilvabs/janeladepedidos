-- Criar função RPC para marcar pedido como dispatched usando NOW() do PostgreSQL
CREATE OR REPLACE FUNCTION public.set_order_dispatched(p_order_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE orders 
  SET status = 'dispatched', dispatched_at = NOW() 
  WHERE id = p_order_id;
$$;

-- Corrigir pedidos existentes com ready_at no futuro
UPDATE orders 
SET ready_at = NOW() 
WHERE status = 'waiting_buffer' AND ready_at > NOW();