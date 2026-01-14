import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OrderWithGroup } from '@/types/orders';
import { Clock, MapPin, User, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderCardProps {
  order: OrderWithGroup;
  onMarkReady?: () => void;
  onForceDispatch?: () => void;
  onMarkCollected?: () => void;
  onRetryNotification?: () => void;
  showTimer?: boolean;
  timerDuration?: number;
  isMarkingReady?: boolean;
  isMarkingCollected?: boolean;
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
  onMarkCollected,
  onRetryNotification,
  showTimer = false,
  timerDuration = 600,
  isMarkingReady = false,
  isMarkingCollected = false,
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
      <CardContent className="p-4">
        {/* Linha 1: Número do pedido + Tempo */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono font-bold text-primary text-lg">
            #{order.cardapioweb_order_id || order.external_id || order.id.slice(0, 8)}
          </span>
          {timeAgo && (
            <span className="text-sm text-muted-foreground">
              {timeAgo}
            </span>
          )}
        </div>

        {/* Linha 2: Loja */}
        {order.stores?.name && (
          <div className="mb-2">
            <Badge variant="secondary" className="text-xs font-medium">
              {order.stores.name}
            </Badge>
          </div>
        )}

        {/* Linha 3: Nome do cliente + Bairro */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-foreground">{order.customer_name}</span>
          </div>
          {order.neighborhood && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="text-xs">{order.neighborhood}</span>
            </div>
          )}
        </div>

        {/* Timer (se aplicável) */}
        {showTimer && timeLeft !== null && (
          <div
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg bg-muted/50 py-3 font-mono text-2xl font-bold mt-3',
              getTimerColor()
            )}
          >
            {isUrgent && <AlertTriangle className="h-5 w-5" />}
            <Clock className="h-5 w-5" />
            <span>{formatCountdown(timeLeft)}</span>
          </div>
        )}

        {/* Erro de notificação */}
        {order.notification_error && (
          <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 border border-destructive/30 mt-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-xs text-destructive">Falha na notificação</span>
          </div>
        )}

        {/* Botões de ação */}
        {(onMarkReady || onForceDispatch || onMarkCollected || (onRetryNotification && order.notification_error)) && (
          <div className="flex gap-2 mt-3">
            {onMarkReady && (
              <Button
                onClick={onMarkReady}
                disabled={isMarkingReady}
                className="w-full bg-green-600 hover:bg-green-700"
                size="default"
              >
                {isMarkingReady ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    PROCESSANDO...
                  </>
                ) : (
                  'MARCAR COMO PRONTO'
                )}
              </Button>
            )}
            {onForceDispatch && (
              <Button
                onClick={onForceDispatch}
                variant="destructive"
                className="w-full"
                size="default"
              >
                FORÇAR ENVIO
              </Button>
            )}
            {onMarkCollected && (
              <Button
                onClick={onMarkCollected}
                disabled={isMarkingCollected}
                className="w-full bg-purple-600 hover:bg-purple-700"
                size="default"
              >
                {isMarkingCollected ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    PROCESSANDO...
                  </>
                ) : (
                  'MOTOBOY COLETOU'
                )}
              </Button>
            )}
            {onRetryNotification && order.notification_error && (
              <Button
                onClick={onRetryNotification}
                variant="outline"
                className="w-full border-orange-500 text-orange-500 hover:bg-orange-500/10"
                size="default"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                REENVIAR
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
