SELECT cron.schedule(
  'cleanup-ready-orders',
  '59 2 * * *',
  $$UPDATE public.orders SET status = 'closed' WHERE status = 'ready'$$
);