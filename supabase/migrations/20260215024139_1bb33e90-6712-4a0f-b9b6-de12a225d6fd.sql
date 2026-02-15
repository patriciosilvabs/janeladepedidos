
-- Create webhook_queue table for async webhook processing
CREATE TABLE public.webhook_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid REFERENCES public.stores(id),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

-- Enable RLS (access via service_role only from edge functions)
ALTER TABLE public.webhook_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on webhook_queue"
  ON public.webhook_queue
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for quick pending lookup
CREATE INDEX idx_webhook_queue_status ON public.webhook_queue(status) WHERE status = 'pending';
