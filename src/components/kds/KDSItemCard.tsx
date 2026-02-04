import { useState, useEffect } from 'react';
import { OrderItemWithOrder } from '@/types/orderItems';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Play, 
  Loader2, 
  Flame, 
  Clock, 
  User,
  XCircle 
} from 'lucide-react';

interface KDSItemCardProps {
  item: OrderItemWithOrder;
  onClaim: () => void;
  onRelease: () => void;
  onSendToOven: () => void;
  isProcessing: boolean;
  currentUserId?: string;
}

export function KDSItemCard({
  item,
  onClaim,
  onRelease,
  onSendToOven,
  isProcessing,
  currentUserId,
}: KDSItemCardProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  const orderId = item.orders?.cardapioweb_order_id || 
                  item.orders?.external_id || 
                  item.order_id.slice(0, 8);

  const isOwnClaim = item.claimed_by === currentUserId;
  const isValidStatus = item.status === 'pending' || item.status === 'in_prep';

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

  const getStatusColor = () => {
    if (item.status === 'pending') {
      return 'bg-amber-500/10 border-amber-500/30';
    }
    return 'bg-blue-500/10 border-blue-500/30'; // in_prep
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
          className="w-full bg-amber-600 hover:bg-amber-700"
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
      "rounded-lg border-2 p-3 transition-all duration-300",
      getStatusColor()
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <Badge variant="outline" className="font-mono text-xs">
          #{orderId}
        </Badge>
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          <Clock className="h-3 w-3" />
          {formatTime(elapsedTime)}
        </div>
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
