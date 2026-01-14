-- Add cardapioweb_created_at column to orders table
-- This stores the original creation time from CardápioWeb
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS cardapioweb_created_at timestamp with time zone;

COMMENT ON COLUMN orders.cardapioweb_created_at IS 
  'Data/hora original de criação do pedido no CardápioWeb';