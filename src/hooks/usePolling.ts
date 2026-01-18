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
      // 1. Buscar novos pedidos do CardápioWeb
      const { data: pollData, error: pollError } = await supabase.functions.invoke('poll-orders', {
        method: 'POST',
      });

      if (pollError) {
        console.error('[usePolling] Error polling orders:', pollError);
      }

      // 2. Sincronizar status dos pedidos existentes (detectar "Saiu para Entrega")
      const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-orders-status');

      if (syncError) {
        console.error('[usePolling] Error syncing status:', syncError);
      }

      // Se ambos falharam, reportar erro
      if (pollError && syncError) {
        setState((prev) => ({
          ...prev,
          isPolling: false,
          error: pollError.message,
        }));
        return;
      }

      const newOrders = pollData?.newOrders || 0;
      const updatedOrders = syncData?.updated || 0;

      setState({
        isPolling: false,
        lastSync: new Date(),
        newOrdersCount: newOrders,
        error: null,
      });

      if (newOrders > 0) {
        console.log(`[usePolling] Imported ${newOrders} new orders`);
      }
      if (updatedOrders > 0) {
        console.log(`[usePolling] Updated ${updatedOrders} orders from CardápioWeb status`);
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
