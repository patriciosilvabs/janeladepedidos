-- Create table for buffer settings per day of week
CREATE TABLE public.buffer_settings_by_day (
  id TEXT PRIMARY KEY,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  buffer_timeout_minutes INTEGER NOT NULL DEFAULT 10,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(day_of_week)
);

-- Enable RLS
ALTER TABLE public.buffer_settings_by_day ENABLE ROW LEVEL SECURITY;

-- RLS Policy - allow all authenticated users to read/write
CREATE POLICY "Allow all operations on buffer_settings_by_day" 
ON public.buffer_settings_by_day 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Insert default values for each day (0=Sunday, 6=Saturday)
INSERT INTO public.buffer_settings_by_day (id, day_of_week, buffer_timeout_minutes, enabled) VALUES
  ('sunday', 0, 10, true),
  ('monday', 1, 10, true),
  ('tuesday', 2, 10, true),
  ('wednesday', 3, 10, true),
  ('thursday', 4, 10, true),
  ('friday', 5, 10, true),
  ('saturday', 6, 10, true);

-- Create trigger for updated_at
CREATE TRIGGER update_buffer_settings_updated_at
  BEFORE UPDATE ON public.buffer_settings_by_day
  FOR EACH ROW
  EXECUTE FUNCTION public.update_app_settings_updated_at();