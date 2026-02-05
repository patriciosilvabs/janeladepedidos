import { useState, useEffect, useRef } from 'react';
import { useOrderItems } from '@/hooks/useOrderItems';
import { useSettings } from '@/hooks/useSettings';
import { usePrintNode } from '@/hooks/usePrintNode';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Flame, Check, Volume2, VolumeX, AlertTriangle } from 'lucide-react';
import { OrderItemWithOrder } from '@/types/orderItems';
import { formatDispatchTicket } from '@/utils/printTicket';

interface OvenItemRowProps {
  item: OrderItemWithOrder;
  onMarkReady: () => void;
  isProcessing: boolean;
  isAnyProcessing: boolean;
  audioEnabled: boolean;
  ovenTimeSeconds: number;
}

 function OvenItemRow({ item, onMarkReady, isProcessing, isAnyProcessing, audioEnabled, ovenTimeSeconds }: OvenItemRowProps) {
  const [countdown, setCountdown] = useState<number>(ovenTimeSeconds);
  const [hasPlayedAlert, setHasPlayedAlert] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const orderId = item.orders?.cardapioweb_order_id || 
                  item.orders?.external_id || 
                  item.order_id.slice(0, 8);

  useEffect(() => {
    if (!item.estimated_exit_at) return;

    const calculateRemaining = () => {
      const exit = new Date(item.estimated_exit_at!).getTime();
      return Math.max(0, Math.floor((exit - Date.now()) / 1000));
    };

    setCountdown(calculateRemaining());

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setCountdown(remaining);

      // Play alert at 10 seconds
      if (remaining <= 10 && remaining > 0 && !hasPlayedAlert && audioEnabled) {
        try {
          if (!audioRef.current) {
            audioRef.current = new Audio('/alert.mp3');
          }
          audioRef.current.play().catch(console.error);
          setHasPlayedAlert(true);
        } catch (e) {
          console.error('Audio playback failed:', e);
        }
      }

      // Stop interval at 0, but do NOT auto-complete
      // Item stays visible until manual click
      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [item.estimated_exit_at, hasPlayedAlert, audioEnabled]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isFinished = countdown === 0;
  const isUrgent = countdown <= 10 && countdown > 0;
  const progressPercent = Math.max(0, Math.min(100, (countdown / ovenTimeSeconds) * 100));

  return (
    <div className={cn(
      "relative p-3 rounded-lg border-2 transition-all",
      isFinished 
        ? "border-red-600 bg-red-600/20 animate-[pulse_0.5s_ease-in-out_infinite]" 
        : isUrgent 
          ? "border-red-500 bg-red-500/10 animate-pulse" 
          : "border-orange-500/30 bg-orange-500/5"
    )}>
      {/* Progress bar background */}
      <div 
        className={cn(
          "absolute inset-0 rounded-lg transition-all opacity-20",
          isUrgent ? "bg-red-500" : "bg-orange-500"
        )}
        style={{ width: `${100 - progressPercent}%` }}
      />

      <div className="relative flex items-center gap-3">
        {/* Timer */}
        <div className={cn(
          "flex items-center gap-2 font-mono text-2xl font-bold min-w-[80px]",
          isFinished ? "text-red-600" : isUrgent ? "text-red-500" : "text-orange-500"
        )}>
          {(isFinished || isUrgent) && <AlertTriangle className="h-5 w-5 animate-bounce" />}
          {formatTime(countdown)}
        </div>

        {/* Item info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-lg px-2 py-0.5">
              #{orderId}
            </Badge>
            {item.orders?.stores?.name && (
              <span className="text-xs text-primary font-medium truncate">
                {item.orders.stores.name}
              </span>
            )}
          </div>
          <p className="text-xl font-bold text-foreground truncate mt-1">
            {item.quantity > 1 && <span className="text-primary">{item.quantity}x </span>}
            {item.product_name}
          </p>
        </div>

        {/* Action */}
        <Button
          onClick={onMarkReady}
          disabled={isProcessing || isAnyProcessing}
          className={cn(
            "text-white shrink-0",
            isProcessing 
              ? "bg-gray-500"
              : isUrgent 
              ? "bg-red-600 hover:bg-red-700" 
              : "bg-green-600 hover:bg-green-700"
          )}
        >
          <Check className="h-4 w-4 mr-1" />
          {isProcessing ? 'SALVANDO...' : 'PRONTO'}
        </Button>
      </div>
    </div>
  );
}

interface OvenTimerPanelProps {
  sectorId?: string;
}

export function OvenTimerPanel({ sectorId }: OvenTimerPanelProps) {
  const { inOvenItems, markItemReady } = useOrderItems({ status: 'in_oven', sectorId });
  const { settings } = useSettings();
  const { printRaw } = usePrintNode();
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get oven time from settings
  const ovenTimeSeconds = settings?.oven_time_seconds ?? 120;
  
  // PrintNode settings
  const printEnabled = settings?.printnode_enabled ?? false;
  const dispatchPrintEnabled = settings?.printnode_dispatch_enabled ?? false;
  const printerId = settings?.printnode_printer_id ?? null;
  
  // Limpar timeout no unmount
  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);

  const handleMarkReady = async (itemId: string) => {
    // Evitar cliques duplos - bloquear se qualquer item já está sendo processado
    if (processingId) return;
    
    // Find the item to print before marking ready
    const itemToPrint = inOvenItems.find(i => i.id === itemId);
    
    setProcessingId(itemId);
    
    // Timeout de segurança: liberar após 5 segundos para evitar travamento
    processingTimeoutRef.current = setTimeout(() => {
      setProcessingId(null);
    }, 5000);
    
    try {
      await markItemReady.mutateAsync(itemId);
      
      // Print dispatch ticket if enabled
      if (printEnabled && dispatchPrintEnabled && printerId && itemToPrint) {
        try {
          const ticketContent = formatDispatchTicket(itemToPrint);
          await printRaw(printerId, ticketContent, `Despacho #${itemToPrint.orders?.cardapioweb_order_id || itemId.slice(0, 8)}`);
        } catch (printError) {
          console.error('Erro ao imprimir ticket de despacho:', printError);
          // Don't block the flow for print errors
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

  // Sort by exit time (soonest first)
  const sortedItems = [...inOvenItems].sort((a, b) => {
    const aTime = a.estimated_exit_at ? new Date(a.estimated_exit_at).getTime() : Infinity;
    const bTime = b.estimated_exit_at ? new Date(b.estimated_exit_at).getTime() : Infinity;
    return aTime - bTime;
  });

  if (sortedItems.length === 0) {
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
              {sortedItems.length}
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
      <CardContent className="space-y-2">
        {sortedItems.map((item) => (
          <OvenItemRow
            key={item.id}
            item={item}
            onMarkReady={() => handleMarkReady(item.id)}
            isProcessing={processingId === item.id}
            isAnyProcessing={processingId !== null}
            audioEnabled={audioEnabled}
            ovenTimeSeconds={ovenTimeSeconds}
          />
        ))}
      </CardContent>
    </Card>
  );
}
