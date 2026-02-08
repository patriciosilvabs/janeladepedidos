import { useState, useCallback } from 'react';
import { useOrderItems } from '@/hooks/useOrderItems';
import { OvenTimerPanel, DispatchedOrder } from '@/components/kds/OvenTimerPanel';
import { OvenHistoryPanel } from '@/components/kds/OvenHistoryPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Flame, History } from 'lucide-react';

export function DispatchDashboard() {
  const { items } = useOrderItems({ status: ['in_oven', 'ready'] });
  const activeItems = items.filter(i => i.status === 'in_oven' || (i.status === 'ready' && i.oven_entry_at));
  const [dispatchedOrders, setDispatchedOrders] = useState<DispatchedOrder[]>([]);

  const handleDispatch = useCallback((order: DispatchedOrder) => {
    setDispatchedOrders(prev => [order, ...prev]);
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] p-4 md:p-6">
      <Tabs defaultValue="forno" className="flex-1 flex flex-col">
        <div className="flex justify-center mb-4">
          <TabsList>
            <TabsTrigger value="forno" className="gap-1">
              <Flame className="h-4 w-4" />
              Forno
              {activeItems.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                  {activeItems.filter(i => i.status === 'in_oven').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-1">
              <History className="h-4 w-4" />
              Histórico
              {dispatchedOrders.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {dispatchedOrders.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="forno" className="flex-1 overflow-auto mt-0">
          {activeItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Flame className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h2 className="text-xl font-semibold text-muted-foreground">
                Nenhum item no forno
              </h2>
              <p className="text-sm text-muted-foreground/70 mt-2">
                Os itens aparecerão aqui quando as bancadas enviarem para o forno
              </p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              <OvenTimerPanel onDispatch={handleDispatch} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="historico" className="flex-1 overflow-auto mt-0">
          <div className="max-w-2xl mx-auto">
            <OvenHistoryPanel dispatchedOrders={dispatchedOrders} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
