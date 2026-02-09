import { useMemo, useState, useEffect, useRef } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from '@/hooks/useSettings';
import { useBufferSettings } from '@/hooks/useBufferSettings';
import { useDynamicBufferSettings } from '@/hooks/useDynamicBufferSettings';
import { OrderColumn } from './OrderColumn';
import { OrderCard } from './OrderCard';
import { BufferPanel } from './BufferPanel';
import { ChefHat, Clock, PackageCheck, Truck, Loader2, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DashboardProps {
  isPolling?: boolean;
  lastSync?: Date | null;
  pollingEnabled?: boolean;
  manualPoll?: () => void;
}

export function Dashboard({ isPolling = false, lastSync = null, pollingEnabled = false, manualPoll }: DashboardProps) {
  const { orders, isLoading, isFetching, error, markAsReady, moveToReady, markAsCollected, forceDispatch, syncOrdersStatus, retryNotification, cleanupErrors, manualCleanup, forceCloseOrder } =
    useOrders();
  const { settings } = useSettings();
  const { getTodayBufferTimeout } = useBufferSettings();
  const { settings: dynamicSettings, calculateDynamicTimer } = useDynamicBufferSettings();
  const { toast } = useToast();
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [collectingOrderId, setCollectingOrderId] = useState<string | null>(null);
  const [forceClosingOrderId, setForceClosingOrderId] = useState<string | null>(null);
  const [orderToForceClose, setOrderToForceClose] = useState<{ id: string; orderId: string } | null>(null);

  // Track which orders we've already notified to avoid duplicate calls
  const notifiedOrdersRef = useRef<Set<string>>(new Set());

  // Auto-notify CardápioWeb for non-delivery orders that skip buffer and go directly to 'ready'
  useEffect(() => {
    const unnotifiedReadyOrders = orders.filter(
      (o) =>
        o.status === 'ready' &&
        o.cardapioweb_notified === false &&
        o.order_type !== 'delivery' &&
        o.order_type !== null &&
        !notifiedOrdersRef.current.has(o.id)
    );

    if (unnotifiedReadyOrders.length === 0) return;

    const orderIds = unnotifiedReadyOrders.map((o) => o.id);
    // Mark as notifying immediately to prevent duplicate calls
    orderIds.forEach((id) => notifiedOrdersRef.current.add(id));

    console.log('[Dashboard] Auto-notifying CardápioWeb for non-delivery ready orders:', orderIds);

    supabase.functions
      .invoke('notify-order-ready', { body: { orderIds } })
      .then(({ error }) => {
        if (error) {
          console.error('[Dashboard] Auto-notify error:', error);
          // Remove from set so it can retry on next render
          orderIds.forEach((id) => notifiedOrdersRef.current.delete(id));
        } else {
          console.log('[Dashboard] Auto-notify success for', orderIds.length, 'orders');
        }
      });
  }, [orders]);

  // Filter orders by status
  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === 'pending'),
    [orders]
  );

  const bufferOrders = useMemo(
    () => orders.filter((o) => o.status === 'waiting_buffer'),
    [orders]
  );

  // Count active orders for dynamic buffer calculation (pending + buffer)
  const activeOrderCount = useMemo(() => {
    return pendingOrders.length + bufferOrders.length;
  }, [pendingOrders.length, bufferOrders.length]);

  // Calculate dynamic or static buffer timeout
  const dynamicTimerResult = useMemo(() => {
    return calculateDynamicTimer(activeOrderCount);
  }, [calculateDynamicTimer, activeOrderCount]);

  const bufferTimeoutSeconds = useMemo(() => {
    if (dynamicSettings?.enabled && dynamicTimerResult) {
      return dynamicTimerResult.timerMinutes * 60;
    }
    // Fallback: use per-day static setting
    const minutes = getTodayBufferTimeout(settings?.buffer_timeout_minutes || 10);
    return minutes * 60;
  }, [dynamicSettings?.enabled, dynamicTimerResult, getTodayBufferTimeout, settings?.buffer_timeout_minutes]);

  const readyOrders = useMemo(
    () => orders.filter((o) => o.status === 'ready'),
    [orders]
  );

  const dispatchedOrders = useMemo(() => {
    const visibilityMinutes = settings?.dispatched_visibility_minutes ?? 60;
    const cutoffTime = new Date(Date.now() - visibilityMinutes * 60 * 1000);
    const sortDesc = settings?.dispatched_order_sort_desc ?? true;

    return orders
      .filter((o) => {
        if (o.status !== 'dispatched') return false;
        if (!o.dispatched_at) return true;
        return new Date(o.dispatched_at) > cutoffTime;
      })
      .sort((a, b) => {
        const timeA = a.dispatched_at ? new Date(a.dispatched_at).getTime() : 0;
        const timeB = b.dispatched_at ? new Date(b.dispatched_at).getTime() : 0;
        return sortDesc ? timeB - timeA : timeA - timeB;
      })
      .slice(0, 20);
  }, [orders, settings?.dispatched_order_sort_desc, settings?.dispatched_visibility_minutes]);

  // Count orders with errors (notification errors only - Foody handled by CardápioWeb)
  const ordersWithErrors = useMemo(
    () => orders.filter((o) => o.notification_error),
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

  const handleManualCleanup = async () => {
    try {
      const result = await manualCleanup.mutateAsync();
      toast({
        title: 'Limpeza concluída!',
        description: result.message || 'Pedidos antigos foram removidos.',
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
    <div className="flex flex-col h-[calc(100vh-5rem)] overflow-y-auto">
      {/* Action Bar - Always visible */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border/50">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {pollingEnabled && (
            <>
              <RefreshCw className={cn("h-4 w-4", isPolling && "animate-spin")} />
              <span>
                {isPolling ? 'Sincronizando...' : lastSync 
                  ? `Última sincronização: ${lastSync.toLocaleTimeString('pt-BR')}`
                  : 'Aguardando sincronização...'}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Always visible */}
          <Button
            onClick={handleManualCleanup}
            disabled={manualCleanup.isPending}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <Trash2 className={cn("h-4 w-4 mr-1", manualCleanup.isPending && "animate-pulse")} />
            {manualCleanup.isPending ? 'Limpando...' : 'Limpar Pedidos'}
          </Button>

          {ordersWithErrors.length > 0 && (
            <Button 
              onClick={handleCleanupErrors}
              disabled={cleanupErrors.isPending}
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className={cn("h-4 w-4 mr-1", cleanupErrors.isPending && "animate-pulse")} />
              Limpar {ordersWithErrors.length} com erro
            </Button>
          )}

          {/* Only when CardápioWeb is enabled */}
          {pollingEnabled && (
            <>
              <Button 
                onClick={handleSyncStatus}
                disabled={syncOrdersStatus.isPending}
                variant="ghost"
                size="sm"
                className="text-orange-600 hover:text-orange-500"
              >
                <RefreshCw className={cn("h-4 w-4 mr-1", syncOrdersStatus.isPending && "animate-spin")} />
                Sincronizar Status
              </Button>
              <Button 
                onClick={manualPoll}
                disabled={isPolling}
                variant="ghost"
                size="sm"
                className="text-primary hover:text-primary/80"
              >
                Buscar novos pedidos
              </Button>
            </>
          )}
        </div>
      </div>



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
              timerDuration={bufferTimeoutSeconds}
              dynamicScenario={dynamicTimerResult}
              activeOrderCount={activeOrderCount}
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
                onForceClose={() => setOrderToForceClose({
                  id: order.id,
                  orderId: order.cardapioweb_order_id || order.external_id || order.id.slice(0, 8)
                })}
                isForceClosing={forceClosingOrderId === order.id}
              />
            ))
          )}
        </OrderColumn>
      </div>

      {/* Confirmation Dialog for Force Close */}
      <AlertDialog 
        open={!!orderToForceClose} 
        onOpenChange={(open) => !open && setOrderToForceClose(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar fechamento forçado</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  Tem certeza que deseja forçar o fechamento do pedido <strong>#{orderToForceClose?.orderId}</strong>?
                </p>
                <p className="mt-3">Esta ação irá:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Notificar o CardápioWeb que o pedido foi entregue</li>
                  <li>Remover o pedido do sistema</li>
                </ul>
                <p className="mt-3 font-medium text-destructive">Esta ação não pode ser desfeita.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (orderToForceClose) {
                  handleForceClose(orderToForceClose.id);
                  setOrderToForceClose(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, forçar fechamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
