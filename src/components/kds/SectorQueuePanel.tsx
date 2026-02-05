import { useMemo, useState } from 'react';
import { useOrderItems } from '@/hooks/useOrderItems';
import { useSettings } from '@/hooks/useSettings';
import { KDSItemCard } from './KDSItemCard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { usePresence } from '@/contexts/PresenceContext';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();
  const { settings } = useSettings();
  const { getOnlineOperatorCount, isAnyOperatorOnline } = usePresence();
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Get oven time from settings
  const ovenTimeSeconds = settings?.oven_time_seconds ?? 120;
  
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
  } = useOrderItems({ sectorId, status: statusFilter });

  const handleClaim = async (itemId: string) => {
    setProcessingId(itemId);
    try {
      await claimItem.mutateAsync(itemId);
      toast({
        title: 'Item capturado!',
        description: 'Você pode iniciar o preparo.',
      });
    } catch (error: any) {
      toast({
        title: 'Não foi possível capturar',
        description: error.message || 'Outro operador pode ter sido mais rápido.',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRelease = async (itemId: string) => {
    setProcessingId(itemId);
    try {
      await releaseItem.mutateAsync(itemId);
      toast({
        title: 'Item liberado',
        description: 'Outros operadores podem capturá-lo.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao liberar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleSendToOven = async (itemId: string) => {
    setProcessingId(itemId);
    try {
      await sendToOven.mutateAsync({ itemId, ovenTimeSeconds });
      const minutes = Math.floor(ovenTimeSeconds / 60);
      const seconds = ovenTimeSeconds % 60;
      const timeStr = seconds > 0 ? `${minutes}m${seconds}s` : `${minutes} minutos`;
      toast({
        title: '🔥 Enviado ao forno!',
        description: `Timer de ${timeStr} iniciado.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkReady = async (itemId: string) => {
    setProcessingId(itemId);
    try {
      await markItemReady.mutateAsync(itemId);
      toast({
        title: '✓ Item pronto!',
        description: 'Aguardando despacho.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Filter items by status for display
  const displayItems = useMemo(() => {
    // Show pending first, then in_prep
    return [...items].sort((a, b) => {
      const statusOrder = { pending: 0, in_prep: 1, in_oven: 2, ready: 3 };
      const orderA = statusOrder[a.status] ?? 99;
      const orderB = statusOrder[b.status] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      // Then by created_at
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [items]);

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
                isProcessing={processingId === item.id}
                currentUserId={user?.id}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
