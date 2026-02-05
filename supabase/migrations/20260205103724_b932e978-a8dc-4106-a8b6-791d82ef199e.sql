-- Adicionar colunas de configuração de impressão
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS qz_printer_name text,
ADD COLUMN IF NOT EXISTS qz_print_enabled boolean DEFAULT false;