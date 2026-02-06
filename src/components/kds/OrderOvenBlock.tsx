import { useState, useRef, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, Clock, Loader2, Package } from 'lucide-react';
import { OvenItemRow } from './OvenItemRow';
import { OrderItemWithOrder } from '@/types/orderItems';

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

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (masterTimeoutRef.current) clearTimeout(masterTimeoutRef.current);
    };
  }, []);

  // Items waiting (pending, in_prep) - not in oven yet
  const waitingItems = siblingItems.filter(i => i.status === 'pending' || i.status === 'in_prep');
  // Items already ready from DB
  const dbReadyItems = siblingItems.filter(i => i.status === 'ready');

  // Total items in this order (oven + waiting + already ready from siblings)
  const totalItems = ovenItems.length + waitingItems.length + dbReadyItems.length;

  // Count how many are ready (locally marked + db ready + db ready siblings)
  const allOvenReady = ovenItems.every(i => localReadyIds.has(i.id) || i.status === 'ready');
  const allWaitingDone = waitingItems.length === 0;
  const masterEnabled = allOvenReady && allWaitingDone && !isMasterProcessing && totalItems > 0;

  const readyCount = ovenItems.filter(i => localReadyIds.has(i.id) || i.status === 'ready').length + dbReadyItems.length;

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

  // Sort oven items by exit time
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
          <Badge variant="outline" className="font-mono text-lg px-2 py-0.5 border-orange-500/50">
            #{orderDisplayId}
          </Badge>
          {storeName && (
            <span className="text-sm text-primary font-medium">{storeName}</span>
          )}
          <span className="text-sm text-muted-foreground">{customerName}</span>
          <Badge variant="secondary" className="gap-1">
            <Package className="h-3 w-3" />
            {readyCount}/{totalItems}
          </Badge>
        </div>
        
        {/* Master PRONTO button */}
        <Button
          onClick={handleMasterReady}
          disabled={!masterEnabled}
          className={cn(
            "text-white font-bold text-base px-6",
            masterEnabled
              ? "bg-green-600 hover:bg-green-700 animate-pulse"
              : "bg-gray-400 cursor-not-allowed"
          )}
        >
          {isMasterProcessing ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              FINALIZANDO...
            </>
          ) : (
            <>
              <Check className="h-5 w-5 mr-2" />
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

        {/* Already ready siblings from DB */}
        {dbReadyItems.map((item) => (
          <div
            key={item.id}
            className="p-3 rounded-lg border-2 border-green-500 bg-green-500/10"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 font-mono text-2xl font-bold min-w-[80px] text-green-500">
                <Check className="h-5 w-5" />
                OK
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold text-foreground truncate">
                  {item.quantity > 1 && <span className="text-primary">{item.quantity}x </span>}
                  {item.product_name}
                </p>
              </div>
              <Badge className="bg-green-600 text-white shrink-0 text-base px-3 py-1">
                <Check className="h-4 w-4 mr-1" />
                PRONTO
              </Badge>
            </div>
          </div>
        ))}

        {/* Waiting items */}
        {waitingItems.length > 0 && (
          <div className="space-y-2 mt-2">
            {waitingItems.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 opacity-40 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 font-mono text-lg font-bold min-w-[80px] text-muted-foreground">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-medium text-muted-foreground truncate">
                      {item.quantity > 1 && `${item.quantity}x `}
                      {item.product_name}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground italic shrink-0">
                    Aguardando...
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
