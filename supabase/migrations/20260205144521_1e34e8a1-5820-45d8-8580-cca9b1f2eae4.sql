-- Adicionar coluna para o código da loja no CardápioWeb
ALTER TABLE stores 
ADD COLUMN cardapioweb_store_code text;

COMMENT ON COLUMN stores.cardapioweb_store_code IS 
  'Código da loja no CardápioWeb (ex: 8268)';