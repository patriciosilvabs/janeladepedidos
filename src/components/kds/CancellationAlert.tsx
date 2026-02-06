import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CancelledOrder {
  orderId: string;
  orderDisplayId: string;
  customerName: string;
  storeName: string | null;
  items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    status: string;
  }>;
}

interface CancellationAlertProps {
  sectorId: string;
}

export function CancellationAlert({ sectorId }: CancellationAlertProps) {
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [alertedOrders, setAlertedOrders] = useState<Set<string>>(new Set());

  // Query cancelled items in this sector
  const { data: cancelledItems = [] } = useQuery({
    queryKey: ['cancelled-items', sectorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          id,
          order_id,
          product_name,
          quantity,
          status,
          orders!inner(
            id,
            customer_name,
            cardapioweb_order_id,
            external_id,
            status,
            stores(id, name)
          )
        `)
        .eq('assigned_sector_id', sectorId)
        .eq('status', 'cancelled');

      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 2000,
  });

  // Group by order
  const cancelledOrders: CancelledOrder[] = cancelledItems.reduce((acc: CancelledOrder[], item: any) => {
    const existing = acc.find(o => o.orderId === item.order_id);
    const itemData = {
      id: item.id,
      product_name: item.product_name,
      quantity: item.quantity,
      status: item.status,
    };

    if (existing) {
      existing.items.push(itemData);
    } else {
      acc.push({
        orderId: item.order_id,
        orderDisplayId: item.orders?.cardapioweb_order_id || item.orders?.external_id || item.order_id.slice(0, 8),
        customerName: item.orders?.customer_name || 'Cliente',
        storeName: item.orders?.stores?.name || null,
        items: [itemData],
      });
    }
    return acc;
  }, []);

  // Play alert sound for new cancellations
  useEffect(() => {
    const newOrders = cancelledOrders.filter(o => !alertedOrders.has(o.orderId));
    if (newOrders.length > 0) {
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio('/alert.mp3');
        }
        audioRef.current.play().catch(console.error);
      } catch (e) {
        console.error('Audio playback failed:', e);
      }
      setAlertedOrders(prev => {
        const next = new Set(prev);
        newOrders.forEach(o => next.add(o.orderId));
        return next;
      });
    }
  }, [cancelledOrders, alertedOrders]);

  // Acknowledge cancellation
  const acknowledgeMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.rpc('acknowledge_cancellation', {
        p_order_id: orderId,
      });
      if (error) throw error;
      const result = data as unknown as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error || 'Erro ao confirmar');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cancelled-items'] });
      queryClient.invalidateQueries({ queryKey: ['order-items'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  if (cancelledOrders.length === 0) return null;

  return (
    <div className="space-y-3 mb-4">
      {cancelledOrders.map((order) => (
        <div
          key={order.orderId}
          className={cn(
            "relative rounded-lg border-2 border-destructive bg-destructive/10 p-4",
            "animate-[pulse_1s_ease-in-out_infinite]"
          )}
        >
          {/* Flashing header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-destructive animate-bounce" />
              <span className="text-lg font-bold text-destructive uppercase tracking-wide">
                Pedido Cancelado
              </span>
            </div>
            <Badge variant="outline" className="font-mono text-lg border-destructive text-destructive">
              #{order.orderDisplayId}
            </Badge>
          </div>

          {/* Order info */}
          <div className="mb-3">
            <p className="text-base font-medium text-foreground">{order.customerName}</p>
            {order.storeName && (
              <p className="text-sm text-muted-foreground">{order.storeName}</p>
            )}
          </div>

          {/* Items that were in production */}
          <div className="space-y-1 mb-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-sm">
                <X className="h-4 w-4 text-destructive" />
                <span className="line-through text-muted-foreground">
                  {item.quantity > 1 && `${item.quantity}x `}
                  {item.product_name}
                </span>
              </div>
            ))}
          </div>

          {/* Acknowledge button */}
          <Button
            onClick={() => acknowledgeMutation.mutate(order.orderId)}
            disabled={acknowledgeMutation.isPending}
            className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold text-base py-5"
          >
            <Check className="h-5 w-5 mr-2" />
            {acknowledgeMutation.isPending ? 'Confirmando...' : 'CONFIRMAR CANCELAMENTO'}
          </Button>
        </div>
      ))}
    </div>
  );
}
