import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Dashboard } from '@/components/Dashboard';
import { KDSDashboard } from '@/components/KDSDashboard';
import { KDSItemsDashboard } from '@/components/kds';
import { useAuth } from '@/hooks/useAuth';
import { useUserSector } from '@/hooks/useSectors';
import { useSettings } from '@/hooks/useSettings';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Index = () => {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { userSector, isLoading: sectorLoading } = useUserSector(user?.id);
  const { settings, isLoading: settingsLoading } = useSettings();
  const [kdsMode, setKdsMode] = useState<'orders' | 'items'>('items');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Show loading while auth or sector data is loading
  if (authLoading || sectorLoading || settingsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Determine which dashboard to show based on user's sector
  const isKDSSector = userSector?.view_type === 'kds';
  
  // KDS mode: admin can toggle, regular users use the configured default
  const effectiveKdsMode = isAdmin ? kdsMode : (settings?.kds_default_mode || 'items');
  const showKdsTabs = isAdmin && isKDSSector;

  return (
    <div className="min-h-screen bg-background">
      <Header sectorName={userSector?.name} isFullscreen={isFullscreen}>
        {showKdsTabs && !isFullscreen && (
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
        ? (effectiveKdsMode === 'items' 
            ? <KDSItemsDashboard userSector={userSector} /> 
            : <KDSDashboard userSector={userSector} />) 
        : <Dashboard />
      }
    </div>
  );
};

export default Index;
