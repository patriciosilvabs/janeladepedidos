import { Truck, RefreshCw, LogOut, Crown, Maximize, Minimize, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQueryClient } from '@tanstack/react-query';
import { SettingsDialog } from '@/components/SettingsDialog';
import { EditProfileDialog } from '@/components/EditProfileDialog';
import { OrderSimulator } from '@/components/OrderSimulator';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';

interface HeaderProps {
  sectorName?: string;
  children?: React.ReactNode;
}

export function Header({ sectorName, children }: HeaderProps) {
  const queryClient = useQueryClient();
  const { user, isOwner, isAdmin, signOut } = useAuth();
  const { toast } = useToast();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
  };

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao fazer logout',
      });
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível alternar tela cheia',
      });
    }
  };

  return (
    <header className="flex h-20 items-center justify-between border-b border-border/50 bg-card/50 px-6 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
          <Truck className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Buffer Logístico</h1>
          <p className="text-sm text-muted-foreground">
            Agrupamento inteligente de entregas
          </p>
        </div>
        {sectorName && (
          <Badge variant="outline" className="ml-2 gap-1">
            <Building2 className="h-3 w-3" />
            {sectorName}
          </Badge>
        )}
        {children}
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2">
            {isOwner && (
              <Badge variant="default" className="gap-1">
                <Crown className="h-3 w-3" />
                Proprietário
              </Badge>
            )}
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user.email}
            </span>
          </div>
        )}
        {isAdmin && <OrderSimulator />}
        {isAdmin && <SettingsDialog />}
        <EditProfileDialog />
        <Button variant="outline" size="icon" onClick={toggleFullscreen} title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}>
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
        <Button variant="outline" size="icon" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleLogout} title="Sair">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
