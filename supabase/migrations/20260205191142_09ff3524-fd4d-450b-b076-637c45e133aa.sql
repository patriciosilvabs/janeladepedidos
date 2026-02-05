-- Add PrintNode settings columns to app_settings
ALTER TABLE app_settings 
  ADD COLUMN IF NOT EXISTS printnode_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS printnode_printer_id integer DEFAULT NULL;