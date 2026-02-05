import { useState, useEffect } from 'react';
import { OrderItemWithOrder } from '@/types/orderItems';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { 
  Play, 
  Loader2, 
  Flame, 
  Clock, 
  User,
  XCircle 
} from 'lucide-react';

export interface FifoSettings {
  enabled: boolean;
  warningMinutes: number;
  criticalMinutes: number;
  lockEnabled: boolean;
}

interface KDSItemCardProps {
  item: OrderItemWithOrder;
  onClaim: () => void;
  onRelease: () => void;
  onSendToOven: () => void;
  isProcessing: boolean;
  currentUserId?: string;
  fifoSettings?: FifoSettings;
  queuePosition?: number;
  canStartItem?: boolean;
}

export function KDSItemCard({
  item,
  onClaim,
  onRelease,
  onSendToOven,
  isProcessing,
  currentUserId,
  fifoSettings,
  queuePosition,
  canStartItem = true,
}: KDSItemCardProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  const orderId = item.orders?.cardapioweb_order_id || 
                  item.orders?.external_id || 
                  item.order_id.slice(0, 8);

  const isOwnClaim = item.claimed_by === currentUserId;
  const isValidStatus = item.status === 'pending' || item.status === 'in_prep';
  
  const isFifoEnabled = fifoSettings?.enabled ?? false;
  const isFirstInQueue = queuePosition === 1;

  // Elapsed time for pending/in_prep items
  useEffect(() => {
    if (!isValidStatus) return;

    const calculateElapsed = () => {
      const start = item.status === 'in_prep' && item.claimed_at 
        ? new Date(item.claimed_at) 
        : new Date(item.created_at);
      return Math.floor((Date.now() - start.getTime()) / 1000);
    };

    setElapsedTime(calculateElapsed());
    const interval = setInterval(() => setElapsedTime(calculateElapsed()), 1000);
    return () => clearInterval(interval);
  }, [item.status, item.claimed_at, item.created_at, isValidStatus]);

  // Only render for pending and in_prep statuses
  if (!isValidStatus) {
    return null;
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Função para cores baseadas no status (modo padrão)
  const getDefaultStatusColor = () => {
    if (item.status === 'in_prep') {
      return 'border-blue-500/50 bg-blue-500/10';
    }
    return 'border-amber-500/50 bg-amber-500/10';
  };

  // Função para cores baseadas no tempo (modo FIFO)
  const getUrgencyColor = () => {
    if (item.status === 'in_prep') {
      return 'border-blue-500 bg-blue-500/10';
    }
    
    const minutes = elapsedTime / 60;
    const warningMinutes = fifoSettings?.warningMinutes ?? 3;
    const criticalMinutes = fifoSettings?.criticalMinutes ?? 5;
    
    if (minutes <= warningMinutes) {
      return 'border-green-500 bg-green-500/10';
    }
    if (minutes <= criticalMinutes) {
      return 'border-amber-500 bg-amber-500/10';
    }
    return 'border-red-500 bg-red-500/10 animate-pulse';
  };

  // Calcula porcentagem de progresso para a barra (modo FIFO)
  const getProgressPercent = () => {
    const criticalMinutes = fifoSettings?.criticalMinutes ?? 5;
    const targetSeconds = criticalMinutes * 60;
    return Math.min((elapsedTime / targetSeconds) * 100, 100);
  };

  const getProgressColor = () => {
    const percent = getProgressPercent();
    if (percent < 60) return '[&>div]:bg-green-500';
    if (percent < 100) return '[&>div]:bg-amber-500';
    return '[&>div]:bg-red-500';
  };

  const renderAction = () => {
    if (isProcessing) {
      return (
        <Button disabled className="w-full">
          <Loader2 className="h-4 w-4 animate-spin" />
        </Button>
      );
    }

    if (item.status === 'pending') {
      return (
        <Button
          onClick={onClaim}
          disabled={!canStartItem}
          className={cn(
            "w-full transition-all",
            canStartItem 
              ? isFifoEnabled && isFirstInQueue
                ? "bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-400 ring-offset-2 ring-offset-background animate-pulse"
                : "bg-amber-600 hover:bg-amber-700"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          <Play className="h-4 w-4 mr-1" />
          INICIAR
        </Button>
      );
    }

    // in_prep status
    if (isOwnClaim) {
      return (
        <div className="flex gap-1">
          <Button
            onClick={onSendToOven}
            className="flex-1 bg-orange-600 hover:bg-orange-700"
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
  };

  return (
    <div className={cn(
      "rounded-lg border-2 p-4 transition-all duration-300 relative",
      isFifoEnabled ? getUrgencyColor() : getDefaultStatusColor(),
    )}>
      {/* Badge de posição na fila (modo FIFO) */}
      {isFifoEnabled && queuePosition && item.status === 'pending' && (
         <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold bg-primary text-primary-foreground shadow-lg">
          #{queuePosition}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <Badge variant="outline" className="font-mono text-base font-bold px-2 py-0.5">
          #{orderId}
        </Badge>
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          <Clock className="h-3 w-3" />
          {formatTime(elapsedTime)}
        </div>
      </div>

      {/* Product Info */}
      <div className="mb-3">
        <h3 className="text-xl font-bold text-foreground leading-tight">
          {item.quantity > 1 && <span className="text-primary">{item.quantity}x </span>}
          {item.product_name}
        </h3>
      </div>

      {/* Barra de progresso (modo FIFO, apenas para pending) */}
      {isFifoEnabled && item.status === 'pending' && (
        <Progress 
          value={getProgressPercent()} 
          className={cn("h-1.5 mb-2", getProgressColor())}
        />
      )}

      {/* Observações com destaque visual */}
      {item.notes && (
        <div className="mb-2 p-2 bg-red-600 rounded-md animate-[pulse_0.8s_ease-in-out_infinite]">
          <p className="text-xs text-white font-bold uppercase">
            ⚠️ {item.notes}
          </p>
        </div>
      )}

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
