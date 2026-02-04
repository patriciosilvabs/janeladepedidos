import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Dashboard } from '@/components/Dashboard';
import { DispatchDashboard } from '@/components/DispatchDashboard';
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
  const [mainView, setMainView] = useState<'dashboard' | 'kds'>('dashboard');

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
  const isDispatchSector = userSector?.view_type === 'dispatch';
  
  // KDS mode: admin can toggle, regular users use the configured default
  const effectiveKdsMode = isAdmin ? kdsMode : (settings?.kds_default_mode || 'items');
  const showKdsTabs = isAdmin && isKDSSector;
  
  // Show main view tabs for admins without a KDS sector (management or no sector)
  const showMainViewTabs = isAdmin && !isKDSSector && !isDispatchSector;

  return (
    <div className="min-h-screen bg-background">
      <Header sectorName={userSector?.name} isFullscreen={isFullscreen}>
        {/* Main view tabs for admins without KDS sector */}
        {showMainViewTabs && !isFullscreen && (
          <Tabs value={mainView} onValueChange={(v) => setMainView(v as 'dashboard' | 'kds')}>
            <TabsList className="h-8">
              <TabsTrigger value="dashboard" className="text-xs px-3">
                Despacho
              </TabsTrigger>
              <TabsTrigger value="kds" className="text-xs px-3">
                KDS Produção
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {/* KDS mode tabs (items vs orders) for admins in KDS sector */}
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
      : isDispatchSector
        ? <DispatchDashboard />
          : mainView === 'kds'
            ? <KDSItemsDashboard />
            : <Dashboard />
      }
    </div>
  );
};

export default Index;
