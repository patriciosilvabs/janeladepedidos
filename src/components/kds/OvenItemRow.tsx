import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { OrderItemWithOrder } from '@/types/orderItems';
import { OrderTypeBadge } from '@/lib/orderTypeUtils';

interface OvenItemRowProps {
  item: OrderItemWithOrder;
  onMarkReady: () => void;
  isProcessing: boolean;
  isAnyProcessing: boolean;
  audioEnabled: boolean;
  ovenTimeSeconds: number;
  isMarkedReady?: boolean;
  orderDisplayId?: string;
}

export function OvenItemRow({ item, onMarkReady, isProcessing, isAnyProcessing, audioEnabled, ovenTimeSeconds, isMarkedReady, orderDisplayId }: OvenItemRowProps) {
  const [countdown, setCountdown] = useState<number>(ovenTimeSeconds);
  const [hasPlayedAlert, setHasPlayedAlert] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [item.estimated_exit_at, hasPlayedAlert, audioEnabled]);


  const isFinished = countdown === 0;
  const isUrgent = countdown <= 10 && countdown > 0;
  const progressPercent = Math.max(0, Math.min(100, (countdown / ovenTimeSeconds) * 100));
  const alreadyReady = isMarkedReady || item.status === 'ready';

  const flavorsList = item.flavors
    ?.split('\n')
    .map(f => f.replace(/^[•*\-]\s*/, '').trim())
    .filter(Boolean) || [];

  return (
    <div className={cn(
      "relative p-3 rounded-lg border-2 transition-all",
      alreadyReady
        ? "border-green-500 bg-green-500/10"
        : isFinished 
          ? "border-red-600 bg-red-600/20" 
          : isUrgent 
            ? "border-red-500 bg-red-500/10" 
            : "border-orange-500/30 bg-orange-500/5"
    )}>
      {!alreadyReady && (
        <div 
          className={cn(
            "absolute inset-0 rounded-lg transition-all opacity-20",
            isUrgent ? "bg-red-500" : "bg-orange-500"
          )}
          style={{ width: `${100 - progressPercent}%` }}
        />
      )}

      <div className="relative flex items-center gap-3">

        {/* Item info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {orderDisplayId && (
              <span className="text-2xl font-bold shrink-0 bg-foreground text-background px-2 py-0.5 rounded">#{orderDisplayId}</span>
            )}
            <OrderTypeBadge orderType={item.orders?.order_type} className="text-base px-3 py-1" />
          </div>
          <p className="text-2xl font-bold text-foreground truncate mt-1">
            {item.quantity > 1 && <span className="text-primary">{item.quantity}x </span>}
            {item.product_name}
          </p>
          {flavorsList.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {flavorsList.map((flavor, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-base font-medium border bg-muted/50 border-border text-foreground"
                >
                  {flavor}
                </span>
              ))}
            </div>
          )}
          {item.edge_type && (
            <div className="mt-1 p-1.5 bg-orange-600 rounded-md animate-pulse w-fit">
              <p className="text-base text-white font-bold whitespace-pre-line">{item.edge_type}</p>
            </div>
          )}
          {item.complements && (
            <p className="mt-1 text-base text-muted-foreground whitespace-pre-line">{item.complements}</p>
          )}
          {item.notes && (
            <div className="mt-1 p-1.5 bg-red-600 rounded-md animate-pulse w-fit">
              <p className="text-base text-white font-bold uppercase">⚠️ OBS: {item.notes}</p>
            </div>
          )}
        </div>

        {/* Action */}
        {alreadyReady ? (
          <Badge className="bg-green-600 text-white shrink-0 text-lg px-4 py-1.5">
            <Check className="h-5 w-5 mr-1" />
            PRONTO
          </Badge>
        ) : (
          <Button
            onClick={onMarkReady}
            disabled={isProcessing || isAnyProcessing}
            className={cn(
              "text-white shrink-0 text-lg px-4 py-2",
              isProcessing 
                ? "bg-gray-500"
                : isUrgent 
                ? "bg-red-600 hover:bg-red-700" 
                : "bg-blue-600 hover:bg-blue-700"
            )}
          >
            <Check className="h-5 w-5 mr-1" />
            {isProcessing ? 'SALVANDO...' : 'PRONTO'}
          </Button>
        )}
      </div>
    </div>
  );
}
