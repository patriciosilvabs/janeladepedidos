-- Add max_order_age_hours column to app_settings
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS max_order_age_hours integer DEFAULT 24;

COMMENT ON COLUMN app_settings.max_order_age_hours IS 
  'Tempo máximo em horas que um pedido pode ficar no dashboard antes de ser removido automaticamente';