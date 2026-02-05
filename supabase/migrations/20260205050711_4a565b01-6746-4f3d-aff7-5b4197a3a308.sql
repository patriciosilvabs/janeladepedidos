-- Adicionar colunas de configuração do Sistema Visual FIFO
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS kds_fifo_visual_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS fifo_warning_minutes INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS fifo_critical_minutes INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS fifo_lock_enabled BOOLEAN DEFAULT false;