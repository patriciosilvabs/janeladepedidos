import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, AlertTriangle } from 'lucide-react';
import { OrderItemWithOrder } from '@/types/orderItems';

interface OvenItemRowProps {
  item: OrderItemWithOrder;
  onMarkReady: () => void;
  isProcessing: boolean;
  isAnyProcessing: boolean;
  audioEnabled: boolean;
  ovenTimeSeconds: number;
  isMarkedReady?: boolean;
}

export function OvenItemRow({ item, onMarkReady, isProcessing, isAnyProcessing, audioEnabled, ovenTimeSeconds, isMarkedReady }: OvenItemRowProps) {
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isFinished = countdown === 0;
  const isUrgent = countdown <= 10 && countdown > 0;
  const progressPercent = Math.max(0, Math.min(100, (countdown / ovenTimeSeconds) * 100));
  const alreadyReady = isMarkedReady || item.status === 'ready';

  // Parse flavors for display only
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
          ? "border-red-600 bg-red-600/20 animate-[pulse_0.5s_ease-in-out_infinite]" 
          : isUrgent 
            ? "border-red-500 bg-red-500/10 animate-pulse" 
            : "border-orange-500/30 bg-orange-500/5"
    )}>
      {/* Progress bar background */}
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
        {/* Timer */}
        {alreadyReady ? (
          <div className="flex items-center gap-2 font-mono text-2xl font-bold min-w-[80px] text-green-500">
            <Check className="h-5 w-5" />
            OK
          </div>
        ) : (
          <div className={cn(
            "flex items-center gap-2 font-mono text-2xl font-bold min-w-[80px]",
            isFinished ? "text-red-600" : isUrgent ? "text-red-500" : "text-orange-500"
          )}>
            {(isFinished || isUrgent) && <AlertTriangle className="h-5 w-5 animate-bounce" />}
            {formatTime(countdown)}
          </div>
        )}

        {/* Item info */}
        <div className="flex-1 min-w-0">
          <p className="text-xl font-bold text-foreground truncate">
            {item.quantity > 1 && <span className="text-primary">{item.quantity}x </span>}
            {item.product_name}
          </p>
          {flavorsList.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {flavorsList.map((flavor, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-sm font-medium border bg-muted/50 border-border text-foreground"
                >
                  {flavor}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action */}
        {alreadyReady ? (
          <Badge className="bg-green-600 text-white shrink-0 text-base px-3 py-1">
            <Check className="h-4 w-4 mr-1" />
            PRONTO
          </Badge>
        ) : (
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
        )}
      </div>
    </div>
  );
}
