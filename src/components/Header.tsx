import { Truck, RefreshCw, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { SettingsDialog } from '@/components/SettingsDialog';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export function Header() {
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const { toast } = useToast();

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
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {user.email}
          </span>
        )}
        <SettingsDialog />
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
