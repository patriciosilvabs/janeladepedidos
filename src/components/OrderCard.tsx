import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OrderWithGroup } from '@/types/orders';
import { Clock, MapPin, User, AlertTriangle, RefreshCw, Loader2, Bike, Cloud, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderCardProps {
  order: OrderWithGroup;
  onMarkReady?: () => void;
  onForceDispatch?: () => void;
  onMarkCollected?: () => void;
  onRetryNotification?: () => void;
  onRetryFoody?: () => void;
  onForceClose?: () => void;
  showTimer?: boolean;
  timerDuration?: number;
  isMarkingReady?: boolean;
  isMarkingCollected?: boolean;
  isRetryingFoody?: boolean;
  isForceClosing?: boolean;
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

function getFoodyStatusInfo(status: string | null) {
  switch (status) {
    case 'open':
      return { label: 'Aguardando Motoboy', colorClass: 'text-blue-500 bg-blue-500/10 border-blue-500/30' };
    case 'assigned':
      return { label: 'Motoboy Atribuído', colorClass: 'text-purple-500 bg-purple-500/10 border-purple-500/30' };
    case 'collected':
      return { label: 'Coletado', colorClass: 'text-orange-500 bg-orange-500/10 border-orange-500/30' };
    case 'on_the_way':
      return { label: 'Em Rota', colorClass: 'text-yellow-600 bg-yellow-500/10 border-yellow-500/30' };
    case 'delivered':
      return { label: 'Entregue', colorClass: 'text-green-500 bg-green-500/10 border-green-500/30' };
    case 'cancelled':
      return { label: 'Cancelado', colorClass: 'text-red-500 bg-red-500/10 border-red-500/30' };
    default:
      return null;
  }
}

export function OrderCard({
  order,
  onMarkReady,
  onForceDispatch,
  onMarkCollected,
  onRetryNotification,
  onRetryFoody,
  onForceClose,
  showTimer = false,
  timerDuration = 600,
  isMarkingReady = false,
  isMarkingCollected = false,
  isRetryingFoody = false,
  isForceClosing = false,
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
  const foodyStatus = getFoodyStatusInfo(order.foody_status);

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

        {/* Linha 2: Loja + Indicador CardápioWeb */}
        <div className="flex items-center justify-between mb-2">
          {order.stores?.name && (
            <Badge variant="secondary" className="text-xs font-medium">
              {order.stores.name}
            </Badge>
          )}
          
          {/* Indicador de status CardápioWeb */}
          {order.external_id && (
            <div className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded text-xs',
              order.cardapioweb_notified 
                ? 'text-green-600 bg-green-500/10' 
                : order.notification_error
                  ? 'text-red-500 bg-red-500/10'
                  : 'text-muted-foreground bg-muted/50'
            )}>
              {order.cardapioweb_notified ? (
                <>
                  <CheckCircle className="h-3 w-3" />
                  <span>Notificado</span>
                </>
              ) : order.notification_error ? (
                <>
                  <XCircle className="h-3 w-3" />
                  <span>Erro</span>
                </>
              ) : (
                <>
                  <Cloud className="h-3 w-3" />
                  <span>Pendente</span>
                </>
              )}
            </div>
          )}
        </div>

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

        {/* Status do Foody */}
        {order.foody_uid && foodyStatus && (
          <div className={cn(
            'flex items-center gap-2 p-2 rounded border mt-3',
            foodyStatus.colorClass
          )}>
            <Bike className="h-4 w-4" />
            <span className="text-xs font-medium">{foodyStatus.label}</span>
          </div>
        )}

        {/* Erro do Foody */}
        {order.foody_error && (
          <div className="flex items-center gap-2 p-2 rounded bg-orange-500/10 border border-orange-500/30 mt-3">
            <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
            <span className="text-xs text-orange-600 flex-1 truncate" title={order.foody_error}>
              Erro Foody: {order.foody_error}
            </span>
            {onRetryFoody && (
              <Button
                onClick={onRetryFoody}
                variant="ghost"
                size="sm"
                disabled={isRetryingFoody}
                className="shrink-0 h-6 px-2 text-orange-600 hover:text-orange-700 hover:bg-orange-500/20"
              >
                {isRetryingFoody ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        )}

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
        {(onMarkReady || onForceDispatch || onMarkCollected || (onRetryNotification && order.notification_error) || onForceClose) && (
          <div className="flex flex-col gap-2 mt-3">
            <div className="flex gap-2">
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
            
            {/* Botão Forçar Fechamento - linha separada */}
            {onForceClose && (
              <Button
                onClick={onForceClose}
                disabled={isForceClosing}
                variant="outline"
                className="w-full border-red-500 text-red-500 hover:bg-red-500/10"
                size="sm"
              >
                {isForceClosing ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    FECHANDO...
                  </>
                ) : (
                  'FORÇAR FECHAMENTO'
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
