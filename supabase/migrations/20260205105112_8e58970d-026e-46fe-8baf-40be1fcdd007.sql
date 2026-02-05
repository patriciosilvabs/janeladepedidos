-- Tabela para fila de impressão remota
CREATE TABLE public.print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid REFERENCES order_items(id) ON DELETE CASCADE,
  item_data jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  printed_at timestamptz,
  printer_name text,
  error_message text
);

-- Índices para performance
CREATE INDEX idx_print_jobs_status ON print_jobs(status);
CREATE INDEX idx_print_jobs_created_at ON print_jobs(created_at);

-- RLS
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on print_jobs"
ON print_jobs FOR ALL
USING (true)
WITH CHECK (true);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE print_jobs;

-- Adicionar coluna de receptor em app_settings
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS print_receiver_enabled boolean DEFAULT false;