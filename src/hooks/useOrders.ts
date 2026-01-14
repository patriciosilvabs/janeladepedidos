import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OrderWithGroup } from '@/types/orders';
import { useEffect, useRef, useCallback } from 'react';

export function useOrders() {
  const queryClient = useQueryClient();

  // Fetch settings
  const { data: settings } = useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch all orders
  const { data: orders = [], isLoading, isFetching, error } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, delivery_groups(*), stores(*)')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as OrderWithGroup[];
    },
    placeholderData: (previousData) => previousData,
    staleTime: 1000,
  });

  // Debounced realtime subscription
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const debouncedInvalidate = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }, 200);
  }, [queryClient]);

  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        debouncedInvalidate
      )
      .subscribe();

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [queryClient, debouncedInvalidate]);

  // Mark order as ready - simplified without group logic
  const markAsReady = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'waiting_buffer',
          group_id: null, // No groups - independent orders
          ready_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) throw error;
      return { orderId };
    },
    onMutate: async (orderId) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previousOrders = queryClient.getQueryData<OrderWithGroup[]>(['orders']);
      
      queryClient.setQueryData<OrderWithGroup[]>(['orders'], (old) => 
        old?.map((order) =>
          order.id === orderId
            ? { 
                ...order, 
                status: 'waiting_buffer' as const,
                ready_at: new Date().toISOString(),
                group_id: null,
              }
            : order
        ) ?? []
      );
      
      return { previousOrders };
    },
    onError: (_err, _orderId, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  // Dispatch all buffer orders at once
  const dispatchAllBuffer = useMutation({
    mutationFn: async (orderIds: string[]) => {
      if (orderIds.length === 0) {
        throw new Error('Nenhum pedido para despachar');
      }

      const { data, error } = await supabase.functions.invoke('notify-order-ready', {
        body: { orderIds },
      });

      if (error) throw error;
      return data;
    },
    onMutate: async (orderIds) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previousOrders = queryClient.getQueryData<OrderWithGroup[]>(['orders']);
      
      // Optimistically update all orders to dispatched
      queryClient.setQueryData<OrderWithGroup[]>(['orders'], (old) => 
        old?.map((order) =>
          orderIds.includes(order.id)
            ? { 
                ...order, 
                status: 'dispatched' as const,
                dispatched_at: new Date().toISOString(),
              }
            : order
        ) ?? []
      );
      
      return { previousOrders };
    },
    onError: (_err, _orderIds, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  // Force dispatch a single order
  const forceDispatch = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.functions.invoke('notify-order-ready', {
        body: { orderIds: [orderId] },
      });

      if (error) throw error;
      if (!data.success && data.errors > 0) {
        throw new Error(data.errorDetails?.[0]?.error || 'Erro ao despachar pedido');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  // Sync orders status with CardápioWeb
  const syncOrdersStatus = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-orders-status');

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  // Retry notification for a failed order
  const retryNotification = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.functions.invoke('notify-order-ready', {
        body: { orderIds: [orderId] },
      });

      if (error) throw error;
      if (!data.success && data.errors > 0) {
        throw new Error(data.errorDetails?.[0]?.error || 'Erro ao reenviar notificação');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  return {
    orders,
    isLoading,
    isFetching,
    error,
    markAsReady,
    dispatchAllBuffer,
    forceDispatch,
    syncOrdersStatus,
    retryNotification,
  };
}
