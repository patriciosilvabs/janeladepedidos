import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Order, DeliveryGroup, OrderWithGroup } from '@/types/orders';
import { isWithinRadius } from '@/lib/geo';
import { useEffect } from 'react';

const GROUPING_RADIUS_KM = 2;
const MAX_ORDERS_PER_GROUP = 3;

export function useOrders() {
  const queryClient = useQueryClient();

  // Fetch all orders
  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, delivery_groups(*)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as OrderWithGroup[];
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_groups' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Mark order as ready and add to buffer
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  // Dispatch a group
  const dispatchGroup = useMutation({
    mutationFn: async (groupId: string) => {
      const now = new Date().toISOString();

      // Update all orders in the group
      const { error: ordersError } = await supabase
        .from('orders')
        .update({ status: 'dispatched', dispatched_at: now })
        .eq('group_id', groupId);

      if (ordersError) throw ordersError;

      // Update group status
      const { error: groupError } = await supabase
        .from('delivery_groups')
        .update({ status: 'dispatched', dispatched_at: now })
        .eq('id', groupId);

      if (groupError) throw groupError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  // Force dispatch a single order
  const forceDispatch = useMutation({
    mutationFn: async (orderId: string) => {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('orders')
        .update({ status: 'dispatched', dispatched_at: now })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  return {
    orders,
    isLoading,
    error,
    markAsReady,
    dispatchGroup,
    forceDispatch,
  };
}
