-- Add columns to track CardápioWeb notification status
ALTER TABLE orders ADD COLUMN cardapioweb_notified boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN cardapioweb_notified_at timestamp with time zone;