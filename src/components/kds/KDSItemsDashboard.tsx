import { useMemo } from 'react';
import { useOrderItems } from '@/hooks/useOrderItems';
import { useSectors } from '@/hooks/useSectors';
import { OvenTimerPanel } from './OvenTimerPanel';
import { SectorQueuePanel } from './SectorQueuePanel';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle, CheckCircle2, Flame, Clock, Users } from 'lucide-react';

export function KDSItemsDashboard() {
  const { sectors, isLoading: sectorsLoading } = useSectors();
  const { items, pendingItems, inPrepItems, inOvenItems, readyItems, isLoading } = useOrderItems();

  // Filter KDS sectors (view_type = 'kds')
  const kdsSectors = useMemo(
    () => sectors.filter((s) => s.view_type === 'kds'),
    [sectors]
  );

  // Stats
  const totalPending = pendingItems.length;
  const totalInPrep = inPrepItems.length;
  const totalInOven = inOvenItems.length;
  const totalReady = readyItems.length;

  if (isLoading || sectorsLoading) {
    return (
      <div className="flex h-[calc(100vh-5rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] p-4 gap-4">
      {/* Header Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">KDS - Itens</h1>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {totalPending} pendentes
            </Badge>
            <Badge variant="outline" className="gap-1 bg-blue-500/10">
              <Users className="h-3 w-3" />
              {totalInPrep} em preparo
            </Badge>
            <Badge variant="outline" className="gap-1 bg-orange-500/10">
              <Flame className="h-3 w-3" />
              {totalInOven} no forno
            </Badge>
            <Badge variant="outline" className="gap-1 bg-green-500/10">
              <CheckCircle2 className="h-3 w-3" />
              {totalReady} prontos
            </Badge>
          </div>
        </div>
      </div>

      {/* Oven Panel - Always visible if there are items */}
      {totalInOven > 0 && (
        <OvenTimerPanel />
      )}

      {/* Sector Tabs or Single Queue */}
      {kdsSectors.length > 1 ? (
        <Tabs defaultValue="all" className="flex-1 flex flex-col">
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            {kdsSectors.map((sector) => (
              <TabsTrigger key={sector.id} value={sector.id}>
                {sector.name}
              </TabsTrigger>
            ))}
          </TabsList>
          
          <TabsContent value="all" className="flex-1 mt-4">
            <SectorQueuePanel sectorName="Todos os Setores" />
          </TabsContent>
          
          {kdsSectors.map((sector) => (
            <TabsContent key={sector.id} value={sector.id} className="flex-1 mt-4">
              <SectorQueuePanel 
                sectorId={sector.id} 
                sectorName={sector.name} 
              />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <div className="flex-1">
          <SectorQueuePanel sectorName="Fila de Produção" />
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-xl font-medium">Nenhum item em produção</p>
            <p className="text-sm mt-2">Novos itens aparecerão automaticamente</p>
          </div>
        </div>
      )}
    </div>
  );
}
