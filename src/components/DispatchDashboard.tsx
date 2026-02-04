import { useOrderItems } from '@/hooks/useOrderItems';
import { OvenTimerPanel } from '@/components/kds/OvenTimerPanel';
import { Flame } from 'lucide-react';

export function DispatchDashboard() {
  const { inOvenItems } = useOrderItems({ status: 'in_oven' });

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] p-4 md:p-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
          <Flame className="h-6 w-6 text-orange-500" />
          Painel do Forno
        </h1>
        <p className="text-muted-foreground mt-1">
          Itens aguardando finalização
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {inOvenItems.length === 0 ? (
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
            <OvenTimerPanel />
          </div>
        )}
      </div>
    </div>
  );
}
