import { useState, useRef, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, Clock, Loader2, Package } from 'lucide-react';
import { OvenItemRow } from './OvenItemRow';
import { OrderItemWithOrder } from '@/types/orderItems';
import { OrderTypeBadge } from '@/lib/orderTypeUtils';

interface OrderOvenBlockProps {
  orderId: string;
  orderDisplayId: string;
  storeName: string | null;
  customerName: string;
  ovenItems: OrderItemWithOrder[];
  siblingItems: OrderItemWithOrder[];
  onMarkItemReady: (itemId: string) => Promise<void>;
  onMasterReady: (ovenItems: OrderItemWithOrder[]) => Promise<void>;
  processingId: string | null;
  audioEnabled: boolean;
  ovenTimeSeconds: number;
}

export function OrderOvenBlock({
  orderId,
  orderDisplayId,
  storeName,
  customerName,
  ovenItems,
  siblingItems,
  onMarkItemReady,
  onMasterReady,
  processingId,
  audioEnabled,
  ovenTimeSeconds,
}: OrderOvenBlockProps) {
  const [localReadyIds, setLocalReadyIds] = useState<Set<string>>(new Set());
  const [isMasterProcessing, setIsMasterProcessing] = useState(false);
  const masterTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (masterTimeoutRef.current) clearTimeout(masterTimeoutRef.current);
    };
  }, []);

  const waitingItems = siblingItems.filter(i => i.status === 'pending' || i.status === 'in_prep');
  const dbReadyItems = siblingItems.filter(i => i.status === 'ready');
  const totalItems = ovenItems.length + waitingItems.length + dbReadyItems.length;
  const allOvenReady = ovenItems.every(i => localReadyIds.has(i.id) || i.status === 'ready');
  const allWaitingDone = waitingItems.length === 0;
  const masterEnabled = allOvenReady && allWaitingDone && !isMasterProcessing && totalItems > 0;
  const readyCount = ovenItems.filter(i => localReadyIds.has(i.id) || i.status === 'ready').length + dbReadyItems.length;

  // Get order_type from first oven item
  const orderType = ovenItems[0]?.orders?.order_type || null;

  const handleItemReady = async (itemId: string) => {
    await onMarkItemReady(itemId);
    setLocalReadyIds(prev => new Set(prev).add(itemId));
  };

  const handleMasterReady = async () => {
    setIsMasterProcessing(true);
    masterTimeoutRef.current = setTimeout(() => setIsMasterProcessing(false), 5000);
    try {
      await onMasterReady(ovenItems);
    } finally {
      if (masterTimeoutRef.current) {
        clearTimeout(masterTimeoutRef.current);
        masterTimeoutRef.current = null;
      }
      setIsMasterProcessing(false);
    }
  };

  const sortedOvenItems = useMemo(() => 
    [...ovenItems].sort((a, b) => {
      const aTime = a.estimated_exit_at ? new Date(a.estimated_exit_at).getTime() : Infinity;
      const bTime = b.estimated_exit_at ? new Date(b.estimated_exit_at).getTime() : Infinity;
      return aTime - bTime;
    }),
  [ovenItems]);

  return (
    <div className="rounded-xl border-2 border-orange-500/40 bg-gradient-to-br from-orange-500/5 to-transparent overflow-hidden">
      {/* Block header */}
      <div className="flex items-center justify-between px-4 py-3 bg-orange-500/10 border-b border-orange-500/20">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono text-2xl px-3 py-1 border-orange-500/50">
            #{orderDisplayId}
          </Badge>
          <OrderTypeBadge orderType={orderType} className="text-base px-3 py-1" />
          {storeName && (
            <span className="text-base text-primary font-medium">{storeName}</span>
          )}
          <span className="text-base text-muted-foreground">{customerName}</span>
          <Badge variant="secondary" className="gap-1 text-base">
            <Package className="h-4 w-4" />
            {readyCount}/{totalItems}
          </Badge>
        </div>
        
        <Button
          onClick={handleMasterReady}
          disabled={!masterEnabled}
          className={cn(
            "text-white font-bold text-lg px-8 py-3",
            masterEnabled
              ? "bg-green-600 hover:bg-green-700 animate-pulse"
              : "bg-gray-400 cursor-not-allowed"
          )}
        >
          {isMasterProcessing ? (
            <>
              <Loader2 className="h-6 w-6 mr-2 animate-spin" />
              FINALIZANDO...
            </>
          ) : (
            <>
              <Check className="h-6 w-6 mr-2" />
              DESPACHAR
            </>
          )}
        </Button>
      </div>

      {/* Oven items */}
      <div className="p-3 space-y-2">
        {sortedOvenItems.map((item) => (
          <OvenItemRow
            key={item.id}
            item={item}
            onMarkReady={() => handleItemReady(item.id)}
            isProcessing={processingId === item.id}
            isAnyProcessing={processingId !== null}
            audioEnabled={audioEnabled}
            ovenTimeSeconds={ovenTimeSeconds}
            isMarkedReady={localReadyIds.has(item.id)}
          />
        ))}

        {/* Already ready siblings */}
        {dbReadyItems.map((item) => (
          <div key={item.id} className="p-3 rounded-lg border-2 border-green-500 bg-green-500/10">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 font-mono text-3xl font-bold min-w-[90px] text-green-500">
                <Check className="h-6 w-6" />
                OK
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-bold text-foreground truncate">
                  {item.quantity > 1 && <span className="text-primary">{item.quantity}x </span>}
                  {item.product_name}
                </p>
                {item.edge_type && (
                  <div className="mt-1 p-1.5 bg-orange-600 rounded-md animate-[pulse_0.8s_ease-in-out_infinite]">
                    <p className="text-base text-white font-bold whitespace-pre-line">{item.edge_type}</p>
                  </div>
                )}
                {item.complements && (
                  <p className="mt-1 text-base text-muted-foreground whitespace-pre-line">{item.complements}</p>
                )}
                {item.notes && (
                  <div className="mt-1 p-1.5 bg-red-600 rounded-md animate-[pulse_0.8s_ease-in-out_infinite]">
                    <p className="text-base text-white font-bold uppercase">⚠️ OBS: {item.notes}</p>
                  </div>
                )}
              </div>
              <Badge className="bg-green-600 text-white shrink-0 text-lg px-4 py-1.5">
                <Check className="h-5 w-5 mr-1" />
                PRONTO
              </Badge>
            </div>
          </div>
        ))}

        {/* Waiting items */}
        {waitingItems.length > 0 && (
          <div className="space-y-2 mt-2">
            {waitingItems.map((item) => {
              const flavorsList = item.flavors
                ?.split('\n')
                .map(f => f.replace(/^[•*\-]\s*/, '').trim())
                .filter(Boolean) || [];
              return (
                <div key={item.id} className="p-3 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 opacity-50">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 font-mono text-xl font-bold min-w-[90px] text-muted-foreground">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xl font-medium text-muted-foreground truncate">
                        {item.quantity > 1 && `${item.quantity}x `}
                        {item.product_name}
                      </p>
                      {flavorsList.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {flavorsList.map((flavor, idx) => (
                            <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-md text-base font-medium border bg-muted/50 border-border text-muted-foreground">
                              {flavor}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.edge_type && (
                        <div className="mt-1 p-1.5 bg-orange-600 rounded-md animate-[pulse_0.8s_ease-in-out_infinite]">
                          <p className="text-base text-white font-bold whitespace-pre-line">{item.edge_type}</p>
                        </div>
                      )}
                      {item.complements && (
                        <p className="mt-1 text-base text-muted-foreground whitespace-pre-line">{item.complements}</p>
                      )}
                      {item.notes && (
                        <div className="mt-1 p-1.5 bg-red-600 rounded-md animate-[pulse_0.8s_ease-in-out_infinite]">
                          <p className="text-base text-white font-bold uppercase">⚠️ OBS: {item.notes}</p>
                        </div>
                      )}
                    </div>
                    <span className="text-lg font-semibold text-muted-foreground animate-pulse shrink-0">
                      Aguardando...
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
