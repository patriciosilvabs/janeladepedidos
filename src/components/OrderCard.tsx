import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OrderWithGroup } from '@/types/orders';
import { Loader2 } from 'lucide-react';
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
  const orderNumber = order.cardapioweb_order_id || order.external_id || order.id.slice(0, 8);
  const storeName = order.stores?.name || 'Loja';
  const customerName = order.customer_name;

  // Determine which action button to show
  const showMarkReady = onMarkReady;
  const showMarkCollected = onMarkCollected;
  const showForceDispatch = onForceDispatch;
  const showForceClose = onForceClose;
  const showRetryNotification = onRetryNotification && order.notification_error;

  return (
    <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur">
      <CardContent className="p-6 text-center">
        {/* Order Number - Large with glow */}
        <div className="order-number-glow text-5xl font-bold mb-4">
          #{orderNumber}
        </div>
        
        {/* Store Name */}
        <div className="text-white/90 text-lg font-medium mb-1">
          {storeName}
        </div>
        
        {/* Customer Name */}
        <div className="text-white/60 mb-6">
          {customerName}
        </div>

        {/* Neighborhood */}
        {order.neighborhood && (
          <div className="text-white/40 text-sm mb-4">
            {order.neighborhood}
          </div>
        )}

        {/* Error indicator */}
        {order.notification_error && (
          <div className="text-red-400 text-sm mb-4 bg-red-500/10 px-3 py-2 rounded-lg">
            Erro na notificação
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          {showMarkReady && (
          <Button
            onClick={onMarkReady}
            disabled={isMarkingReady}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-full text-lg shadow-lg shadow-green-500/20 h-auto"
          >
              {isMarkingReady ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  PROCESSANDO...
                </>
              ) : (
                'MARCAR COMO PRONTO'
              )}
            </Button>
          )}

          {showForceDispatch && (
            <Button
              onClick={onForceDispatch}
              variant="outline"
              className="w-full border-orange-500 text-orange-500 hover:bg-orange-500/10 font-bold py-3 px-6 rounded-full h-auto"
            >
              FORÇAR ENVIO
            </Button>
          )}

          {showMarkCollected && (
            <Button
              onClick={onMarkCollected}
              disabled={isMarkingCollected}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-6 rounded-full text-lg shadow-lg shadow-purple-500/20 h-auto"
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
