import { useState, useMemo, useCallback } from 'react';
import { useSectors, Sector } from '@/hooks/useSectors';
import { SectorQueuePanel } from './SectorQueuePanel';
import { OvenTimerPanel, DispatchedOrder } from './OvenTimerPanel';
import { OvenHistoryPanel } from './OvenHistoryPanel';
import { useOrderItems } from '@/hooks/useOrderItems';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CheckCircle2, Flame, History } from 'lucide-react';

interface KDSItemsDashboardProps {
  userSector?: Sector | null;
}

export function KDSItemsDashboard({ userSector }: KDSItemsDashboardProps) {
  const filterSectorId = userSector?.id;
  
  const { sectors, isLoading: sectorsLoading } = useSectors();
  const { isAdmin } = useAuth();
  const { inOvenItems } = useOrderItems({ status: 'in_oven' });
  const [dispatchedOrders, setDispatchedOrders] = useState<DispatchedOrder[]>([]);
  const [ovenSubTab, setOvenSubTab] = useState<'forno' | 'historico'>('forno');

  const handleDispatch = useCallback((order: DispatchedOrder) => {
    setDispatchedOrders(prev => [order, ...prev]);
  }, []);

  const kdsSectors = useMemo(
    () => sectors?.filter((s) => s.view_type === 'kds') ?? [],
    [sectors]
  );

  const showOvenTab = isAdmin && !filterSectorId;

  if (sectorsLoading) {
    return (
      <div className="flex h-[calc(100vh-5rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const ovenTabTrigger = showOvenTab && (
    <TabsTrigger value="__oven__" className="gap-1">
      <Flame className="h-3 w-3" />
      Forno
      {inOvenItems.length > 0 && (
        <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
          {inOvenItems.length}
        </Badge>
      )}
    </TabsTrigger>
  );

  const ovenTabContent = showOvenTab && (
    <TabsContent value="__oven__" className="flex-1 mt-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-center mb-4">
          <div className="inline-flex items-center rounded-lg border bg-card p-1 gap-1">
            <button
              onClick={() => setOvenSubTab('forno')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                ovenSubTab === 'forno'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Flame className="h-3 w-3 inline mr-1" />
              Forno
            </button>
            <button
              onClick={() => setOvenSubTab('historico')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                ovenSubTab === 'historico'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <History className="h-3 w-3 inline mr-1" />
              Histórico
              {dispatchedOrders.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  {dispatchedOrders.length}
                </Badge>
              )}
            </button>
          </div>
        </div>

        {ovenSubTab === 'forno' ? (
          <OvenTimerPanel onDispatch={handleDispatch} />
        ) : (
          <OvenHistoryPanel dispatchedOrders={dispatchedOrders} />
        )}
      </div>
    </TabsContent>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] p-4 gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">KDS - Itens</h1>
        </div>
      </div>

      {filterSectorId ? (
        <div className="flex-1">
          <SectorQueuePanel 
            sectorId={filterSectorId} 
            sectorName={userSector?.name || 'Fila de Produção'} 
          />
        </div>
      ) : (
        kdsSectors.length > 0 ? (
          <Tabs defaultValue={kdsSectors[0]?.id} className="flex-1 flex flex-col">
            <TabsList>
              {kdsSectors.map((sector) => (
                <TabsTrigger key={sector.id} value={sector.id}>
                  {sector.name}
                </TabsTrigger>
              ))}
              {ovenTabTrigger}
            </TabsList>
            
            {kdsSectors.map((sector) => (
              <TabsContent key={sector.id} value={sector.id} className="flex-1 mt-4">
                <SectorQueuePanel 
                  sectorId={sector.id} 
                  sectorName={sector.name} 
                />
              </TabsContent>
            ))}
            {ovenTabContent}
          </Tabs>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-xl font-medium">Nenhum setor KDS configurado</p>
              <p className="text-sm mt-2">Configure setores com tipo "KDS" nas configurações</p>
            </div>
          </div>
        )
      )}
    </div>
  );
}
