import { useMemo } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { usePolling } from '@/hooks/usePolling';
import { useSettings } from '@/hooks/useSettings';
import { OrderColumn } from './OrderColumn';
import { OrderCard } from './OrderCard';
import { GroupCard } from './GroupCard';
import { ChefHat, Clock, Truck, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { OrderWithGroup } from '@/types/orders';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function Dashboard() {
  const { orders, isLoading, error, markAsReady, dispatchGroup, forceDispatch, syncOrdersStatus, retryNotification } =
    useOrders();
  const { settings } = useSettings();
  const { toast } = useToast();
  const { isPolling, lastSync, isEnabled: pollingEnabled, manualPoll } = usePolling(30000);

  // Filter orders by status
  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === 'pending'),
    [orders]
  );

  const bufferOrders = useMemo(
    () => orders.filter((o) => o.status === 'waiting_buffer'),
    [orders]
  );

  const dispatchedOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'dispatched')
        .slice(0, 20), // Show only last 20
    [orders]
  );

  // Group buffer orders by group_id
  const groupedBufferOrders = useMemo(() => {
    const groups: Record<string, OrderWithGroup[]> = {};
    bufferOrders.forEach((order) => {
      if (order.group_id) {
        if (!groups[order.group_id]) {
          groups[order.group_id] = [];
        }
        groups[order.group_id].push(order);
      }
    });
    return groups;
  }, [bufferOrders]);

  const handleMarkReady = async (orderId: string) => {
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
    }
  };

  const handleDispatchGroup = async (groupId: string): Promise<void> => {
    console.log(`[Dashboard] Dispatching group ${groupId}`);
    try {
      const result = await dispatchGroup.mutateAsync(groupId);
      console.log(`[Dashboard] Dispatch result for group ${groupId}:`, result);
      
      if (result.errors > 0) {
        // Orders dispatched, but notification failed
        toast({
          title: 'Grupo despachado com avisos',
          description: `${result.processed} pedido(s) despachado(s). ${result.errors} falha(s) de notificação ao CardápioWeb. Use o botão "Reenviar" para tentar novamente.`,
        });
      } else {
        toast({
          title: 'Grupo despachado!',
          description: `${result.processed} pedido(s) despachado(s) com sucesso.`,
        });
      }
    } catch (err) {
      console.error(`[Dashboard] Failed to dispatch group ${groupId}:`, err);
      toast({
        title: 'Erro',
        description: 'Não foi possível despachar o grupo.',
        variant: 'destructive',
      });
      // Re-throw to allow GroupCard to handle retry logic
      throw err;
    }
  };

  const handleForceDispatch = async (orderId: string) => {
    try {
      await forceDispatch.mutateAsync(orderId);
      toast({
        title: 'Pedido despachado!',
        description: 'O pedido foi enviado individualmente.',
      });
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Não foi possível despachar o pedido.',
        variant: 'destructive',
      });
    }
  };

  const handleSyncStatus = async () => {
    try {
      const result = await syncOrdersStatus.mutateAsync();
      toast({
        title: 'Sincronização concluída!',
        description: result.message || 'Status dos pedidos sincronizado.',
      });
    } catch (err) {
      toast({
        title: 'Erro na sincronização',
        description: 'Não foi possível sincronizar com o CardápioWeb.',
        variant: 'destructive',
      });
    }
  };

  const handleRetryNotification = async (orderId: string) => {
    try {
      await retryNotification.mutateAsync(orderId);
      toast({
        title: 'Notificação reenviada!',
        description: 'CardápioWeb foi notificado com sucesso.',
      });
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Não foi possível reenviar a notificação.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-destructive">
          <AlertCircle className="h-12 w-12" />
          <p>Erro ao carregar pedidos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      {/* Polling Status Bar */}
      {pollingEnabled && (
        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className={cn("h-4 w-4", isPolling && "animate-spin")} />
            <span>
              {isPolling ? 'Sincronizando...' : lastSync 
                ? `Última sincronização: ${lastSync.toLocaleTimeString('pt-BR')}`
                : 'Aguardando sincronização...'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleSyncStatus}
              disabled={syncOrdersStatus.isPending}
              className="text-sm text-orange-600 hover:underline disabled:opacity-50 flex items-center gap-1"
            >
              <RefreshCw className={cn("h-3 w-3", syncOrdersStatus.isPending && "animate-spin")} />
              Sincronizar Status
            </button>
            <button 
              onClick={manualPoll}
              disabled={isPolling}
              className="text-sm text-primary hover:underline disabled:opacity-50"
            >
              Buscar novos pedidos
            </button>
          </div>
        </div>
      )}
      
      <div className="grid flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-3 min-h-0">
      {/* Column 1: Em Produção */}
      <OrderColumn
        title="Em Produção"
        count={pendingOrders.length}
        icon={<ChefHat className="h-5 w-5" />}
        variant="pending"
      >
        {pendingOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <ChefHat className="mb-2 h-8 w-8 opacity-50" />
            <p>Nenhum pedido em produção</p>
          </div>
        ) : (
          pendingOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onMarkReady={() => handleMarkReady(order.id)}
            />
          ))
        )}
      </OrderColumn>

      {/* Column 2: Buffer de Espera */}
      <OrderColumn
        title="Buffer de Espera"
        count={bufferOrders.length}
        icon={<Clock className="h-5 w-5" />}
        variant="buffer"
      >
        {Object.keys(groupedBufferOrders).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Clock className="mb-2 h-8 w-8 opacity-50" />
            <p>Nenhum pedido aguardando</p>
          </div>
        ) : (
          Object.entries(groupedBufferOrders).map(([groupId, groupOrders]) => (
            <GroupCard
              key={groupId}
              groupId={groupId}
              orders={groupOrders}
              onDispatch={() => handleDispatchGroup(groupId)}
              onForceDispatchOrder={handleForceDispatch}
              timerDuration={(settings?.buffer_timeout_minutes || 10) * 60}
            />
          ))
        )}
      </OrderColumn>

      {/* Column 3: Despachados */}
      <OrderColumn
        title="Despachados"
        count={dispatchedOrders.length}
        icon={<Truck className="h-5 w-5" />}
        variant="dispatched"
      >
        {dispatchedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Truck className="mb-2 h-8 w-8 opacity-50" />
            <p>Nenhum pedido despachado hoje</p>
          </div>
        ) : (
          dispatchedOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onRetryNotification={order.notification_error ? () => handleRetryNotification(order.id) : undefined}
            />
          ))
        )}
      </OrderColumn>
      </div>
    </div>
  );
}
