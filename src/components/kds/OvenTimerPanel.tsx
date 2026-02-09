import { useState, useEffect, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOrderItems } from '@/hooks/useOrderItems';
import { useSettings } from '@/hooks/useSettings';
import { usePrintNode } from '@/hooks/usePrintNode';
import { cn } from '@/lib/utils';
import { CancellationAlert } from './CancellationAlert';
import { OrderOvenBlock } from './OrderOvenBlock';
import { OvenItemRow } from './OvenItemRow';
import { OrderItemWithOrder } from '@/types/orderItems';
import { formatDispatchTicket } from '@/utils/printTicket';


export interface DispatchedOrder {
  orderId: string;
  orderDisplayId: string;
  storeName: string | null;
  customerName: string;
  items: OrderItemWithOrder[];
  dispatchedAt: Date;
}

interface OvenTimerPanelProps {
  sectorId?: string;
  onDispatch?: (order: DispatchedOrder) => void;
}

export function OvenTimerPanel({ sectorId, onDispatch }: OvenTimerPanelProps) {
  const { items, siblingItems, markItemReady } = useOrderItems({ status: ['in_oven', 'ready'], sectorId });
  const { settings } = useSettings();
  const { printRaw } = usePrintNode();
  const queryClient = useQueryClient();
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  
  const ovenTimeSeconds = settings?.oven_time_seconds ?? 120;
  const printEnabled = settings?.printnode_enabled ?? false;
  const dispatchPrintEnabled = settings?.printnode_dispatch_enabled ?? false;
  const printerId = settings?.printnode_printer_id ?? null;
  
  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);

  // Separate items by status
  const inOvenItems = items.filter(i => i.status === 'in_oven');
  const readyFromOvenItems = items.filter(i => i.status === 'ready' && i.oven_entry_at);


  // Group oven + ready-from-oven items by order (DB-based, no session memory)
  const orderGroups = useMemo(() => {
    const groups: Record<string, {
      orderId: string;
      orderDisplayId: string;
      storeName: string | null;
      customerName: string;
      ovenItems: OrderItemWithOrder[];
      siblingItems: OrderItemWithOrder[];
    }> = {};

    // Helper to create/get a group for an order
    const ensureGroup = (item: OrderItemWithOrder) => {
      if (!groups[item.order_id]) {
        const displayId = item.orders?.cardapioweb_order_id || item.orders?.external_id || item.order_id.slice(0, 8);
        groups[item.order_id] = {
          orderId: item.order_id,
          orderDisplayId: displayId,
          storeName: item.orders?.stores?.name || null,
          customerName: item.orders?.customer_name || 'Cliente',
          ovenItems: [],
          siblingItems: [],
        };
      }
      return groups[item.order_id];
    };

    for (const item of inOvenItems) {
      ensureGroup(item).ovenItems.push(item);
    }

    // Ready items with oven_entry_at always join their group (no session check needed)
    for (const item of readyFromOvenItems) {
      // Skip items from already-dispatched orders
      if (item.orders?.dispatched_at) continue;
      const orderStatus = item.orders?.status;
      if (orderStatus === 'closed' || orderStatus === 'cancelled' || orderStatus === 'dispatched') continue;
      ensureGroup(item).ovenItems.push(item);
    }

    for (const item of siblingItems) {
      if (groups[item.order_id]) {
        const alreadyInOven = groups[item.order_id].ovenItems.some(o => o.id === item.id);
        if (!alreadyInOven) {
          groups[item.order_id].siblingItems.push(item);
        }
      }
    }

    return Object.values(groups)
      .filter(g => {
        const order = g.ovenItems[0]?.orders;
        if (!order) return true;
        if (order.dispatched_at) return false;
        if (['closed', 'cancelled', 'dispatched', 'waiting_buffer'].includes(order.status)) return false;
        return true;
      })
      .sort((a, b) => {
        const aMin = Math.min(...a.ovenItems.map(i => i.estimated_exit_at ? new Date(i.estimated_exit_at).getTime() : Infinity));
        const bMin = Math.min(...b.ovenItems.map(i => i.estimated_exit_at ? new Date(i.estimated_exit_at).getTime() : Infinity));
        return aMin - bMin;
      });
  }, [inOvenItems, readyFromOvenItems, siblingItems]);

  const handleMarkItemReady = async (itemId: string) => {
    if (processingId) return;
    
    setProcessingId(itemId);
    processingTimeoutRef.current = setTimeout(() => setProcessingId(null), 5000);
    
    try {
      await markItemReady.mutateAsync(itemId);
      
      // Auto-dispatch when ALL oven items are ready and no pending siblings
      const group = orderGroups.find(g => g.ovenItems.some(i => i.id === itemId));
      if (group) {
        const allOvenReady = group.ovenItems.every(i => i.id === itemId || i.status === 'ready');
        const pendingSiblings = group.siblingItems.filter(i => i.status !== 'ready');
        if (allOvenReady && pendingSiblings.length === 0) {
          handleMasterReady(group.ovenItems);
        }
      }
    } catch (error) {
      console.error('Erro ao marcar item como pronto:', error);
    } finally {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
        processingTimeoutRef.current = null;
      }
      setProcessingId(null);
    }
  };

  const handleMasterReady = async (ovenItems: OrderItemWithOrder[]) => {
    const orderId = ovenItems[0]?.order_id;
    const firstItem = ovenItems[0];
    
    // Print dispatch ticket (optional)
    if (printEnabled && dispatchPrintEnabled && printerId && ovenItems.length > 0) {
      try {
        const ticketContent = formatDispatchTicket(firstItem);
        await printRaw(printerId, ticketContent, `Despacho #${firstItem.orders?.cardapioweb_order_id || firstItem.order_id.slice(0, 8)}`);
      } catch (printError) {
        console.error('Erro ao imprimir ticket de despacho:', printError);
      }
    }

    // Invalidate cache — mark_item_ready already triggers check_order_completion
    // which moves the order to waiting_buffer automatically
    queryClient.invalidateQueries({ queryKey: ['order-items'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });

    // Visual callback for oven history panel
    if (orderId) {
      const group = orderGroups.find(g => g.orderId === orderId);
      if (group && onDispatch) {
        onDispatch({
          orderId: group.orderId,
          orderDisplayId: group.orderDisplayId,
          storeName: group.storeName,
          customerName: group.customerName,
          items: [...group.ovenItems, ...group.siblingItems],
          dispatchedAt: new Date(),
        });
      }
    }
  };

  // Safety net: auto-dispatch orphan orders where all items are ready
  const safetyNetTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (safetyNetTimerRef.current) {
      clearTimeout(safetyNetTimerRef.current);
      safetyNetTimerRef.current = null;
    }
    for (const group of orderGroups) {
      const allReady = group.ovenItems.every(i => i.status === 'ready');
      const pendingSiblings = group.siblingItems.filter(i => i.status !== 'ready');
      if (allReady && pendingSiblings.length === 0 && group.ovenItems.length > 0) {
        safetyNetTimerRef.current = setTimeout(() => handleMasterReady(group.ovenItems), 3000);
        break;
      }
    }
    return () => {
      if (safetyNetTimerRef.current) clearTimeout(safetyNetTimerRef.current);
    };
  }, [orderGroups]);

  const totalActiveOvenItems = inOvenItems.length;

  if (orderGroups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {sectorId && <CancellationAlert sectorId={sectorId} />}
      {orderGroups.map((group) => {
        const pendingSiblings = group.siblingItems.filter(i => i.status !== 'ready');
        
        if (group.ovenItems.length === 1 && pendingSiblings.length === 0) {
          return (
            <OvenItemRow
              key={group.ovenItems[0].id}
              item={group.ovenItems[0]}
              onMarkReady={() => handleMarkItemReady(group.ovenItems[0].id)}
              isProcessing={processingId === group.ovenItems[0].id}
              isAnyProcessing={processingId !== null}
              audioEnabled={audioEnabled}
              ovenTimeSeconds={ovenTimeSeconds}
              orderDisplayId={group.orderDisplayId}
            />
          );
        }
        
        return (
          <OrderOvenBlock
            key={group.orderId}
            orderId={group.orderId}
            orderDisplayId={group.orderDisplayId}
            storeName={group.storeName}
            customerName={group.customerName}
            ovenItems={group.ovenItems}
            siblingItems={group.siblingItems}
            onMarkItemReady={handleMarkItemReady}
            onMasterReady={handleMasterReady}
            processingId={processingId}
            audioEnabled={audioEnabled}
            ovenTimeSeconds={ovenTimeSeconds}
          />
        );
      })}
    </div>
  );
}
