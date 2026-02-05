import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OrderWithGroup } from '@/types/orders';
import { Loader2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const getOrderTypeBadge = (type?: string) => {
  const config: Record<string, { label: string; className: string }> = {
    'delivery': { label: '🛵 Delivery', className: 'bg-blue-500 hover:bg-blue-500' },
    'dine_in': { label: '🍽️ Mesa', className: 'bg-green-500 hover:bg-green-500' },
    'takeaway': { label: '📦 Retirada', className: 'bg-orange-500 hover:bg-orange-500' },
    'takeout': { label: '📦 Retirada', className: 'bg-orange-500 hover:bg-orange-500' },
    'counter': { label: '🏪 Balcão', className: 'bg-purple-500 hover:bg-purple-500' },
    'table': { label: '🍽️ Mesa', className: 'bg-green-500 hover:bg-green-500' },
  };
  return config[type || 'delivery'] || config['delivery'];
};

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

export function OrderCard({
  order,
  onMarkReady,
  onForceDispatch,
  onMarkCollected,
  onRetryNotification,
  onForceClose,
  isMarkingReady = false,
  isMarkingCollected = false,
  isForceClosing = false,
}: OrderCardProps) {
  const [elapsedTime, setElapsedTime] = useState('');

  const orderNumber = order.cardapioweb_order_id || order.external_id || order.id.slice(0, 8);
  const storeName = order.stores?.name || 'Loja';
  const customerName = order.customer_name;

  useEffect(() => {
    const calculateElapsed = () => {
      const startTime = new Date(order.created_at).getTime();
      const now = Date.now();
      const diffMs = now - startTime;
      
      const minutes = Math.floor(diffMs / 60000);
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      
      if (hours > 0) {
        return `${hours}h ${remainingMinutes}min`;
      }
      return `${minutes}min`;
    };

    setElapsedTime(calculateElapsed());
    
    const interval = setInterval(() => {
      setElapsedTime(calculateElapsed());
    }, 30000);

    return () => clearInterval(interval);
  }, [order.created_at]);

  // Determine which action button to show
  const showMarkReady = onMarkReady;
  const showMarkCollected = onMarkCollected;
  const showForceDispatch = onForceDispatch;
  const showForceClose = onForceClose;
  const showRetryNotification = onRetryNotification && order.notification_error;

  return (
    <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur">
      <CardContent className="p-3 text-center">
        {/* Order Number and Elapsed Time */}
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="text-amber-400 text-3xl font-bold">
            #{orderNumber}
          </div>
          <div className="flex items-center gap-1 text-orange-400 text-sm font-medium">
            <Clock className="h-3 w-3" />
            {elapsedTime}
          </div>
        </div>

        {/* Order Type Badge */}
        {(() => {
          const badge = getOrderTypeBadge(order.order_type);
          return (
            <Badge className={`${badge.className} text-white text-xs mb-1`}>
              {badge.label}
            </Badge>
          );
        })()}
        
        {/* Store Name */}
        <div className="text-white/90 text-sm font-medium mb-0.5">
          {storeName}
        </div>
        
        {/* Customer Name */}
        <div className="text-white/60 text-xs mb-2">
          {customerName}
        </div>

        {/* Neighborhood */}
        {order.neighborhood && (
          <div className="text-white/40 text-xs mb-1">
            {order.neighborhood}
          </div>
        )}

        {/* Error indicator */}
        {order.notification_error && (
          <div className="text-red-400 text-xs mb-1 bg-red-500/10 px-2 py-1 rounded-lg">
            Erro na notificação
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-1">
          {showMarkReady && (
          <Button
            onClick={onMarkReady}
            disabled={isMarkingReady}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-full text-sm shadow-lg shadow-green-500/20 h-auto whitespace-normal min-h-[28px]"
          >
              {isMarkingReady ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  PROCESSANDO...
                </>
              ) : (
                'PRONTO'
              )}
            </Button>
          )}

          {showForceDispatch && (
            <Button
              onClick={onForceDispatch}
              variant="outline"
              className="w-full border-orange-500 text-orange-500 hover:bg-orange-500/10 font-bold py-3 px-6 rounded-full h-auto whitespace-normal min-h-[48px]"
            >
              FORÇAR ENVIO
            </Button>
          )}

          {showMarkCollected && (
            <Button
              onClick={onMarkCollected}
              disabled={isMarkingCollected}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-6 rounded-full text-lg shadow-lg shadow-purple-500/20 h-auto whitespace-normal min-h-[56px]"
            >
              {isMarkingCollected ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  PROCESSANDO...
                </>
              ) : (
                'MOTOBOY COLETOU'
              )}
            </Button>
          )}

          {showRetryNotification && (
            <Button
              onClick={onRetryNotification}
              variant="outline"
              className="w-full border-orange-500 text-orange-500 hover:bg-orange-500/10 font-medium rounded-full"
            >
              REENVIAR NOTIFICAÇÃO
            </Button>
          )}

          {showForceClose && (
            <Button
              onClick={onForceClose}
              disabled={isForceClosing}
              variant="ghost"
              className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 text-sm"
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
      </CardContent>
    </Card>
  );
}
