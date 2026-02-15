import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DispatchedOrderFromDB {
  orderId: string;
  orderDisplayId: string;
  storeName: string | null;
  customerName: string;
  dispatchedAt: string;
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
    queryKey: ['dispatched-orders'],
    queryFn: async (): Promise<DispatchedOrderFromDB[]> => {
      const since = new Date();
      since.setHours(since.getHours() - 24);

      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, customer_name, dispatched_at, cardapioweb_order_id, external_id, store_id, stores(name)')
        .not('dispatched_at', 'is', null)
        .gte('dispatched_at', since.toISOString())
        .order('dispatched_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      if (!orders || orders.length === 0) return [];

      const orderIds = orders.map(o => o.id);
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('id, order_id, product_name, quantity, flavors, complements, edge_type')
        .in('order_id', orderIds);

      if (itemsError) throw itemsError;

      const itemsByOrder: Record<string, typeof items> = {};
      for (const item of items || []) {
        if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
        itemsByOrder[item.order_id].push(item);
      }

      return orders.map(o => ({
        orderId: o.id,
        orderDisplayId: o.cardapioweb_order_id || o.external_id || o.id.slice(0, 8),
        storeName: (o.stores as any)?.name || null,
        customerName: o.customer_name,
        dispatchedAt: o.dispatched_at!,
        items: (itemsByOrder[o.id] || []).map(i => ({
          id: i.id,
          product_name: i.product_name,
          quantity: i.quantity,
          flavors: i.flavors,
          complements: i.complements,
          edge_type: i.edge_type,
        })),
      }));
    },
    refetchInterval: 30000,
  });

  // Realtime: invalidate on order status change to dispatched
  useEffect(() => {
    const channel = supabase
      .channel('dispatched-orders-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.new?.dispatched_at && !payload.old?.dispatched_at) {
            queryClient.invalidateQueries({ queryKey: ['dispatched-orders'] });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}
