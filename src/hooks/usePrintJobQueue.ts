import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { OrderItemWithOrder } from '@/types/orderItems';
import * as qzTray from '@/lib/qzTray';
import { toast } from 'sonner';

interface PrintJob {
  id: string;
  order_item_id: string;
  item_data: OrderItemWithOrder;
  status: string;
  created_at: string;
  printed_at: string | null;
  printer_name: string | null;
  error_message: string | null;
}

interface UsePrintJobQueueOptions {
  enabled: boolean;
  printerName: string | null;
  isQZConnected: boolean;
}

export function usePrintJobQueue({ enabled, printerName, isQZConnected }: UsePrintJobQueueOptions) {
  const processingRef = useRef<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const updateJobStatus = useCallback(async (
    jobId: string,
    status: 'printing' | 'printed' | 'failed',
    errorMessage?: string
  ) => {
    const updates: Record<string, unknown> = { status };
    
    if (status === 'printed') {
      updates.printed_at = new Date().toISOString();
      updates.printer_name = printerName;
    }
    
    if (errorMessage) {
      updates.error_message = errorMessage;
    }

    await supabase
      .from('print_jobs')
      .update(updates)
      .eq('id', jobId);
  }, [printerName]);

  const processJob = useCallback(async (job: PrintJob) => {
    // Prevent duplicate processing
    if (processingRef.current.has(job.id)) {
      return;
    }

    processingRef.current.add(job.id);

    try {
      // Mark as printing
      await updateJobStatus(job.id, 'printing');

      // Execute print
      if (!printerName) {
        throw new Error('Nenhuma impressora configurada');
      }

      await qzTray.printReceipt(printerName, job.item_data);

      // Mark as printed
      await updateJobStatus(job.id, 'printed');
      
      console.log('[PrintQueue] Job processed successfully:', job.id);
    } catch (error: any) {
      console.error('[PrintQueue] Job failed:', job.id, error);
      await updateJobStatus(job.id, 'failed', error?.message || 'Erro desconhecido');
      toast.error(`Falha na impressão: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      processingRef.current.delete(job.id);
    }
  }, [printerName, updateJobStatus]);

  const processPendingJobs = useCallback(async () => {
    if (!enabled || !isQZConnected || !printerName) return;

    const { data: pendingJobs } = await supabase
      .from('print_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (pendingJobs && pendingJobs.length > 0) {
      console.log('[PrintQueue] Processing', pendingJobs.length, 'pending jobs');
      for (const job of pendingJobs) {
        await processJob(job as unknown as PrintJob);
      }
    }
  }, [enabled, isQZConnected, printerName, processJob]);

  useEffect(() => {
    if (!enabled || !isQZConnected || !printerName) {
      // Cleanup existing channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    // Process any pending jobs on startup
    processPendingJobs();

    // Create unique channel name
    const channelId = `print-jobs-${crypto.randomUUID()}`;
    
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'print_jobs',
        },
        async (payload) => {
          const job = payload.new as unknown as PrintJob;
          
          if (job.status === 'pending') {
            console.log('[PrintQueue] New job received:', job.id);
            await processJob(job);
          }
        }
      )
      .subscribe((status) => {
        console.log('[PrintQueue] Subscription status:', status);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, isQZConnected, printerName, processJob, processPendingJobs]);

  return {
    processPendingJobs,
  };
}

// Function to queue a print job (used by tablets/KDS without local printer)
export async function queuePrintJob(item: OrderItemWithOrder): Promise<void> {
  const jobData = {
    order_item_id: item.id,
    item_data: JSON.parse(JSON.stringify(item)),
    status: 'pending' as const,
  };

  const { error } = await supabase
    .from('print_jobs')
    .insert(jobData);

  if (error) {
    console.error('[PrintQueue] Failed to queue job:', error);
    throw error;
  }

  console.log('[PrintQueue] Job queued for item:', item.id);
}
