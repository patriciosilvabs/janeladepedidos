
-- Habilitar pg_cron para agendamento de tarefas
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Habilitar pg_net para requisições de rede
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Permissões necessárias
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Criar o cron job: limpar oven_entry_at dos itens ready às 23:59 horário de Brasília (02:59 UTC)
SELECT cron.schedule(
  'cleanup-oven-history',
  '59 2 * * *',
  $$UPDATE public.order_items SET oven_entry_at = NULL WHERE status = 'ready' AND oven_entry_at IS NOT NULL$$
);
