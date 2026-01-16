-- Add new settings for dispatched orders column
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS dispatched_order_sort_desc boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS dispatched_visibility_hours integer DEFAULT 1;