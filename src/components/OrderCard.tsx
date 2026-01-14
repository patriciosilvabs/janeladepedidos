import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OrderWithGroup } from '@/types/orders';
import { Clock, MapPin, Phone, User, Package, AlertTriangle, Timer, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderCardProps {
  order: OrderWithGroup;
  onMarkReady?: () => void;
  onForceDispatch?: () => void;
  onRetryNotification?: () => void;
  showTimer?: boolean;
  timerDuration?: number;
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

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Agora';
  if (diffMins < 60) return `Há ${diffMins} min`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Há ${diffHours}h ${diffMins % 60}min`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `Há ${diffDays}d ${diffHours % 24}h`;
}

function formatTime(dateString: string | null): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function OrderCard({
  order,
  onMarkReady,
  onForceDispatch,
  onRetryNotification,
  showTimer = false,
  timerDuration = 600,
}: OrderCardProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timeAgo, setTimeAgo] = useState<string>('');

  useEffect(() => {
    const orderTime = order.cardapioweb_created_at || order.created_at;
    setTimeAgo(formatTimeAgo(orderTime));

    const interval = setInterval(() => {
      setTimeAgo(formatTimeAgo(orderTime));
    }, 60000);

    return () => clearInterval(interval);
  }, [order.cardapioweb_created_at, order.created_at]);

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

  const formatCountdown = (seconds: number) => {
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
  const orderTime = order.cardapioweb_created_at || order.created_at;

  return (
    <Card
      className={cn(
        'border-border/50 bg-card/80 backdrop-blur transition-all duration-300',
        isUrgent && 'border-red-500/50 shadow-red-500/20 shadow-lg'
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-mono font-bold text-primary">
            #{order.cardapioweb_order_id || order.external_id || order.id.slice(0, 8)}
          </span>
          <div className="flex items-center gap-2">
            {timeAgo && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Timer className="h-3 w-3" />
                {timeAgo}
                {orderTime && (
                  <span className="text-muted-foreground/70">
                    ({formatTime(orderTime)})
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between text-xs mb-1">
          {order.stores?.name && (
            <Badge variant="secondary" className="text-xs">
              {order.stores.name}
            </Badge>
          )}
        </div>
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
            <span>{formatCountdown(timeLeft)}</span>
          </div>
        )}

        {order.notification_error && (
          <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 border border-destructive/30">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-xs text-destructive">Falha na notificação</span>
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
          {onRetryNotification && order.notification_error && (
            <Button
              onClick={onRetryNotification}
              variant="outline"
              className="w-full border-orange-500 text-orange-500 hover:bg-orange-500/10"
              size="lg"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              REENVIAR NOTIFICAÇÃO
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
