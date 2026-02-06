ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS allowed_order_types text[] DEFAULT ARRAY['delivery', 'takeaway', 'dine_in', 'counter'];