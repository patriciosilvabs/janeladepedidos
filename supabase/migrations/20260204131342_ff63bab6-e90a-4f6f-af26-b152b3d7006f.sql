ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS kds_default_mode text 
DEFAULT 'items' 
CHECK (kds_default_mode IN ('items', 'orders'));