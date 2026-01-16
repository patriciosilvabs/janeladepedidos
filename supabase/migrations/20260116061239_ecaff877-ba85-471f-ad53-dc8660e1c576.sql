-- Corrigir ready_at dos pedidos existentes no buffer que têm timestamp no futuro
UPDATE orders
SET ready_at = NOW()
WHERE status = 'waiting_buffer'
  AND ready_at > NOW();