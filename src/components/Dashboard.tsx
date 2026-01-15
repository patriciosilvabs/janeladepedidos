import { useMemo, useState } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { usePolling } from '@/hooks/usePolling';
import { useSettings } from '@/hooks/useSettings';
import { OrderColumn } from './OrderColumn';
import { OrderCard } from './OrderCard';
import { BufferPanel } from './BufferPanel';
import { ChefHat, Clock, PackageCheck, Truck, Loader2, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function Dashboard() {
  const { orders, isLoading, isFetching, error, markAsReady, moveToReady, markAsCollected, forceDispatch, syncOrdersStatus, retryNotification, retryFoody, cleanupErrors, forceCloseOrder } =
    useOrders();
  const { settings } = useSettings();
  const { toast } = useToast();
  const { isPolling, lastSync, isEnabled: pollingEnabled, manualPoll } = usePolling(30000);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [collectingOrderId, setCollectingOrderId] = useState<string | null>(null);
  const [retryingFoodyOrderId, setRetryingFoodyOrderId] = useState<string | null>(null);
  const [forceClosingOrderId, setForceClosingOrderId] = useState<string | null>(null);

  // Filter orders by status
  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === 'pending'),
    [orders]
  );

  const bufferOrders = useMemo(
    () => orders.filter((o) => o.status === 'waiting_buffer'),
    [orders]
  );

  const readyOrders = useMemo(
    () => orders.filter((o) => o.status === 'ready'),
    [orders]
  );

  const dispatchedOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'dispatched')
        .slice(0, 20),
    [orders]
  );

  // Count orders with errors
  const ordersWithErrors = useMemo(
    () => orders.filter((o) => o.foody_error || o.notification_error),
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

  const handleMoveToReady = async (orderIds: string[]): Promise<void> => {
    console.log(`[Dashboard] Moving ${orderIds.length} orders to ready`);
    try {
      const result = await moveToReady.mutateAsync(orderIds);
      console.log(`[Dashboard] Move result:`, result);
      toast({
        title: 'Pedidos prontos!',
        description: `${result.processed} pedido(s) movido(s) para aguardando coleta.`,
      });
    } catch (err) {
      console.error(`[Dashboard] Failed to move to ready:`, err);
      toast({
        title: 'Erro',
        description: 'Não foi possível mover os pedidos.',
        variant: 'destructive',
      });
      throw err;
    }
  };

  const handleMarkCollected = async (orderId: string) => {
    setCollectingOrderId(orderId);
    try {
      await markAsCollected.mutateAsync(orderId);
      toast({
        title: 'Pedido coletado!',
        description: 'O motoboy coletou o pedido.',
      });
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Não foi possível marcar o pedido como coletado.',
        variant: 'destructive',
      });
    } finally {
      setCollectingOrderId(null);
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

  const handleRetryFoody = async (orderId: string) => {
    setRetryingFoodyOrderId(orderId);
    try {
      await retryFoody.mutateAsync(orderId);
      toast({
        title: 'Pedido reenviado ao Foody!',
        description: 'O pedido foi enviado novamente para o Foody Delivery.',
      });
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Não foi possível reenviar o pedido ao Foody.',
        variant: 'destructive',
      });
    } finally {
      setRetryingFoodyOrderId(null);
    }
  };

  const handleCleanupErrors = async () => {
    try {
      const result = await cleanupErrors.mutateAsync();
      toast({
        title: 'Limpeza concluída!',
        description: result.message || 'Pedidos com erros foram removidos.',
      });
    } catch (err) {
      toast({
        title: 'Erro na limpeza',
        description: 'Não foi possível limpar os pedidos.',
        variant: 'destructive',
      });
    }
  };

  const handleForceClose = async (orderId: string) => {
    setForceClosingOrderId(orderId);
    try {
      await forceCloseOrder.mutateAsync(orderId);
      toast({
        title: 'Pedido fechado!',
        description: 'O pedido foi fechado no CardápioWeb e removido do sistema.',
      });
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível fechar o pedido no CardápioWeb.',
        variant: 'destructive',
      });
    } finally {
      setForceClosingOrderId(null);
    }
  };

  if (isLoading && orders.length === 0) {
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
            {ordersWithErrors.length > 0 && (
              <button 
                onClick={handleCleanupErrors}
                disabled={cleanupErrors.isPending}
                className="text-sm text-destructive hover:underline disabled:opacity-50 flex items-center gap-1"
              >
                <Trash2 className={cn("h-3 w-3", cleanupErrors.isPending && "animate-pulse")} />
                Limpar {ordersWithErrors.length} com erro
              </button>
            )}
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
      
      <div className="grid flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-4 min-h-0">
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
                isMarkingReady={processingOrderId === order.id}
              />
            ))
          )}
        </OrderColumn>

        {/* Column 2: Buffer de Espera - Single Timer */}
        <OrderColumn
          title="Buffer de Espera"
          count={bufferOrders.length}
          icon={<Clock className="h-5 w-5" />}
          variant="buffer"
        >
          {bufferOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Clock className="mb-2 h-8 w-8 opacity-50" />
              <p>Nenhum pedido aguardando</p>
            </div>
          ) : (
            <BufferPanel
              orders={bufferOrders}
              onMoveToReady={handleMoveToReady}
              onForceDispatchOrder={handleForceDispatch}
              timerDuration={(settings?.buffer_timeout_minutes || 10) * 60}
            />
          )}
        </OrderColumn>

        {/* Column 3: Pedido Pronto - Aguardando Coleta */}
        <OrderColumn
          title="Pedido Pronto"
          count={readyOrders.length}
          icon={<PackageCheck className="h-5 w-5" />}
          variant="ready"
        >
          {readyOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <PackageCheck className="mb-2 h-8 w-8 opacity-50" />
              <p>Nenhum pedido pronto</p>
            </div>
          ) : (
            readyOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onMarkCollected={() => handleMarkCollected(order.id)}
                isMarkingCollected={collectingOrderId === order.id}
                onRetryFoody={order.foody_error ? () => handleRetryFoody(order.id) : undefined}
                isRetryingFoody={retryingFoodyOrderId === order.id}
              />
            ))
          )}
        </OrderColumn>

        {/* Column 4: Despachados */}
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
                onRetryFoody={order.foody_error ? () => handleRetryFoody(order.id) : undefined}
                isRetryingFoody={retryingFoodyOrderId === order.id}
                onForceClose={() => handleForceClose(order.id)}
                isForceClosing={forceClosingOrderId === order.id}
              />
            ))
          )}
        </OrderColumn>
      </div>
    </div>
  );
}
