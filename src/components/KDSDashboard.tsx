import { useMemo, useState, useEffect } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { useSettings } from '@/hooks/useSettings';
import { Check, Loader2, AlertCircle, Clock, AlertTriangle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { OrderWithGroup } from '@/types/orders';
import { Badge } from '@/components/ui/badge';

interface KDSOrderCardProps {
  order: OrderWithGroup;
  onMarkReady: () => void;
  onMarkReadyUrgent: () => void;
  isProcessing: boolean;
  isUrgent: boolean;
  urgentTimeoutMinutes: number;
}

function KDSOrderCard({ order, onMarkReady, onMarkReadyUrgent, isProcessing, isUrgent, urgentTimeoutMinutes }: KDSOrderCardProps) {
  const [minutesAgo, setMinutesAgo] = useState(0);

  // Update elapsed time every 30 seconds
  useEffect(() => {
    const calculateMinutes = () => {
      const created = new Date(order.created_at);
      const now = new Date();
      const diffMs = now.getTime() - created.getTime();
      return Math.floor(diffMs / 60000);
    };

    setMinutesAgo(calculateMinutes());
    const interval = setInterval(() => setMinutesAgo(calculateMinutes()), 30000);
    return () => clearInterval(interval);
  }, [order.created_at]);

  const orderId = order.cardapioweb_order_id || order.external_id || order.id.slice(0, 8);

  // Handle click - use urgent bypass if order is urgent
  const handleClick = () => {
    if (isUrgent) {
      onMarkReadyUrgent();
    } else {
      onMarkReady();
    }
  };

  return (
    <div className={cn(
      "bg-card border rounded-lg pt-2 px-2 pb-0 flex flex-col shadow-sm transition-all duration-300",
      isUrgent 
        ? "border-red-500 border-2 ring-2 ring-red-500/20 animate-pulse" 
        : "border-border"
    )}>
      {/* Urgent Badge */}
      {isUrgent && (
        <div className="flex justify-center mb-1">
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-0.5 animate-bounce">
            <AlertTriangle className="h-2.5 w-2.5" />
            URGENTE
          </Badge>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className={cn(
          "text-2xl font-bold",
          isUrgent ? "text-red-500" : "text-amber-400"
        )}>
          #{orderId}
        </span>
        <div className={cn(
          "flex items-center gap-0.5",
          isUrgent ? "text-red-500" : "text-muted-foreground"
        )}>
          <Clock className="h-3 w-3" />
          <span className={cn(
            "text-xs font-medium",
            isUrgent && "font-bold"
          )}>
            {minutesAgo}min
          </span>
        </div>
      </div>

      {/* Store Name */}
      {order.stores?.name && (
        <p className="text-[10px] text-primary font-medium uppercase tracking-wide mb-1 truncate text-center">
          {order.stores.name}
        </p>
      )}

      {/* Customer Info */}
      <div className="space-y-0.5 text-center">
        <p className="text-xs font-medium text-foreground truncate">
          {order.customer_name}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">
          {order.neighborhood || order.address}
        </p>
      </div>

      {/* Action Button */}
      <Button
        onClick={handleClick}
        disabled={isProcessing}
        className={cn(
          "w-full font-bold py-1.5 text-sm rounded-t-none rounded-b-md text-white",
          isUrgent 
            ? "bg-red-600 hover:bg-red-700" 
            : "bg-green-600 hover:bg-green-700"
        )}
        size="sm"
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isUrgent ? (
          <>
            <Zap className="h-4 w-4 mr-1" />
            ENVIAR JÁ
          </>
        ) : (
          <>
            <Check className="h-4 w-4 mr-1" />
            PRONTO
          </>
        )}
      </Button>
    </div>
  );
}

export function KDSDashboard() {
  const { orders, isLoading, error, markAsReady, markAsReadyUrgent } = useOrders();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  // Get urgency settings from app_settings
  const urgentTimeoutMinutes = (settings as any)?.urgent_production_timeout_minutes ?? 25;
  const urgentBypassEnabled = (settings as any)?.urgent_bypass_enabled ?? true;

  // Calculate if an order is urgent (exceeds timeout)
  const isOrderUrgent = (order: OrderWithGroup): boolean => {
    if (!urgentBypassEnabled) return false;
    const created = new Date(order.created_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - created.getTime()) / 60000;
    return diffMinutes >= urgentTimeoutMinutes;
  };

  // Only show pending orders in KDS view
  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === 'pending'),
    [orders]
  );

  // Count urgent orders
  const urgentCount = useMemo(
    () => pendingOrders.filter(isOrderUrgent).length,
    [pendingOrders, urgentTimeoutMinutes, urgentBypassEnabled]
  );

  const handleMarkReady = async (orderId: string) => {
    setProcessingOrderId(orderId);
    try {
      await markAsReady.mutateAsync(orderId);
      toast({
        title: 'Pedido pronto!',
        description: 'Adicionado ao buffer de espera.',
      });
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Não foi possível marcar o pedido como pronto.',
        variant: 'destructive',
      });
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleMarkReadyUrgent = async (orderId: string) => {
    setProcessingOrderId(orderId);
    try {
      await markAsReadyUrgent.mutateAsync(orderId);
      toast({
        title: '⚡ Pedido urgente enviado!',
        description: 'Bypass do buffer - enviado diretamente para entrega.',
      });
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar o pedido urgente.',
        variant: 'destructive',
      });
    } finally {
      setProcessingOrderId(null);
    }
  };

  if (isLoading && orders.length === 0) {
    return (
      <div className="flex h-[calc(100vh-5rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[calc(100vh-5rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-destructive">
          <AlertCircle className="h-12 w-12" />
          <p>Erro ao carregar pedidos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] p-4">
      {/* Header Stats */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-foreground">
            Pedidos em Produção
          </span>
          <span className={cn(
            "px-3 py-1 rounded-full text-sm font-bold",
            pendingOrders.length > 0 
              ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
              : "bg-muted text-muted-foreground"
          )}>
            {pendingOrders.length}
          </span>
          {urgentCount > 0 && (
            <Badge variant="destructive" className="gap-1 animate-pulse">
              <AlertTriangle className="h-3 w-3" />
              {urgentCount} URGENTE{urgentCount > 1 ? 'S' : ''}
            </Badge>
          )}
        </div>
        {urgentBypassEnabled && (
          <div className="text-xs text-muted-foreground">
            Limite: {urgentTimeoutMinutes} min
          </div>
        )}
      </div>

      {/* Orders Grid */}
      {pendingOrders.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Check className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-xl font-medium">Nenhum pedido em produção</p>
            <p className="text-sm mt-2">Novos pedidos aparecerão aqui automaticamente</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 overflow-y-auto flex-1 items-start content-start">
          {pendingOrders.map((order) => {
            const isUrgent = isOrderUrgent(order);
            return (
              <KDSOrderCard
                key={order.id}
                order={order}
                onMarkReady={() => handleMarkReady(order.id)}
                onMarkReadyUrgent={() => handleMarkReadyUrgent(order.id)}
                isProcessing={processingOrderId === order.id}
                isUrgent={isUrgent}
                urgentTimeoutMinutes={urgentTimeoutMinutes}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
