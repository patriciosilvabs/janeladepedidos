-- Adicionar novo campo em minutos (converter valor existente de horas para minutos)
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS dispatched_visibility_minutes integer DEFAULT 60;

-- Atualizar com valor convertido das horas existentes
UPDATE app_settings 
SET dispatched_visibility_minutes = COALESCE(dispatched_visibility_hours, 1) * 60;

-- Remover campo antigo
ALTER TABLE app_settings DROP COLUMN IF EXISTS dispatched_visibility_hours;