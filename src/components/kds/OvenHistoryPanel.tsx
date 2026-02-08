import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Clock, Package } from 'lucide-react';
import { OrderItemWithOrder } from '@/types/orderItems';

interface DispatchedOrder {
  orderId: string;
  orderDisplayId: string;
  storeName: string | null;
  customerName: string;
  items: OrderItemWithOrder[];
  dispatchedAt: Date;
}

interface OvenHistoryPanelProps {
  dispatchedOrders: DispatchedOrder[];
}

export function OvenHistoryPanel({ dispatchedOrders }: OvenHistoryPanelProps) {
  if (dispatchedOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-16">
        <Clock className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold text-muted-foreground">Nenhum despacho ainda</h2>
        <p className="text-sm text-muted-foreground/70 mt-2">
          Os pedidos despachados aparecerão aqui para conferência
        </p>
      </div>
    );
  }

  return (
    <Card className="border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Check className="h-5 w-5 text-green-500" />
          Histórico de Despachos
          <Badge className="bg-green-600 text-white">
            {dispatchedOrders.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {dispatchedOrders.map((order) => {
          const timeAgo = getTimeAgo(order.dispatchedAt);
          return (
            <div
              key={order.orderId}
              className="rounded-lg border border-green-500/30 bg-green-500/5 p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono text-base px-2 py-0.5 border-green-500/50">
                    #{order.orderDisplayId}
                  </Badge>
                  {order.storeName && (
                    <span className="text-sm text-primary font-medium">{order.storeName}</span>
                  )}
                  <span className="text-sm text-muted-foreground">{order.customerName}</span>
                  <Badge variant="secondary" className="gap-1">
                    <Package className="h-3 w-3" />
                    {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{timeAgo}</span>
                  <Badge className="bg-green-600 text-white">
                    <Check className="h-3 w-3 mr-1" />
                    DESPACHADO
                  </Badge>
                </div>
              </div>
              <div className="space-y-1">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm text-muted-foreground pl-2">
                    <Check className="h-3 w-3 text-green-500 shrink-0" />
                    <span>
                      {item.quantity > 1 && <span className="font-medium">{item.quantity}x </span>}
                      {item.product_name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function getTimeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  return `${Math.floor(diff / 3600)}h atrás`;
}
