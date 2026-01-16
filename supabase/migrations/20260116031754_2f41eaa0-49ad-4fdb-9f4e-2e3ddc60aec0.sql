-- Create dynamic buffer settings table
CREATE TABLE public.dynamic_buffer_settings (
  id text PRIMARY KEY DEFAULT 'default',
  enabled boolean DEFAULT false,
  
  -- Cenário 1: Baixo movimento (prioridade: velocidade)
  low_volume_min_orders integer DEFAULT 1,
  low_volume_max_orders integer DEFAULT 3,
  low_volume_timer_minutes integer DEFAULT 2,
  
  -- Cenário 2: Movimento moderado (prioridade: agrupamento)
  medium_volume_min_orders integer DEFAULT 4,
  medium_volume_max_orders integer DEFAULT 8,
  medium_volume_timer_minutes integer DEFAULT 5,
  
  -- Cenário 3: Pico de demanda (prioridade: eficiência de frete)
  high_volume_min_orders integer DEFAULT 9,
  high_volume_timer_minutes integer DEFAULT 8,
  
  -- Trava de segurança: tempo máximo absoluto
  max_buffer_time_minutes integer DEFAULT 10,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Insert default configuration
INSERT INTO public.dynamic_buffer_settings (id) VALUES ('default');

-- Enable RLS
ALTER TABLE public.dynamic_buffer_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy - allow all operations for authenticated users
CREATE POLICY "Allow all operations on dynamic_buffer_settings" 
  ON public.dynamic_buffer_settings 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_dynamic_buffer_settings_updated_at
  BEFORE UPDATE ON public.dynamic_buffer_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_app_settings_updated_at();