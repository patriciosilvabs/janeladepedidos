import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from './useSettings';

interface PollingState {
  isPolling: boolean;
  lastSync: Date | null;
  newOrdersCount: number;
  error: string | null;
}

export function usePolling(intervalMs: number = 30000) {
  const { settings } = useSettings();
  const [state, setState] = useState<PollingState>({
    isPolling: false,
    lastSync: null,
    newOrdersCount: 0,
    error: null,
  });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const pollOrders = useCallback(async () => {
    if (!settings?.cardapioweb_enabled) {
      return;
    }

    setState((prev) => ({ ...prev, isPolling: true, error: null }));

    try {
      const { data, error } = await supabase.functions.invoke('poll-orders', {
        method: 'POST',
      });

      if (error) {
        console.error('[usePolling] Error:', error);
        setState((prev) => ({
          ...prev,
          isPolling: false,
          error: error.message,
        }));
        return;
      }

      setState({
        isPolling: false,
        lastSync: new Date(),
        newOrdersCount: data?.newOrders || 0,
        error: null,
      });

      if (data?.newOrders > 0) {
        console.log(`[usePolling] Imported ${data.newOrders} new orders`);
      }
    } catch (err) {
      console.error('[usePolling] Unexpected error:', err);
      setState((prev) => ({
        ...prev,
        isPolling: false,
        error: 'Erro ao sincronizar',
      }));
    }
  }, [settings?.cardapioweb_enabled]);

  useEffect(() => {
    if (!settings?.cardapioweb_enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Poll immediately
    pollOrders();

    // Set up interval
    intervalRef.current = setInterval(pollOrders, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [settings?.cardapioweb_enabled, intervalMs, pollOrders]);

  return {
    ...state,
    manualPoll: pollOrders,
    isEnabled: settings?.cardapioweb_enabled || false,
  };
}
