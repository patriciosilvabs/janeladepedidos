import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Truck, Clock, Bike, Package, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  bgColor: string;
}

function StatCard({ icon: Icon, label, value, color, bgColor }: StatCardProps) {
  return (
    <div className={cn("flex flex-col items-center p-3 rounded-lg", bgColor)}>
      <Icon className={cn("h-5 w-5 mb-1", color)} />
      <span className={cn("text-2xl font-bold", color)}>{value}</span>
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  );
}

export function FoodyStatsPanel() {
  const { data: stats, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['foody-stats'],
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('foody_uid, foody_status, foody_error');

      if (error) throw error;

      const sent = orders?.filter(o => o.foody_uid).length || 0;
      const waiting = orders?.filter(o => o.foody_status === 'open').length || 0;
      const onTheWay = orders?.filter(o => 
        ['assigned', 'on_the_way'].includes(o.foody_status || '')
      ).length || 0;
      const collected = orders?.filter(o => o.foody_status === 'collected').length || 0;
      const errors = orders?.filter(o => o.foody_error).length || 0;

      return { sent, waiting, onTheWay, collected, errors };
    },
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <div className="p-4 rounded-lg border border-border/50 bg-muted/30">
        <div className="flex items-center justify-center h-20">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border border-border/50 bg-muted/30 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Estatísticas Foody</h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-7 px-2"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
        </Button>
      </div>
      
      <div className="grid grid-cols-5 gap-2">
        <StatCard
          icon={Truck}
          label="Enviados"
          value={stats?.sent || 0}
          color="text-blue-600"
          bgColor="bg-blue-50 dark:bg-blue-950/30"
        />
        <StatCard
          icon={Clock}
          label="Aguardando"
          value={stats?.waiting || 0}
          color="text-yellow-600"
          bgColor="bg-yellow-50 dark:bg-yellow-950/30"
        />
        <StatCard
          icon={Bike}
          label="Em Rota"
          value={stats?.onTheWay || 0}
          color="text-purple-600"
          bgColor="bg-purple-50 dark:bg-purple-950/30"
        />
        <StatCard
          icon={Package}
          label="Coletados"
          value={stats?.collected || 0}
          color="text-orange-600"
          bgColor="bg-orange-50 dark:bg-orange-950/30"
        />
        <StatCard
          icon={AlertTriangle}
          label="Erros"
          value={stats?.errors || 0}
          color="text-red-600"
          bgColor="bg-red-50 dark:bg-red-950/30"
        />
      </div>
    </div>
  );
}
