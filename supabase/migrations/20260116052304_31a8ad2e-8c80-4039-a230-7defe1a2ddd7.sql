-- Create sectors table
CREATE TABLE public.sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  view_type text NOT NULL DEFAULT 'management' CHECK (view_type IN ('kds', 'management')),
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

-- Policy: all authenticated users can view sectors
CREATE POLICY "Users can view sectors" ON public.sectors
  FOR SELECT TO authenticated USING (true);

-- Policy: only owners can manage sectors
CREATE POLICY "Owners can manage sectors" ON public.sectors
  FOR ALL USING (has_role(auth.uid(), 'owner'))
  WITH CHECK (has_role(auth.uid(), 'owner'));

-- Add sector_id column to user_roles table
ALTER TABLE public.user_roles 
  ADD COLUMN sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL;

-- Insert default sectors
INSERT INTO public.sectors (name, view_type, description) VALUES
  ('KDS', 'kds', 'Visualização simplificada para cozinha'),
  ('Gestão', 'management', 'Visualização completa com todas as colunas');

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_sectors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sectors_updated_at
  BEFORE UPDATE ON public.sectors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sectors_updated_at();