-- Adicionar coluna order_type na tabela orders
ALTER TABLE orders 
ADD COLUMN order_type text DEFAULT 'delivery';

-- Comentário para documentação
COMMENT ON COLUMN orders.order_type IS 'Tipo do pedido: delivery, dine_in (mesa), takeaway (retirada), counter (balcão)';