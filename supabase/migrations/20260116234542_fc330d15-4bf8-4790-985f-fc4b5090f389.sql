-- Add urgency settings to app_settings
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS urgent_production_timeout_minutes integer DEFAULT 25,
ADD COLUMN IF NOT EXISTS urgent_bypass_enabled boolean DEFAULT true;

-- Add urgency flag to orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS is_urgent boolean DEFAULT false;