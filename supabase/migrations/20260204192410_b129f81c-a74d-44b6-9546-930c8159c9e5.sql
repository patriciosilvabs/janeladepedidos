-- Habilitar realtime para tabela orders
-- Isso permite que mudanças de status sejam propagadas instantaneamente para todos os tablets
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;