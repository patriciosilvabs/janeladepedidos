ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS printnode_dispatch_enabled boolean DEFAULT false;