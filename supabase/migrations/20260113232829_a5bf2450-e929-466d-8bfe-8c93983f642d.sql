-- Create app_settings table for storing integration configurations
CREATE TABLE public.app_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  
  -- Cardápio Web Integration
  cardapioweb_api_token TEXT,
  cardapioweb_webhook_token TEXT,
  cardapioweb_api_url TEXT DEFAULT 'https://integracao.cardapioweb.com',
  cardapioweb_enabled BOOLEAN DEFAULT false,
  
  -- Foody Delivery Integration
  foody_api_token TEXT,
  foody_api_url TEXT DEFAULT 'https://app.foodydelivery.com/rest/1.2',
  foody_enabled BOOLEAN DEFAULT false,
  
  -- Buffer Settings
  buffer_timeout_minutes INTEGER DEFAULT 10,
  grouping_radius_km NUMERIC DEFAULT 2.0,
  max_orders_per_group INTEGER DEFAULT 3,
  
  -- Default Location
  default_city TEXT DEFAULT 'João Pessoa',
  default_region TEXT DEFAULT 'PB',
  default_country TEXT DEFAULT 'BR',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow all operations (no auth for now)
CREATE POLICY "Allow all operations on app_settings"
  ON public.app_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Insert default settings
INSERT INTO public.app_settings (id) VALUES ('default');

-- Add additional fields to orders table for integrations
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS foody_uid TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS foody_status TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS foody_error TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cardapioweb_order_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS street TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS house_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'BR';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_app_settings_updated_at();