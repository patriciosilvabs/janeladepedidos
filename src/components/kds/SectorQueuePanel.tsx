import { useMemo, useState } from 'react';
import { useOrderItems } from '@/hooks/useOrderItems';
import { useSettings } from '@/hooks/useSettings';
import { KDSItemCard, FifoSettings } from './KDSItemCard';
import { CancellationAlert } from './CancellationAlert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { usePresence } from '@/contexts/PresenceContext';
import { Loader2, AlertCircle, CheckCircle2, Users, UserX } from 'lucide-react';
import { ItemStatus } from '@/types/orderItems';

interface SectorQueuePanelProps {
  sectorId: string;
  sectorName?: string;
}

export function SectorQueuePanel({ 
  sectorId, 
  sectorName = 'Fila de Produção'
}: SectorQueuePanelProps) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { getOnlineOperatorCount, isAnyOperatorOnline } = usePresence();
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Get oven time from settings
  const ovenTimeSeconds = settings?.oven_time_seconds ?? 120;
  
  // FIFO settings
  const fifoSettings: FifoSettings = useMemo(() => ({
    enabled: settings?.kds_fifo_visual_enabled ?? false,
    warningMinutes: settings?.fifo_warning_minutes ?? 3,
    criticalMinutes: settings?.fifo_critical_minutes ?? 5,
    lockEnabled: settings?.fifo_lock_enabled ?? false,
  }), [settings]);
  
  // Get presence info for this sector
  const operatorCount = getOnlineOperatorCount(sectorId);
  const hasOperators = isAnyOperatorOnline(sectorId);

  // Fetch items - ALWAYS filter by sector (sectorId is now required)
  const statusFilter: ItemStatus[] = ['pending', 'in_prep'];

  const { 
    items, 
    pendingItems,
    inPrepItems,
    isLoading, 
    error,
    claimItem,
    releaseItem,
    sendToOven,
    markItemReady,
    completeEdgePreparation,
  } = useOrderItems({ sectorId, status: statusFilter });

  const handleClaim = async (itemId: string) => {
    setProcessingId(itemId);
    try {
      await claimItem.mutateAsync(itemId);
      // Feedback visual via estado do card (sem popup)
    } catch (error: any) {
      console.error('Erro ao capturar item:', error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRelease = async (itemId: string) => {
    setProcessingId(itemId);
    try {
      await releaseItem.mutateAsync(itemId);
      // Feedback visual via estado do card (sem popup)
    } catch (error: any) {
      console.error('Erro ao liberar item:', error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleSendToOven = async (itemId: string) => {
    setProcessingId(itemId);
    try {
      await sendToOven.mutateAsync({ itemId, ovenTimeSeconds });
      // Feedback visual via estado do card (sem popup)
    } catch (error: any) {
      console.error('Erro ao enviar ao forno:', error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkReady = async (itemId: string) => {
    setProcessingId(itemId);
    try {
      await markItemReady.mutateAsync(itemId);
      // Feedback visual via estado do card (sem popup)
    } catch (error: any) {
      console.error('Erro ao marcar pronto:', error.message);
    } finally {
      setProcessingId(null);
    }
  };

   const handleSendToNextSector = async (itemId: string) => {
     setProcessingId(itemId);
     try {
       await completeEdgePreparation.mutateAsync(itemId);
       // Item movido para próximo setor - feedback visual automático
     } catch (error: any) {
       console.error('Erro ao enviar para montagem:', error.message);
     } finally {
       setProcessingId(null);
     }
   };
 
  // Filter items by status for display
  const displayItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      // Ordenação primária por created_at
      if (timeA !== timeB) return timeA - timeB;
      // Ordenação secundária por ID para estabilidade absoluta
      return a.id.localeCompare(b.id);
    });
  }, [items]);

  // Identifica o primeiro item pendente para exibir o badge "FILA"
  const firstPendingId = useMemo(() => {
    const firstPending = displayItems.find(i => i.status === 'pending');
    return firstPending?.id ?? null;
  }, [displayItems]);

  // Calcula a posição na fila para cada item pendente
  const getQueuePosition = (itemId: string): number | undefined => {
    // Posição baseada na ordem de criação, independente do status
    const index = displayItems.findIndex(i => i.id === itemId);
    return index >= 0 ? index + 1 : undefined;
  };

  // Verifica se há algum item em preparo (para lógica de lock)
  const hasItemsInPrep = displayItems.some(i => i.status === 'in_prep');

  // Determina se um item pode ser iniciado (considerando lock FIFO)
  const canStartItem = (itemId: string): boolean => {
    if (!fifoSettings.enabled || !fifoSettings.lockEnabled) {
      return true;
    }
    // Se lock está ativo, só permite iniciar se for o primeiro da fila
    // OU se já houver itens em preparo (não bloqueia totalmente)
    const position = getQueuePosition(itemId);
    return position === 1;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="flex items-center justify-center gap-2 py-8 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>Erro ao carregar itens</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">{sectorName}</CardTitle>
            <Badge 
              variant={hasOperators ? "outline" : "destructive"}
              className={`gap-1 text-xs ${hasOperators ? 'bg-primary/10 text-primary' : ''}`}
            >
              {hasOperators ? (
                <>
                  <Users className="h-3 w-3" />
                  {operatorCount} online
                </>
              ) : (
                <>
                  <UserX className="h-3 w-3" />
                  Sem operador
                </>
              )}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {pendingItems.length > 0 && (
              <Badge className="bg-amber-500 text-white">
                {pendingItems.length} pendente{pendingItems.length > 1 ? 's' : ''}
              </Badge>
            )}
            {inPrepItems.length > 0 && (
              <Badge className="bg-blue-500 text-white">
                {inPrepItems.length} em preparo
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Cancellation alerts */}
        <CancellationAlert sectorId={sectorId} />
        
        {displayItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 opacity-30 mb-3" />
            <p className="text-lg font-medium">Nenhum item na fila</p>
            <p className="text-sm">Novos itens aparecerão automaticamente</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {displayItems.map((item) => (
              <KDSItemCard
                key={item.id}
                item={item}
                onClaim={() => handleClaim(item.id)}
                onRelease={() => handleRelease(item.id)}
                onSendToOven={() => handleSendToOven(item.id)}
                onSendToNextSector={() => handleSendToNextSector(item.id)}
                isProcessing={processingId === item.id}
                currentUserId={user?.id}
                fifoSettings={fifoSettings}
                queuePosition={getQueuePosition(item.id)}
                canStartItem={canStartItem(item.id)}
              isFirstPending={item.id === firstPendingId}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
