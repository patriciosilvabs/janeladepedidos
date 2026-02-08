import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';

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
  const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [alertedOrders, setAlertedOrders] = useState<Set<string>>(new Set());

  // Query cancelled items that were ALREADY STARTED (claimed_at is not null)
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
          claimed_at,
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
        .eq('status', 'cancelled')
        .not('claimed_at', 'is', null); // Only items that were already started

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

  // Continuous alert sound while modal is visible
  useEffect(() => {
    if (cancelledOrders.length > 0) {
      const playSound = () => {
        try {
          if (!audioRef.current) {
            audioRef.current = new Audio('/alert.mp3');
          }
          audioRef.current.play().catch(console.error);
        } catch (e) {
          console.error('Audio playback failed:', e);
        }
      };
      
      playSound();
      audioIntervalRef.current = setInterval(playSound, 3000);
    } else {
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
        audioIntervalRef.current = null;
      }
    }

    return () => {
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
      }
    };
  }, [cancelledOrders.length]);

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

  // Fullscreen modal overlay
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-red-900/95 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 space-y-6">
        {cancelledOrders.map((order) => (
          <div key={order.orderId} className="flex flex-col items-center text-center space-y-6">
            {/* Icon */}
            <AlertTriangle className="h-24 w-24 text-white animate-bounce" />

            {/* Title */}
            <div className="space-y-2">
              <h1 className="text-5xl font-black text-white tracking-wider uppercase animate-[pulse_1s_ease-in-out_infinite]">
                PEDIDO CANCELADO
              </h1>
              <p className="text-4xl font-bold text-white font-mono">
                #{order.orderDisplayId}
              </p>
            </div>

            {/* Customer */}
            <p className="text-2xl text-white/80 font-medium">
              {order.customerName}
              {order.storeName && ` — ${order.storeName}`}
            </p>

            {/* Instruction */}
            <div className="bg-white/10 rounded-xl p-6 w-full">
              <p className="text-2xl text-white font-bold leading-relaxed">
                NÃO produza mais este item.
              </p>
              <p className="text-xl text-white/90 mt-2">
                Se já estiver pronto, encaixe em outro pedido.
              </p>
            </div>

            {/* Cancelled items list */}
            <div className="w-full space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 justify-center text-xl text-white">
                  <X className="h-6 w-6 text-white shrink-0" />
                  <span className="line-through opacity-80">
                    {item.quantity > 1 && `${item.quantity}x `}
                    {item.product_name}
                  </span>
                </div>
              ))}
            </div>

            {/* Big centered button */}
            <Button
              onClick={() => acknowledgeMutation.mutate(order.orderId)}
              disabled={acknowledgeMutation.isPending}
              className="w-full max-w-md bg-white text-red-900 hover:bg-white/90 font-black text-2xl py-8 rounded-xl shadow-2xl"
            >
              {acknowledgeMutation.isPending ? 'CONFIRMANDO...' : 'ENTENDI'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
