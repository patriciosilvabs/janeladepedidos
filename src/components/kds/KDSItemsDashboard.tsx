import { useMemo } from 'react';
import { useSectors, Sector } from '@/hooks/useSectors';
import { SectorQueuePanel } from './SectorQueuePanel';
import { OvenTimerPanel } from './OvenTimerPanel';
import { useOrderItems } from '@/hooks/useOrderItems';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CheckCircle2, Flame } from 'lucide-react';

interface KDSItemsDashboardProps {
  userSector?: Sector | null;
}

export function KDSItemsDashboard({ userSector }: KDSItemsDashboardProps) {
  // If user has a sector, use it as filter
  const filterSectorId = userSector?.id;
  
  const { sectors, isLoading: sectorsLoading } = useSectors();
  const { isAdmin } = useAuth();
  const { inOvenItems } = useOrderItems({ status: 'in_oven' });

  // Filter KDS sectors (view_type = 'kds') - only for admins without sector
  const kdsSectors = useMemo(
    () => sectors?.filter((s) => s.view_type === 'kds') ?? [],
    [sectors]
  );

  // Show oven tab for admins without a fixed sector
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
      {inOvenItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center py-16">
          <Flame className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold text-muted-foreground">Nenhum item no forno</h2>
          <p className="text-sm text-muted-foreground/70 mt-2">
            Os itens aparecerão aqui quando as bancadas enviarem para o forno
          </p>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">
          <OvenTimerPanel />
        </div>
      )}
    </TabsContent>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] p-4 gap-4">
      {/* Header Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">KDS - Itens</h1>
        </div>
      </div>

      {/* If user is linked to a sector, show ONLY that sector's queue (no tabs) */}
      {filterSectorId ? (
        <div className="flex-1">
          <SectorQueuePanel 
            sectorId={filterSectorId} 
            sectorName={userSector?.name || 'Fila de Produção'} 
          />
        </div>
      ) : (
        /* Admins/owners without sector see each sector in separate tabs */
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
