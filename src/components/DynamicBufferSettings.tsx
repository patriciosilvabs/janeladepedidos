import { useEffect, useState, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, Users, TrendingUp, Shield, AlertCircle } from 'lucide-react';
import { useDynamicBufferSettings, DynamicBufferSettings as DynamicBufferSettingsType } from '@/hooks/useDynamicBufferSettings';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { toast } from 'sonner';

export function DynamicBufferSettings() {
  const { settings, isLoading, updateSettings } = useDynamicBufferSettings();
  const [localSettings, setLocalSettings] = useState<Partial<DynamicBufferSettingsType>>({});

  // Initialize local settings when data loads
  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  // Debounced save function
  const debouncedSave = useDebouncedCallback(
    useCallback((updates: Partial<DynamicBufferSettingsType>) => {
      updateSettings.mutate(updates, {
        onError: () => {
          toast.error('Erro ao salvar configurações');
        },
      });
    }, [updateSettings]),
    500
  );

  const handleChange = (field: keyof DynamicBufferSettingsType, value: number | boolean) => {
    const newSettings = { ...localSettings, [field]: value };
    setLocalSettings(newSettings);
    debouncedSave({ [field]: value });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enable Toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/30">
        <div className="space-y-0.5">
          <Label htmlFor="dynamic-enabled" className="text-base font-medium">
            Habilitar Timer Dinâmico por Volume
          </Label>
          <p className="text-sm text-muted-foreground">
            Quando habilitado, o timer do buffer será ajustado automaticamente baseado no número de pedidos ativos
          </p>
        </div>
        <Switch
          id="dynamic-enabled"
          checked={localSettings.enabled || false}
          onCheckedChange={(checked) => handleChange('enabled', checked)}
        />
      </div>

      {localSettings.enabled && (
        <>
          {/* Low Volume Scenario */}
          <Card className="border-green-500/30 bg-green-500/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-green-500" />
                <CardTitle className="text-base">Baixo Movimento</CardTitle>
                <Badge variant="outline" className="text-green-600 border-green-500/50">
                  Prioridade: Velocidade
                </Badge>
              </div>
              <CardDescription>
                Quando há poucos pedidos, priorize a velocidade de entrega
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Mín. pedidos</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={localSettings.low_volume_min_orders ?? 1}
                    onChange={(e) => handleChange('low_volume_min_orders', parseInt(e.target.value) || 1)}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Máx. pedidos</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={localSettings.low_volume_max_orders ?? 3}
                    onChange={(e) => handleChange('low_volume_max_orders', parseInt(e.target.value) || 3)}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Timer (min)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={localSettings.low_volume_timer_minutes ?? 2}
                    onChange={(e) => handleChange('low_volume_timer_minutes', parseInt(e.target.value) || 2)}
                    className="w-full"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                De {localSettings.low_volume_min_orders ?? 1} a {localSettings.low_volume_max_orders ?? 3} pedidos ativos → Timer de {localSettings.low_volume_timer_minutes ?? 2} minutos
              </p>
            </CardContent>
          </Card>

          {/* Medium Volume Scenario */}
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-yellow-500" />
                <CardTitle className="text-base">Movimento Moderado</CardTitle>
                <Badge variant="outline" className="text-yellow-600 border-yellow-500/50">
                  Prioridade: Agrupamento
                </Badge>
              </div>
              <CardDescription>
                Com movimento moderado, aguarde para agrupar pedidos próximos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Mín. pedidos</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={localSettings.medium_volume_min_orders ?? 4}
                    onChange={(e) => handleChange('medium_volume_min_orders', parseInt(e.target.value) || 4)}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Máx. pedidos</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={localSettings.medium_volume_max_orders ?? 8}
                    onChange={(e) => handleChange('medium_volume_max_orders', parseInt(e.target.value) || 8)}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Timer (min)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={localSettings.medium_volume_timer_minutes ?? 5}
                    onChange={(e) => handleChange('medium_volume_timer_minutes', parseInt(e.target.value) || 5)}
                    className="w-full"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                De {localSettings.medium_volume_min_orders ?? 4} a {localSettings.medium_volume_max_orders ?? 8} pedidos ativos → Timer de {localSettings.medium_volume_timer_minutes ?? 5} minutos
              </p>
            </CardContent>
          </Card>

          {/* High Volume Scenario */}
          <Card className="border-red-500/30 bg-red-500/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-red-500" />
                <CardTitle className="text-base">Pico de Demanda</CardTitle>
                <Badge variant="outline" className="text-red-600 border-red-500/50">
                  Prioridade: Eficiência
                </Badge>
              </div>
              <CardDescription>
                Em picos de demanda, maximize o agrupamento para eficiência de frete
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">A partir de (pedidos)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={localSettings.high_volume_min_orders ?? 9}
                    onChange={(e) => handleChange('high_volume_min_orders', parseInt(e.target.value) || 9)}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Timer (min)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={localSettings.high_volume_timer_minutes ?? 8}
                    onChange={(e) => handleChange('high_volume_timer_minutes', parseInt(e.target.value) || 8)}
                    className="w-full"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                A partir de {localSettings.high_volume_min_orders ?? 9} pedidos ativos → Timer de {localSettings.high_volume_timer_minutes ?? 8} minutos
              </p>
            </CardContent>
          </Card>

          {/* Safety Lock */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Trava de Segurança</CardTitle>
              </div>
              <CardDescription>
                Tempo máximo absoluto que um pedido pode ficar no buffer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="space-y-2 flex-1">
                  <Label className="text-sm">Tempo máximo (minutos)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={localSettings.max_buffer_time_minutes ?? 10}
                    onChange={(e) => handleChange('max_buffer_time_minutes', parseInt(e.target.value) || 10)}
                    className="w-24"
                  />
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Independentemente do cenário ativo, nenhum pedido permanecerá mais que {localSettings.max_buffer_time_minutes ?? 10} minutos no buffer. Isso garante o frescor do produto.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
