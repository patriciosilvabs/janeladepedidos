import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OrderWithGroup } from '@/types/orders';
import { Clock, MapPin, Phone, User, Package, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderCardProps {
  order: OrderWithGroup;
  onMarkReady?: () => void;
  onForceDispatch?: () => void;
  showTimer?: boolean;
  timerDuration?: number; // in seconds
}

const GROUP_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-orange-500',
  'bg-red-500',
];

export function OrderCard({
  order,
  onMarkReady,
  onForceDispatch,
  showTimer = false,
  timerDuration = 600, // 10 minutes default
}: OrderCardProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!showTimer || !order.ready_at) return;

    const calculateTimeLeft = () => {
      const readyTime = new Date(order.ready_at!).getTime();
      const endTime = readyTime + timerDuration * 1000;
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      return remaining;
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [showTimer, order.ready_at, timerDuration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (timeLeft === null) return '';
    if (timeLeft <= 0) return 'text-red-500 animate-pulse';
    if (timeLeft <= 120) return 'text-red-400';
    if (timeLeft <= 300) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getGroupColor = () => {
    if (!order.group_id) return '';
    const index = order.group_id.charCodeAt(0) % GROUP_COLORS.length;
    return GROUP_COLORS[index];
  };

  const isUrgent = timeLeft !== null && timeLeft <= 120;

  return (
    <Card
      className={cn(
        'border-border/50 bg-card/80 backdrop-blur transition-all duration-300',
        isUrgent && 'border-red-500/50 shadow-red-500/20 shadow-lg'
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-foreground">{order.customer_name}</span>
          </div>
          <div className="flex items-center gap-2">
            {order.group_id && (
              <Badge className={cn('text-white', getGroupColor())}>
                Grupo {order.group_id.slice(0, 4).toUpperCase()}
              </Badge>
            )}
            {order.delivery_groups && (
              <Badge variant="outline">
                {order.delivery_groups.order_count}/{order.delivery_groups.max_orders}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p>{order.address}</p>
            {order.neighborhood && (
              <p className="text-xs text-muted-foreground/70">{order.neighborhood}</p>
            )}
          </div>
        </div>

        {order.customer_phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>{order.customer_phone}</span>
          </div>
        )}

        {order.total_amount && (
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-foreground">
              R$ {order.total_amount.toFixed(2)}
            </span>
          </div>
        )}

        {showTimer && timeLeft !== null && (
          <div
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg bg-muted/50 py-3 font-mono text-2xl font-bold',
              getTimerColor()
            )}
          >
            {isUrgent && <AlertTriangle className="h-5 w-5" />}
            <Clock className="h-5 w-5" />
            <span>{formatTime(timeLeft)}</span>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {onMarkReady && (
            <Button
              onClick={onMarkReady}
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
            >
              MARCAR COMO PRONTO
            </Button>
          )}
          {onForceDispatch && (
            <Button
              onClick={onForceDispatch}
              variant="destructive"
              className="w-full"
              size="lg"
            >
              FORÇAR ENVIO
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
