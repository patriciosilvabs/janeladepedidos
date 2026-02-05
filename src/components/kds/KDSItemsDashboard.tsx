import { useMemo } from 'react';
import { useSectors, Sector } from '@/hooks/useSectors';
import { SectorQueuePanel } from './SectorQueuePanel';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface KDSItemsDashboardProps {
  userSector?: Sector | null;
}

export function KDSItemsDashboard({ userSector }: KDSItemsDashboardProps) {
  // If user has a sector, use it as filter
  const filterSectorId = userSector?.id;
  
  const { sectors, isLoading: sectorsLoading } = useSectors();

  // Filter KDS sectors (view_type = 'kds') - only for admins without sector
  const kdsSectors = useMemo(
    () => sectors?.filter((s) => s.view_type === 'kds') ?? [],
    [sectors]
  );

  if (sectorsLoading) {
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
        /* Admins/owners without sector see each sector in separate tabs - NO "All" option */
        kdsSectors.length > 1 ? (
          <Tabs defaultValue={kdsSectors[0]?.id} className="flex-1 flex flex-col">
            <TabsList>
              {kdsSectors.map((sector) => (
                <TabsTrigger key={sector.id} value={sector.id}>
                  {sector.name}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {kdsSectors.map((sector) => (
              <TabsContent key={sector.id} value={sector.id} className="flex-1 mt-4">
                <SectorQueuePanel 
                  sectorId={sector.id} 
                  sectorName={sector.name} 
                />
              </TabsContent>
            ))}
          </Tabs>
        ) : kdsSectors.length === 1 ? (
          <div className="flex-1">
            <SectorQueuePanel 
              sectorId={kdsSectors[0].id} 
              sectorName={kdsSectors[0].name} 
            />
          </div>
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
