import { useState, useEffect, useRef } from 'react';
import { useOrderItems } from '@/hooks/useOrderItems';
import { useSettings } from '@/hooks/useSettings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Flame, Check, Volume2, VolumeX, AlertTriangle } from 'lucide-react';
import { OrderItemWithOrder } from '@/types/orderItems';

// Print receipt function
const printOrderReceipt = (item: OrderItemWithOrder) => {
  const orderId = item.orders?.cardapioweb_order_id || 
                  item.orders?.external_id || 
                  item.order_id.slice(0, 8);

  const printWindow = window.open('', '_blank', 'width=300,height=400');
  if (!printWindow) return;

  const content = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Comanda #${orderId}</title>
      <style>
        body { font-family: monospace; padding: 10px; font-size: 14px; }
        .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; }
        .order-id { font-size: 24px; font-weight: bold; }
        .item { font-size: 18px; font-weight: bold; margin: 15px 0; }
        .customer { margin-top: 10px; }
        .address { margin-top: 5px; font-size: 12px; }
        .footer { text-align: center; margin-top: 15px; border-top: 1px dashed #000; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="order-id">#${orderId}</div>
        ${item.orders?.stores?.name ? `<div>${item.orders.stores.name}</div>` : ''}
      </div>
      <div class="item">
        ${item.quantity > 1 ? item.quantity + 'x ' : ''}${item.product_name}
      </div>
      ${item.notes ? `<div style="color: red; font-weight: bold;">OBS: ${item.notes}</div>` : ''}
      <div class="customer">
        <strong>${item.orders?.customer_name || 'Cliente'}</strong>
      </div>
      <div class="address">
        ${item.orders?.address || ''}
        ${item.orders?.neighborhood ? ' - ' + item.orders.neighborhood : ''}
      </div>
      <div class="footer">
        ${new Date().toLocaleString('pt-BR')}
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(content);
  printWindow.document.close();
  printWindow.print();
};

interface OvenItemRowProps {
  item: OrderItemWithOrder;
  onMarkReady: () => void;
  isProcessing: boolean;
  audioEnabled: boolean;
  ovenTimeSeconds: number;
}

function OvenItemRow({ item, onMarkReady, isProcessing, audioEnabled, ovenTimeSeconds }: OvenItemRowProps) {
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
          disabled={isProcessing}
          className={cn(
            "text-white shrink-0",
            isUrgent 
              ? "bg-red-600 hover:bg-red-700" 
              : "bg-green-600 hover:bg-green-700"
          )}
        >
          <Check className="h-4 w-4 mr-1" />
          PRONTO
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
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Get oven time from settings
  const ovenTimeSeconds = settings?.oven_time_seconds ?? 120;

  const handleMarkReady = async (itemId: string) => {
    setProcessingId(itemId);
    try {
      // Find item for printing before marking ready
      const item = sortedItems.find(i => i.id === itemId);
      
      await markItemReady.mutateAsync(itemId);
      
      // Print receipt after marking ready
      if (item) {
        printOrderReceipt(item);
      }
    } catch (error) {
      console.error('Erro ao marcar item como pronto:', error);
    } finally {
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
            audioEnabled={audioEnabled}
            ovenTimeSeconds={ovenTimeSeconds}
          />
        ))}
      </CardContent>
    </Card>
  );
}
