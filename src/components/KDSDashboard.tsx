import { useMemo, useState } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { Check, Loader2, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { OrderWithGroup } from '@/types/orders';

interface KDSOrderCardProps {
  order: OrderWithGroup;
  onMarkReady: () => void;
  isProcessing: boolean;
}

function KDSOrderCard({ order, onMarkReady, isProcessing }: KDSOrderCardProps) {
  // Calculate time since order was created
  const minutesAgo = useMemo(() => {
    const created = new Date(order.created_at);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    return Math.floor(diffMs / 60000);
  }, [order.created_at]);

  const orderId = order.cardapioweb_order_id || order.external_id || order.id.slice(0, 8);

  return (
    <div className="bg-card border border-border rounded-lg pt-2 px-2 pb-0 flex flex-col shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className="text-2xl font-bold text-amber-400">#{orderId}</span>
        <div className="flex items-center gap-0.5 text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span className="text-xs font-medium">{minutesAgo}min</span>
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
        onClick={onMarkReady}
        disabled={isProcessing}
        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 text-sm rounded-t-none rounded-b-md"
        size="sm"
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
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
  const { orders, isLoading, error, markAsReady } = useOrders();
  const { toast } = useToast();
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  // Only show pending orders in KDS view
  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === 'pending'),
    [orders]
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
        </div>
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
          {pendingOrders.map((order) => (
            <KDSOrderCard
              key={order.id}
              order={order}
              onMarkReady={() => handleMarkReady(order.id)}
              isProcessing={processingOrderId === order.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
