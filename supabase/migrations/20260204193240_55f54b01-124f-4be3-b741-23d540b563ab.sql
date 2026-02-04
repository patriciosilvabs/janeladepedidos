-- Add oven time configuration to app_settings
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS oven_time_seconds integer DEFAULT 120;