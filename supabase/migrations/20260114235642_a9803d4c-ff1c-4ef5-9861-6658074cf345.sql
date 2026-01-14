-- Update the status check constraint to include 'ready' status
ALTER TABLE public.orders DROP CONSTRAINT orders_status_check;

ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'waiting_buffer'::text, 'ready'::text, 'dispatched'::text]));