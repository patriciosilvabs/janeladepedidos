-- Create stores table for multi-tenant support
CREATE TABLE public.stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cardapioweb_api_token TEXT,
  cardapioweb_api_url TEXT DEFAULT 'https://integracao.cardapioweb.com',
  cardapioweb_enabled BOOLEAN DEFAULT true,
  default_city TEXT DEFAULT 'João Pessoa',
  default_region TEXT DEFAULT 'PB',
  default_country TEXT DEFAULT 'BR',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add store_id column to orders table
ALTER TABLE public.orders ADD COLUMN store_id UUID REFERENCES public.stores(id);

-- Enable RLS on stores table
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Create policy for stores (allow all operations for now)
CREATE POLICY "Allow all operations on stores" 
ON public.stores 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create trigger for automatic timestamp updates on stores
CREATE TRIGGER update_stores_updated_at
BEFORE UPDATE ON public.stores
FOR EACH ROW
EXECUTE FUNCTION public.update_app_settings_updated_at();

-- Create index for faster lookups
CREATE INDEX idx_orders_store_id ON public.orders(store_id);
CREATE INDEX idx_stores_enabled ON public.stores(cardapioweb_enabled);