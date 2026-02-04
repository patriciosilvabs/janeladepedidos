import { useState, useEffect } from 'react';
import { OrderItemWithOrder } from '@/types/orderItems';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Play, 
  Loader2, 
  Flame, 
  Check, 
  Clock, 
  User,
  XCircle 
} from 'lucide-react';

interface KDSItemCardProps {
  item: OrderItemWithOrder;
  onClaim: () => void;
  onRelease: () => void;
  onSendToOven: () => void;
  onMarkReady: () => void;
  isProcessing: boolean;
  currentUserId?: string;
}

export function KDSItemCard({
  item,
  onClaim,
  onRelease,
  onSendToOven,
  onMarkReady,
  isProcessing,
  currentUserId,
}: KDSItemCardProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [ovenCountdown, setOvenCountdown] = useState<number | null>(null);

  const orderId = item.orders?.cardapioweb_order_id || 
                  item.orders?.external_id || 
                  item.order_id.slice(0, 8);

  const isOwnClaim = item.claimed_by === currentUserId;
  const isClaimed = !!item.claimed_by && item.status === 'in_prep';

  // Elapsed time for pending/in_prep items
  useEffect(() => {
    if (item.status === 'pending' || item.status === 'in_prep') {
      const calculateElapsed = () => {
        const start = item.status === 'in_prep' && item.claimed_at 
          ? new Date(item.claimed_at) 
          : new Date(item.created_at);
        return Math.floor((Date.now() - start.getTime()) / 1000);
      };

      setElapsedTime(calculateElapsed());
      const interval = setInterval(() => setElapsedTime(calculateElapsed()), 1000);
      return () => clearInterval(interval);
    }
  }, [item.status, item.claimed_at, item.created_at]);

  // Countdown for oven items
  useEffect(() => {
    if (item.status === 'in_oven' && item.estimated_exit_at) {
      const calculateRemaining = () => {
        const exit = new Date(item.estimated_exit_at!).getTime();
        const remaining = Math.max(0, Math.floor((exit - Date.now()) / 1000));
        return remaining;
      };

      setOvenCountdown(calculateRemaining());
      const interval = setInterval(() => {
        const remaining = calculateRemaining();
        setOvenCountdown(remaining);
        
        // Auto-complete when timer reaches 0
        if (remaining === 0) {
          onMarkReady();
          clearInterval(interval);
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [item.status, item.estimated_exit_at, onMarkReady]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = () => {
    switch (item.status) {
      case 'pending':
        return 'bg-amber-500/10 border-amber-500/30';
      case 'in_prep':
        return 'bg-blue-500/10 border-blue-500/30';
      case 'in_oven':
        return ovenCountdown && ovenCountdown <= 10 
          ? 'bg-red-500/20 border-red-500 animate-pulse' 
          : 'bg-orange-500/10 border-orange-500/30';
      case 'ready':
        return 'bg-green-500/10 border-green-500/30';
      default:
        return 'bg-muted border-border';
    }
  };

  const renderAction = () => {
    if (isProcessing) {
      return (
        <Button disabled className="w-full">
          <Loader2 className="h-4 w-4 animate-spin" />
        </Button>
      );
    }

    switch (item.status) {
      case 'pending':
        return (
          <Button
            onClick={onClaim}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Play className="h-4 w-4 mr-1" />
            INICIAR
          </Button>
        );

      case 'in_prep':
        if (isOwnClaim) {
          return (
            <div className="flex gap-1">
              <Button
                onClick={onSendToOven}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
              >
                <Flame className="h-4 w-4 mr-1" />
                FORNO
              </Button>
              <Button
                onClick={onRelease}
                variant="outline"
                size="icon"
                className="border-destructive text-destructive hover:bg-destructive/10"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          );
        }
        return (
          <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs py-2">
            <User className="h-3 w-3" />
            Em preparo...
          </div>
        );

      case 'in_oven':
        return (
          <Button
            onClick={onMarkReady}
            className={cn(
              "w-full text-white",
              ovenCountdown && ovenCountdown <= 10
                ? "bg-red-600 hover:bg-red-700 animate-pulse"
                : "bg-green-600 hover:bg-green-700"
            )}
          >
            <Check className="h-4 w-4 mr-1" />
            {ovenCountdown !== null && ovenCountdown > 0 
              ? formatTime(ovenCountdown) 
              : 'PRONTO!'}
          </Button>
        );

      case 'ready':
        return (
          <div className="flex items-center justify-center gap-1 text-green-600 font-medium py-2">
            <Check className="h-4 w-4" />
            Pronto
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={cn(
      "rounded-lg border-2 p-3 transition-all duration-300",
      getStatusColor()
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <Badge variant="outline" className="font-mono text-xs">
          #{orderId}
        </Badge>
        {(item.status === 'pending' || item.status === 'in_prep') && (
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <Clock className="h-3 w-3" />
            {formatTime(elapsedTime)}
          </div>
        )}
        {item.status === 'in_oven' && ovenCountdown !== null && (
          <Badge 
            variant={ovenCountdown <= 10 ? "destructive" : "secondary"}
            className={cn(
              "font-mono",
              ovenCountdown <= 10 && "animate-pulse"
            )}
          >
            <Flame className="h-3 w-3 mr-1" />
            {formatTime(ovenCountdown)}
          </Badge>
        )}
      </div>

      {/* Product Info */}
      <div className="mb-2">
        <h3 className="font-semibold text-foreground truncate">
          {item.quantity > 1 && <span className="text-primary">{item.quantity}x </span>}
          {item.product_name}
        </h3>
        {item.notes && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            📝 {item.notes}
          </p>
        )}
      </div>

      {/* Store & Sector */}
      <div className="flex items-center gap-2 mb-2 text-xs">
        {item.orders?.stores?.name && (
          <span className="text-primary font-medium truncate">
            {item.orders.stores.name}
          </span>
        )}
        {item.sectors?.name && (
          <Badge variant="outline" className="text-[10px]">
            {item.sectors.name}
          </Badge>
        )}
      </div>

      {/* Customer Info */}
      <div className="text-xs text-muted-foreground mb-3 truncate">
        {item.orders?.customer_name} • {item.orders?.neighborhood || item.orders?.address}
      </div>

      {/* Action Button */}
      {renderAction()}
    </div>
  );
}
