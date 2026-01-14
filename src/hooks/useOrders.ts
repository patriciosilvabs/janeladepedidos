import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Order, DeliveryGroup, OrderWithGroup } from '@/types/orders';
import { isWithinRadius } from '@/lib/geo';
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

  const GROUPING_RADIUS_KM = settings?.grouping_radius_km || 2;
  const MAX_ORDERS_PER_GROUP = settings?.max_orders_per_group || 3;

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
    placeholderData: (previousData) => previousData, // Keep previous data during refetch
    staleTime: 1000, // 1 second cache
  });

  // Debounced realtime subscription to prevent flickering
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const debouncedInvalidate = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }, 200); // 200ms debounce for faster feedback
  }, [queryClient]);

  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        debouncedInvalidate
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_groups' },
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

  // Mark order as ready and add to buffer with optimistic update
  const markAsReady = useMutation({
    mutationFn: async (orderId: string) => {
      const order = orders.find((o) => o.id === orderId);
      if (!order) throw new Error('Order not found');

      // Find existing group within radius
      const waitingOrders = orders.filter(
        (o) => o.status === 'waiting_buffer' && o.group_id && o.id !== orderId
      );

      let groupId: string | null = null;

      // Check for existing groups within radius
      for (const waitingOrder of waitingOrders) {
        if (waitingOrder.delivery_groups && waitingOrder.delivery_groups.status === 'waiting') {
          const group = waitingOrder.delivery_groups;
          if (
            group.order_count < MAX_ORDERS_PER_GROUP &&
            isWithinRadius(order.lat, order.lng, group.center_lat, group.center_lng, GROUPING_RADIUS_KM)
          ) {
            groupId = group.id;
            // Update group order count
            await supabase
              .from('delivery_groups')
              .update({ order_count: group.order_count + 1 })
              .eq('id', group.id);
            break;
          }
        }
      }

      // Create new group if none found
      if (!groupId) {
        const { data: newGroup, error: groupError } = await supabase
          .from('delivery_groups')
          .insert({
            center_lat: order.lat,
            center_lng: order.lng,
            order_count: 1,
          })
          .select()
          .single();

        if (groupError) throw groupError;
        groupId = newGroup.id;
      }

      // Update order status
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'waiting_buffer',
          group_id: groupId,
          ready_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) throw error;
      
      return { orderId, groupId };
    },
    onMutate: async (orderId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      
      // Snapshot previous value
      const previousOrders = queryClient.getQueryData<OrderWithGroup[]>(['orders']);
      
      // Optimistically update the order status with temporary group
      queryClient.setQueryData<OrderWithGroup[]>(['orders'], (old) => 
        old?.map((order) =>
          order.id === orderId
            ? { 
                ...order, 
                status: 'waiting_buffer' as const,
                ready_at: new Date().toISOString(),
                group_id: 'temp-' + orderId,
              }
            : order
        ) ?? []
      );
      
      return { previousOrders };
    },
    onError: (_err, _orderId, context) => {
      // Rollback on error
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  // Dispatch a group via edge function
  const dispatchGroup = useMutation({
    mutationFn: async (groupId: string) => {
      // Get all orders in the group
      const groupOrders = orders.filter((o) => o.group_id === groupId);
      const orderIds = groupOrders.map((o) => o.id);

      if (orderIds.length === 0) {
        throw new Error('Nenhum pedido encontrado no grupo');
      }

      // Call edge function to notify CardápioWeb that orders are ready
      const { data, error } = await supabase.functions.invoke('notify-order-ready', {
        body: { orderIds, groupId },
      });

      if (error) throw error;
      
      // Return data even with notification errors
      // The orders were dispatched locally, only the notification failed
      return data;
    },
    onMutate: async (groupId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      
      // Snapshot previous value
      const previousOrders = queryClient.getQueryData<OrderWithGroup[]>(['orders']);
      
      // Optimistically update orders in group to dispatched
      queryClient.setQueryData<OrderWithGroup[]>(['orders'], (old) => 
        old?.map((order) =>
          order.group_id === groupId
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
    onError: (_err, _groupId, context) => {
      // Rollback on error
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  // Force dispatch a single order via edge function
  const forceDispatch = useMutation({
    mutationFn: async (orderId: string) => {
      // Call edge function to notify CardápioWeb that order is ready
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
    dispatchGroup,
    forceDispatch,
    syncOrdersStatus,
    retryNotification,
  };
}
