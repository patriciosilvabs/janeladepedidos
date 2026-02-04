import { useState } from 'react';
import { Header } from '@/components/Header';
import { Dashboard } from '@/components/Dashboard';
import { KDSDashboard } from '@/components/KDSDashboard';
import { KDSItemsDashboard } from '@/components/kds';
import { useAuth } from '@/hooks/useAuth';
import { useUserSector } from '@/hooks/useSectors';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { userSector, isLoading: sectorLoading } = useUserSector(user?.id);
  const [kdsMode, setKdsMode] = useState<'orders' | 'items'>('items');

  // Show loading while auth or sector data is loading
  if (authLoading || sectorLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Determine which dashboard to show based on user's sector
  const isKDSSector = userSector?.view_type === 'kds';

  return (
    <div className="min-h-screen bg-background">
      <Header sectorName={userSector?.name}>
        {isKDSSector && (
          <Tabs value={kdsMode} onValueChange={(v) => setKdsMode(v as 'orders' | 'items')}>
            <TabsList className="h-8">
              <TabsTrigger value="items" className="text-xs px-3">
                Por Item
              </TabsTrigger>
              <TabsTrigger value="orders" className="text-xs px-3">
                Por Pedido
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </Header>
      {isKDSSector 
        ? (kdsMode === 'items' 
            ? <KDSItemsDashboard userSector={userSector} /> 
            : <KDSDashboard userSector={userSector} />) 
        : <Dashboard />
      }
    </div>
  );
};

export default Index;
