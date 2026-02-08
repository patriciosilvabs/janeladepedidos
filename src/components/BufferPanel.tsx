import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OrderWithGroup } from '@/types/orders';
import { Clock, Truck, AlertTriangle, Loader2, Zap, Users, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OrderCard } from './OrderCard';
import type { VolumeScenario } from '@/hooks/useDynamicBufferSettings';

interface BufferPanelProps {
  orders: OrderWithGroup[];
  onMoveToReady: (orderIds: string[]) => Promise<void>;
  onForceDispatchOrder: (orderId: string) => void;
  timerDuration: number;
  dynamicScenario?: {
    scenario: VolumeScenario;
    scenarioLabel: string;
    scenarioDescription: string;
  } | null;
  activeOrderCount?: number;
}

export function BufferPanel({
  orders,
  onMoveToReady,
  onForceDispatchOrder,
  timerDuration,
  dynamicScenario,
  activeOrderCount,
}: BufferPanelProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const hasDispatchedRef = useRef(false);
  const lastOldestOrderIdRef = useRef<string | null>(null);

  // Get the oldest order (first to enter buffer - starts the timer)
  const oldestOrder = useMemo(() => {
    if (orders.length === 0) return null;
    return orders.reduce((oldest, current) => {
      const oldestTime = new Date(oldest.ready_at || 0).getTime();
      const currentTime = new Date(current.ready_at || 0).getTime();
      return currentTime < oldestTime ? current : oldest;
    });
  }, [orders]);

  // Reset dispatch flag when oldest order changes (new timer cycle)
  useEffect(() => {
    if (oldestOrder?.id !== lastOldestOrderIdRef.current) {
      lastOldestOrderIdRef.current = oldestOrder?.id || null;
      hasDispatchedRef.current = false;
      console.log('[BufferPanel] Timer cycle reset - oldest order changed:', oldestOrder?.id);
    }
  }, [oldestOrder?.id]);

  // Auto-move to ready handler
  const handleAutoMoveToReady = useCallback(async () => {
    if (hasDispatchedRef.current || isDispatching || orders.length === 0) {
      console.log('[BufferPanel] Move to ready skipped:', {
        hasDispatched: hasDispatchedRef.current,
        isDispatching,
        orderCount: orders.length,
      });
      return;
    }

    console.log('[BufferPanel] Moving all orders to ready:', orders.map(o => o.id));
    hasDispatchedRef.current = true;
    setIsDispatching(true);

    try {
      await onMoveToReady(orders.map(o => o.id));
      console.log('[BufferPanel] Successfully moved all orders to ready');
    } catch (error) {
      console.error('[BufferPanel] Failed to move to ready:', error);
      hasDispatchedRef.current = false; // Allow retry
    } finally {
      setIsDispatching(false);
    }
  }, [onMoveToReady, isDispatching, orders]);

  // Timer effect
  useEffect(() => {
    const readyAt = oldestOrder?.ready_at;

    // No timer if no orders or no ready_at
    if (!readyAt || orders.length === 0) {
      setTimeLeft(null);
      return;
    }

    // Validate ready_at
    const readyTime = new Date(readyAt).getTime();
    if (isNaN(readyTime)) {
      console.warn('[BufferPanel] Invalid ready_at:', readyAt);
      setTimeLeft(null);
      return;
    }

    const calculateTimeLeft = () => {
      const endTime = readyTime + timerDuration * 1000;
      return Math.max(0, Math.floor((endTime - Date.now()) / 1000));
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining <= 0 && !hasDispatchedRef.current && !isDispatching) {
        handleAutoMoveToReady();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [oldestOrder?.ready_at, timerDuration, handleAutoMoveToReady, isDispatching, orders.length]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (timeLeft === null) return '';
    if (timeLeft <= 0) return 'text-destructive';
    if (timeLeft <= 120) return 'text-destructive';
    if (timeLeft <= 300) return 'text-yellow-500';
    return 'text-green-500';
  };

  const isUrgent = timeLeft !== null && timeLeft <= 120;

  const handleManualMoveToReady = async () => {
    if (isDispatching || orders.length === 0) return;
    setIsDispatching(true);
    try {
      await onMoveToReady(orders.map(o => o.id));
    } catch (error) {
      console.error('[BufferPanel] Manual move to ready failed:', error);
    } finally {
      setIsDispatching(false);
    }
  };

  if (orders.length === 0) {
    return null;
  }

  const getScenarioIcon = () => {
    if (!dynamicScenario?.scenario) return null;
    switch (dynamicScenario.scenario) {
      case 'low':
        return <Zap className="h-4 w-4" />;
      case 'medium':
        return <Users className="h-4 w-4" />;
      case 'high':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getScenarioBadgeVariant = () => {
    if (!dynamicScenario?.scenario) return 'secondary';
    switch (dynamicScenario.scenario) {
      case 'low':
        return 'default';
      case 'medium':
        return 'secondary';
      case 'high':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-4">
      {/* Dynamic Scenario Indicator */}
      {dynamicScenario && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
          <div className="flex items-center gap-2">
            {getScenarioIcon()}
            <div>
              <Badge variant={getScenarioBadgeVariant() as any} className="mb-1">
                {dynamicScenario.scenarioLabel}
              </Badge>
              <p className="text-xs text-muted-foreground">
                {dynamicScenario.scenarioDescription}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold">{activeOrderCount}</span>
            <p className="text-xs text-muted-foreground">pedidos ativos</p>
          </div>
        </div>
      )}

      {/* Global Timer Card */}
      {timeLeft !== null && (
        <Card className={cn(
          'border-2 border-primary bg-primary/10',
          isUrgent && 'border-destructive bg-destructive/10 shadow-lg'
        )}>
          <CardContent className="py-4">
            <div className={cn(
              'flex items-center justify-center gap-2 font-mono text-4xl font-bold',
              getTimerColor()
            )}>
              {isUrgent && <AlertTriangle className="h-8 w-8" />}
              <Clock className="h-8 w-8" />
              <span>{formatTime(timeLeft)}</span>
            </div>
            <p className="text-center text-sm text-muted-foreground mt-2">
              {orders.length} pedido(s) ficarão prontos quando o timer terminar
            </p>
          </CardContent>
        </Card>
      )}

      {/* Order List */}
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          onForceDispatch={() => onForceDispatchOrder(order.id)}
          showTimer={false}
        />
      ))}

      {/* Move to Ready Button */}
      <Button
        onClick={handleManualMoveToReady}
        disabled={isDispatching}
        className="w-full bg-purple-600 hover:bg-purple-700"
        size="lg"
      >
        {isDispatching ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <Clock className="mr-2 h-5 w-5" />
        )}
        {isDispatching ? 'PROCESSANDO...' : `MARCAR TODOS PRONTOS (${orders.length})`}
      </Button>
    </div>
  );
}