import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OrderWithGroup } from '@/types/orders';
import { Clock, Users, Truck, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GroupCardProps {
  groupId: string;
  orders: OrderWithGroup[];
  onDispatch: () => Promise<void>;
  onForceDispatchOrder: (orderId: string) => void;
  timerDuration?: number;
}

const GROUP_COLORS = [
  'border-blue-500 bg-blue-500/10',
  'border-green-500 bg-green-500/10',
  'border-yellow-500 bg-yellow-500/10',
  'border-purple-500 bg-purple-500/10',
  'border-pink-500 bg-pink-500/10',
  'border-cyan-500 bg-cyan-500/10',
  'border-orange-500 bg-orange-500/10',
  'border-red-500 bg-red-500/10',
];

export function GroupCard({
  groupId,
  orders,
  onDispatch,
  onForceDispatchOrder,
  timerDuration = 600,
}: GroupCardProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const hasDispatchedRef = useRef(false);
  const groupIdRef = useRef(groupId);

  // Keep groupId ref updated
  useEffect(() => {
    groupIdRef.current = groupId;
  }, [groupId]);

  const firstOrder = orders[0];
  const group = firstOrder?.delivery_groups;

  // Memoized dispatch handler with error recovery
  const handleAutoDispatch = useCallback(async () => {
    if (hasDispatchedRef.current || isDispatching) {
      console.log(`[GroupCard] Dispatch already in progress or completed for group ${groupIdRef.current}`);
      return;
    }

    console.log(`[GroupCard] Auto-dispatching group ${groupIdRef.current}`);
    hasDispatchedRef.current = true;
    setIsDispatching(true);

    try {
      await onDispatch();
      console.log(`[GroupCard] Successfully dispatched group ${groupIdRef.current}`);
    } catch (error) {
      console.error(`[GroupCard] Failed to dispatch group ${groupIdRef.current}:`, error);
      // Reset flag to allow retry on next tick or manual dispatch
      hasDispatchedRef.current = false;
    } finally {
      setIsDispatching(false);
    }
  }, [onDispatch, isDispatching]);

  useEffect(() => {
    if (!firstOrder?.ready_at) return;

    const calculateTimeLeft = () => {
      const readyTime = new Date(firstOrder.ready_at!).getTime();
      const endTime = readyTime + timerDuration * 1000;
      const now = Date.now();
      return Math.max(0, Math.floor((endTime - now) / 1000));
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      
      if (remaining <= 0 && !hasDispatchedRef.current && !isDispatching) {
        handleAutoDispatch();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [firstOrder?.ready_at, timerDuration, handleAutoDispatch, isDispatching]);

  const formatTime = (seconds: number) => {
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
    const index = groupId.charCodeAt(0) % GROUP_COLORS.length;
    return GROUP_COLORS[index];
  };

  const isUrgent = timeLeft !== null && timeLeft <= 120;
  const isFull = group && group.order_count >= group.max_orders;

  useEffect(() => {
    if (isFull && !hasDispatchedRef.current && !isDispatching) {
      handleAutoDispatch();
    }
  }, [isFull, handleAutoDispatch, isDispatching]);

  return (
    <Card
      className={cn(
        'border-2 transition-all duration-300',
        getGroupColor(),
        isUrgent && 'shadow-red-500/20 shadow-lg animate-pulse'
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <span className="font-bold">
              Grupo {groupId.slice(0, 4).toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isFull ? 'default' : 'outline'}>
              {orders.length}/{group?.max_orders || 3} pedidos
            </Badge>
            {isFull && (
              <Badge className="bg-green-600">COMPLETO</Badge>
            )}
          </div>
        </div>

        {timeLeft !== null && (
          <div
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg bg-muted/50 py-3 font-mono text-3xl font-bold mt-2',
              getTimerColor()
            )}
          >
            {isUrgent && <AlertTriangle className="h-6 w-6" />}
            <Clock className="h-6 w-6" />
            <span>{formatTime(timeLeft)}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {orders.map((order) => (
          <div key={order.id} className="rounded-lg border border-border/50 bg-background/50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-medium">{order.customer_name}</p>
                <p className="text-sm text-muted-foreground">{order.address}</p>
                {order.neighborhood && (
                  <p className="text-xs text-muted-foreground/70">{order.neighborhood}</p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onForceDispatchOrder(order.id)}
                className="text-xs"
              >
                Remover
              </Button>
            </div>
          </div>
        ))}

        <Button
          onClick={onDispatch}
          disabled={isDispatching}
          className="w-full bg-primary hover:bg-primary/90"
          size="lg"
        >
          {isDispatching ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Truck className="mr-2 h-5 w-5" />
          )}
          {isDispatching ? 'DESPACHANDO...' : 'DESPACHAR GRUPO'}
        </Button>
      </CardContent>
    </Card>
  );
}
