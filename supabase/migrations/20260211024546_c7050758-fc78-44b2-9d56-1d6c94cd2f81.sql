
-- Table to map CardápioWeb option_group_id to classification type per store
CREATE TABLE public.store_option_group_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  option_group_id integer NOT NULL,
  option_type text NOT NULL DEFAULT 'complement',
  group_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_option_type CHECK (option_type IN ('edge', 'flavor', 'complement')),
  CONSTRAINT unique_store_group UNIQUE(store_id, option_group_id)
);

-- Enable RLS
ALTER TABLE public.store_option_group_mappings ENABLE ROW LEVEL SECURITY;

-- Same permissive policy as stores table
CREATE POLICY "Allow all operations on store_option_group_mappings"
ON public.store_option_group_mappings FOR ALL USING (true) WITH CHECK (true);

-- Index for lookups by store
CREATE INDEX idx_store_option_group_mappings_store_id ON public.store_option_group_mappings(store_id);
