import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OvenHistoryOrder {
  orderId: string;
  orderDisplayId: string;
  storeName: string | null;
  customerName: string;
  completedAt: string;
  items: {
    id: string;
    product_name: string;
    quantity: number;
    flavors: string | null;
    complements: string | null;
    edge_type: string | null;
  }[];
}

export function useDispatchedOrders() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['oven-history'],
    queryFn: async (): Promise<OvenHistoryOrder[]> => {
      const since = new Date();
      since.setHours(since.getHours() - 24);

      // Find items that went through oven and are now ready (last 24h)
      const { data: ovenItems, error } = await supabase
        .from('order_items')
        .select('id, order_id, product_name, quantity, flavors, complements, edge_type, ready_at, oven_entry_at')
        .not('oven_entry_at', 'is', null)
        .eq('status', 'ready')
        .gte('ready_at', since.toISOString())
        .order('ready_at', { ascending: false });

      if (error) throw error;
      if (!ovenItems || ovenItems.length === 0) return [];

      // Get unique order IDs
      const orderIds = [...new Set(ovenItems.map(i => i.order_id))];

      // Fetch order details
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, customer_name, cardapioweb_order_id, external_id, store_id, stores(name)')
        .in('id', orderIds);

      if (ordersError) throw ordersError;

      const ordersMap: Record<string, typeof orders[0]> = {};
      for (const o of orders || []) {
        ordersMap[o.id] = o;
      }

      // Group items by order
      const groups: Record<string, OvenHistoryOrder> = {};
      for (const item of ovenItems) {
        if (!groups[item.order_id]) {
          const order = ordersMap[item.order_id];
          if (!order) continue;
          groups[item.order_id] = {
            orderId: item.order_id,
            orderDisplayId: order.cardapioweb_order_id || order.external_id || item.order_id.slice(0, 8),
            storeName: (order.stores as any)?.name || null,
            customerName: order.customer_name,
            completedAt: item.ready_at!,
            items: [],
          };
        }
        groups[item.order_id].items.push({
          id: item.id,
          product_name: item.product_name,
          quantity: item.quantity,
          flavors: item.flavors,
          complements: item.complements,
          edge_type: item.edge_type,
        });
        // Use earliest ready_at as completedAt
        if (item.ready_at && item.ready_at < groups[item.order_id].completedAt) {
          groups[item.order_id].completedAt = item.ready_at;
        }
      }

      return Object.values(groups).sort((a, b) =>
        new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
      );
    },
    refetchInterval: 30000,
  });

  // Realtime: invalidate when items become ready
  useEffect(() => {
    const channel = supabase
      .channel('oven-history-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'order_items' },
        (payload) => {
          if (payload.new?.status === 'ready' && payload.new?.oven_entry_at) {
            queryClient.invalidateQueries({ queryKey: ['oven-history'] });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}
