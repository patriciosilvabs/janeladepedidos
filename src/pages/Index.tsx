import { Header } from '@/components/Header';
import { Dashboard } from '@/components/Dashboard';
import { KDSDashboard } from '@/components/KDSDashboard';
import { useAuth } from '@/hooks/useAuth';
import { useUserSector } from '@/hooks/useSectors';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { userSector, isLoading: sectorLoading } = useUserSector(user?.id);

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
      <Header sectorName={userSector?.name} />
      {isKDSSector ? <KDSDashboard /> : <Dashboard />}
    </div>
  );
};

export default Index;
