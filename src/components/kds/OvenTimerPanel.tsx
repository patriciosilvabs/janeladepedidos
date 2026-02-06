import { useState, useEffect, useRef, useMemo } from 'react';
import { useOrderItems } from '@/hooks/useOrderItems';
import { useSettings } from '@/hooks/useSettings';
import { usePrintNode } from '@/hooks/usePrintNode';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Flame, Volume2, VolumeX } from 'lucide-react';
import { CancellationAlert } from './CancellationAlert';
import { OrderOvenBlock } from './OrderOvenBlock';
import { OvenItemRow } from './OvenItemRow';
import { OrderItemWithOrder } from '@/types/orderItems';
import { formatDispatchTicket } from '@/utils/printTicket';

interface OvenTimerPanelProps {
  sectorId?: string;
}

export function OvenTimerPanel({ sectorId }: OvenTimerPanelProps) {
  const { inOvenItems, siblingItems, markItemReady } = useOrderItems({ status: 'in_oven', sectorId });
  const { settings } = useSettings();
  const { printRaw } = usePrintNode();
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

  // Group oven items by order
  const orderGroups = useMemo(() => {
    const groups: Record<string, {
      orderId: string;
      orderDisplayId: string;
      storeName: string | null;
      customerName: string;
      ovenItems: OrderItemWithOrder[];
      siblingItems: OrderItemWithOrder[];
    }> = {};

    for (const item of inOvenItems) {
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
      groups[item.order_id].ovenItems.push(item);
    }

    // Add sibling items to their respective groups
    for (const item of siblingItems) {
      if (groups[item.order_id]) {
        groups[item.order_id].siblingItems.push(item);
      }
    }

    // Sort groups by earliest exit time
    return Object.values(groups).sort((a, b) => {
      const aMin = Math.min(...a.ovenItems.map(i => i.estimated_exit_at ? new Date(i.estimated_exit_at).getTime() : Infinity));
      const bMin = Math.min(...b.ovenItems.map(i => i.estimated_exit_at ? new Date(i.estimated_exit_at).getTime() : Infinity));
      return aMin - bMin;
    });
  }, [inOvenItems, siblingItems]);

  const handleMarkItemReady = async (itemId: string) => {
    if (processingId) return;
    
    setProcessingId(itemId);
    processingTimeoutRef.current = setTimeout(() => setProcessingId(null), 5000);
    
    try {
      await markItemReady.mutateAsync(itemId);
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
    // Print dispatch ticket for the first item (contains order info)
    if (printEnabled && dispatchPrintEnabled && printerId && ovenItems.length > 0) {
      try {
        const firstItem = ovenItems[0];
        const ticketContent = formatDispatchTicket(firstItem);
        await printRaw(printerId, ticketContent, `Despacho #${firstItem.orders?.cardapioweb_order_id || firstItem.order_id.slice(0, 8)}`);
      } catch (printError) {
        console.error('Erro ao imprimir ticket de despacho:', printError);
      }
    }
  };

  const totalOvenItems = inOvenItems.length;

  if (totalOvenItems === 0) {
    return null;
  }

  return (
    <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Flame className="h-5 w-5 text-orange-500" />
            Forno
            <Badge className="bg-orange-500 text-white">
              {totalOvenItems}
            </Badge>
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={cn(
              "h-8 w-8",
              audioEnabled ? "text-orange-500" : "text-muted-foreground"
            )}
          >
            {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {sectorId && <CancellationAlert sectorId={sectorId} />}
        {orderGroups.map((group) => {
          const totalItems = group.ovenItems.length + group.siblingItems.length;
          
          if (totalItems === 1 && group.ovenItems.length === 1) {
            // Single-item order: render simple row without order header/DESPACHAR
            return (
              <OvenItemRow
                key={group.ovenItems[0].id}
                item={group.ovenItems[0]}
                onMarkReady={() => handleMarkItemReady(group.ovenItems[0].id)}
                isProcessing={processingId === group.ovenItems[0].id}
                isAnyProcessing={processingId !== null}
                audioEnabled={audioEnabled}
                ovenTimeSeconds={ovenTimeSeconds}
              />
            );
          }
          
          // Multi-item order: render full block with DESPACHAR
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
      </CardContent>
    </Card>
  );
}
