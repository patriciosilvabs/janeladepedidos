-- Remover tabela print_jobs
DROP TABLE IF EXISTS print_jobs;

-- Remover colunas de QZ Tray da tabela app_settings
ALTER TABLE app_settings 
  DROP COLUMN IF EXISTS qz_printer_name,
  DROP COLUMN IF EXISTS qz_print_enabled,
  DROP COLUMN IF EXISTS print_receiver_enabled;