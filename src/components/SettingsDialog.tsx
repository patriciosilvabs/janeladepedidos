import { useState, useEffect, useCallback } from 'react';
import { Settings, Eye, EyeOff, Loader2, AlertCircle, Copy, Check, Store, Users, Truck, CheckCircle, XCircle, Calendar, Building2, Monitor, Flame, Target, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { AppSettings as AppSettingsType } from '@/hooks/useSettings';
import { StoresManager } from '@/components/StoresManager';
import { UsersAdminPanel } from '@/components/UsersAdminPanel';
import { InvitationsPanel } from '@/components/InvitationsPanel';
import { FoodyStatsPanel } from '@/components/FoodyStatsPanel';
import { DynamicBufferSettings } from '@/components/DynamicBufferSettings';
import { SectorsManager } from '@/components/SectorsManager';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useSettings, AppSettings } from '@/hooks/useSettings';
import { useBufferSettings } from '@/hooks/useBufferSettings';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function SettingsDialog() {
  const { settings, isLoading, saveSettings, testFoodyConnection } = useSettings();
  const { bufferSettings, updateBufferSetting, getDayName, isLoading: isLoadingBuffer } = useBufferSettings();
  const { isOwner, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<AppSettings>>({});
  const [showCardapioWebhook, setShowCardapioWebhook] = useState(false);
  const [showFoodyToken, setShowFoodyToken] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [foodyWebhookCopied, setFoodyWebhookCopied] = useState(false);
  const [foodyTestStatus, setFoodyTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [foodyTestError, setFoodyTestError] = useState('');
  const [foodyUrlWarning, setFoodyUrlWarning] = useState('');

  // Auto-save function for critical settings (KDS, Buffer)
  const debouncedAutoSave = useDebouncedCallback(
    useCallback((updates: Partial<AppSettingsType>) => {
      saveSettings.mutate(updates, {
        onError: () => toast.error('Erro ao salvar configuração'),
        onSuccess: () => toast.success('Configuração salva', { duration: 2000 }),
      });
    }, [saveSettings]),
    800
  );

  // Local state for buffer input values to avoid lag
  const [localBufferValues, setLocalBufferValues] = useState<Record<number, number>>({});
  
  // Initialize local buffer values when settings load
  useEffect(() => {
    const initial: Record<number, number> = {};
    bufferSettings.forEach((s) => {
      initial[s.day_of_week] = s.buffer_timeout_minutes;
    });
    setLocalBufferValues(initial);
  }, [bufferSettings]);
  
  // Debounced save for buffer settings
  const debouncedUpdateBuffer = useDebouncedCallback(
    useCallback((dayOfWeek: number, value: number) => {
      updateBufferSetting.mutate({
        dayOfWeek,
        bufferTimeoutMinutes: value,
      });
    }, [updateBufferSetting]),
    500
  );

  const validateFoodyUrl = (url: string): string => {
    if (!url) return '';
    if (url.endsWith('/')) {
      return 'A URL não deve terminar com barra (/)';
    }
    if (!url.includes('/rest/')) {
      return 'A URL deve conter o caminho da API (ex: /rest/1.2)';
    }
    const matches = url.match(/\/rest\//g);
    if (matches && matches.length > 1) {
      return 'URL contém caminho duplicado (/rest/)';
    }
    return '';
  };

  const foodyWebhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/foody-webhook`;

  const handleCopyFoodyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(foodyWebhookUrl);
      setFoodyWebhookCopied(true);
      setTimeout(() => setFoodyWebhookCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-orders`;

  const handleCopyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setWebhookCopied(true);
      setTimeout(() => setWebhookCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      // Normalizar URL do Foody
      let normalizedFoodyUrl = formData.foody_api_url?.trim();
      if (normalizedFoodyUrl) {
        normalizedFoodyUrl = normalizedFoodyUrl.replace(/\/+$/, '');
      }

      const dataToSave = {
        ...formData,
        foody_api_url: normalizedFoodyUrl,
      };

      await saveSettings.mutateAsync(dataToSave);
      toast.success('Configurações salvas com sucesso!');
      setOpen(false);
    } catch (error) {
      toast.error('Erro ao salvar configurações');
      console.error(error);
    }
  };

  const handleTestFoodyConnection = async () => {
    if (!formData.foody_api_token) {
      toast.error('Informe o token da API do Foody');
      return;
    }

    setFoodyTestStatus('testing');
    setFoodyTestError('');

    try {
      await testFoodyConnection.mutateAsync({
        token: formData.foody_api_token,
        url: formData.foody_api_url || 'https://app.foodydelivery.com/rest/1.2',
      });
      setFoodyTestStatus('success');
      toast.success('Conexão com Foody estabelecida!');
    } catch (error: any) {
      setFoodyTestStatus('error');
      setFoodyTestError(error.message || 'Erro ao conectar');
      toast.error('Erro ao conectar com Foody');
    }
  };

  const getApiStatus = () => {
    const cardapioConfigured = settings?.cardapioweb_enabled && settings?.cardapioweb_api_token;

    if (cardapioConfigured) {
      return { color: 'bg-green-500', text: 'API OK' };
    }
    return { color: 'bg-muted-foreground', text: 'Não configurado' };
  };

  const apiStatus = getApiStatus();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <div className={`h-2 w-2 rounded-full ${apiStatus.color}`} />
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Configurações</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações do Sistema</DialogTitle>
          <DialogDescription>
            Configure as integrações com Cardápio Web e Foody Delivery
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="stores" className="w-full">
            <TabsList className={`grid w-full ${isOwner ? 'grid-cols-4 sm:grid-cols-7' : 'grid-cols-2 sm:grid-cols-4'} gap-1`}>
              <TabsTrigger value="stores" className="text-xs sm:text-sm">
                <Store className="h-3 w-3 mr-1 hidden sm:inline" />
                Lojas
              </TabsTrigger>
              <TabsTrigger value="cardapio" className="text-xs sm:text-sm">Card.</TabsTrigger>
              <TabsTrigger value="foody" className="text-xs sm:text-sm">
                <Truck className="h-3 w-3 mr-1 hidden sm:inline" />
                Foody
              </TabsTrigger>
              <TabsTrigger value="buffer" className="text-xs sm:text-sm">Buffer</TabsTrigger>
              {isOwner && (
                <TabsTrigger value="kds" className="text-xs sm:text-sm">
                  <Monitor className="h-3 w-3 mr-1 hidden sm:inline" />
                  KDS
                </TabsTrigger>
              )}
              {isOwner && (
                <TabsTrigger value="sectors" className="text-xs sm:text-sm">
                  <Building2 className="h-3 w-3 mr-1 hidden sm:inline" />
                  Setores
                </TabsTrigger>
              )}
              {isOwner && (
                <TabsTrigger value="users" className="text-xs sm:text-sm">
                  <Users className="h-3 w-3 mr-1 hidden sm:inline" />
                  Usuários
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="stores" className="space-y-4 mt-4">
              <StoresManager />
            </TabsContent>

            <TabsContent value="cardapio" className="space-y-4 mt-4">
              <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/30">
                <div className="space-y-0.5">
                  <Label htmlFor="cardapio-enabled" className="text-base font-medium">
                    Habilitar integração CardápioWeb
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Quando desabilitado, não busca pedidos nem envia notificações
                  </p>
                </div>
                <Switch
                  id="cardapio-enabled"
                  checked={formData.cardapioweb_enabled || false}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, cardapioweb_enabled: checked })
                  }
                />
              </div>

              <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Configure os tokens API de cada loja na aba <strong>Lojas</strong>. Aqui ficam apenas as configurações globais de webhook.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardapio-webhook">Token Webhook (X-Webhook-Token)</Label>
                <p className="text-sm text-muted-foreground">
                  Token global para validar webhooks recebidos do Cardápio Web
                </p>
                <div className="relative">
                  <Input
                    id="cardapio-webhook"
                    type={showCardapioWebhook ? 'text' : 'password'}
                    value={formData.cardapioweb_webhook_token || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, cardapioweb_webhook_token: e.target.value })
                    }
                    placeholder="Token para validar webhooks recebidos"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowCardapioWebhook(!showCardapioWebhook)}
                  >
                    {showCardapioWebhook ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="pt-4 border-t border-border/50">
                <Label>URL do Webhook</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Configure esta URL no painel do Cardápio Web para receber pedidos automaticamente
                </p>
                <div className="flex gap-2">
                  <Input
                    value={webhookUrl}
                    readOnly
                    className="font-mono text-xs bg-muted"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopyWebhook}
                    className="shrink-0"
                  >
                    {webhookCopied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="foody" className="space-y-4 mt-4">
              <FoodyStatsPanel />

              <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/30">
                <div className="space-y-0.5">
                  <Label htmlFor="foody-enabled" className="text-base font-medium">
                    Habilitar integração com Foody
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Envia pedidos automaticamente para o Foody Delivery quando saem do buffer
                  </p>
                </div>
                <Switch
                  id="foody-enabled"
                  checked={formData.foody_enabled || false}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, foody_enabled: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="foody-url">URL da API</Label>
                <Input
                  id="foody-url"
                  value={formData.foody_api_url || 'https://app.foodydelivery.com/rest/1.2'}
                  onChange={(e) => {
                    const url = e.target.value;
                    setFormData({ ...formData, foody_api_url: url });
                    setFoodyUrlWarning(validateFoodyUrl(url));
                  }}
                  placeholder="https://app.foodydelivery.com/rest/1.2"
                />
                {foodyUrlWarning && (
                  <div className="flex items-center gap-2 text-amber-500 text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{foodyUrlWarning}</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Formato esperado: https://app.foodydelivery.com/rest/1.2
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="foody-token">Token de Autenticação</Label>
                <div className="relative">
                  <Input
                    id="foody-token"
                    type={showFoodyToken ? 'text' : 'password'}
                    value={formData.foody_api_token || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, foody_api_token: e.target.value })
                    }
                    placeholder="Seu token da API Foody"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowFoodyToken(!showFoodyToken)}
                  >
                    {showFoodyToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={handleTestFoodyConnection}
                  disabled={foodyTestStatus === 'testing' || !formData.foody_api_token}
                >
                  {foodyTestStatus === 'testing' ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testando...
                    </>
                  ) : (
                    'Testar Conexão'
                  )}
                </Button>

                {foodyTestStatus === 'success' && (
                  <div className="flex items-center gap-2 text-green-500">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Conectado</span>
                  </div>
                )}

                {foodyTestStatus === 'error' && (
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-4 w-4" />
                    <span className="text-sm">{foodyTestError || 'Erro na conexão'}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-border/50">
                <Label>URL do Webhook (configurar no Foody)</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Configure esta URL no painel do Foody para receber atualizações de status dos entregadores
                </p>
                <div className="flex gap-2">
                  <Input
                    value={foodyWebhookUrl}
                    readOnly
                    className="font-mono text-xs bg-muted"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopyFoodyWebhook}
                    className="shrink-0"
                  >
                    {foodyWebhookCopied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                <p className="text-sm text-muted-foreground">
                  <strong>Nota:</strong> Os pedidos serão enviados automaticamente ao Foody 
                  quando saírem do buffer de espera e forem marcados como "prontos para entrega".
                </p>
              </div>
            </TabsContent>

            <TabsContent value="buffer" className="space-y-4 mt-4">
              {/* Dynamic Buffer Settings */}
              <DynamicBufferSettings />

              <div className="border-t border-border/50 pt-4">
                <div className="space-y-2 mb-6">
                  <Label htmlFor="buffer-timeout">Tempo Padrão (minutos)</Label>
                  <p className="text-sm text-muted-foreground">
                    Usado quando o timer dinâmico está desabilitado ou como fallback
                  </p>
                  <Input
                    id="buffer-timeout"
                    type="number"
                    min={1}
                    max={60}
                    value={formData.buffer_timeout_minutes || 10}
                    onChange={(e) =>
                      setFormData({ ...formData, buffer_timeout_minutes: parseInt(e.target.value) || 10 })
                    }
                  />
                </div>
              </div>

              <div className="border-t border-border/50 pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-base font-medium">Configuração por Dia da Semana</Label>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Usado quando o timer dinâmico está desabilitado
                </p>
                
                {isLoadingBuffer ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bufferSettings.map((setting) => (
                      <div 
                        key={setting.id}
                        className="flex items-center gap-4 p-3 rounded-lg border border-border/50 bg-muted/30"
                      >
                        <div className="w-24">
                          <span className="font-medium">{getDayName(setting.day_of_week)}</span>
                        </div>
                        <div className="flex-1">
                          <Input
                            type="number"
                            min={1}
                            max={60}
                            value={localBufferValues[setting.day_of_week] ?? setting.buffer_timeout_minutes}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 10;
                              setLocalBufferValues(prev => ({
                                ...prev,
                                [setting.day_of_week]: value
                              }));
                              debouncedUpdateBuffer(setting.day_of_week, value);
                            }}
                            className="w-20"
                          />
                        </div>
                        <span className="text-sm text-muted-foreground">min</span>
                        <Switch
                          checked={setting.enabled}
                          onCheckedChange={(checked) => {
                            updateBufferSetting.mutate({
                              dayOfWeek: setting.day_of_week,
                              enabled: checked,
                            });
                          }}
                        />
                        <span className="text-sm text-muted-foreground w-16">
                          {setting.enabled ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground mt-4">
                  Quando um dia está inativo, será usado o tempo padrão configurado acima.
                </p>
              </div>

              {/* Urgent Order Bypass Settings */}
              <div className="border-t border-border/50 pt-4 mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <Label className="text-base font-medium">Sistema de Bypass para Pedidos Urgentes</Label>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Pedidos que excedem o tempo limite em produção são marcados como urgentes e pulam o buffer quando marcados como prontos.
                </p>

                <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/30 mb-4">
                  <div className="space-y-0.5">
                    <Label>Habilitar Bypass de Urgência</Label>
                    <p className="text-sm text-muted-foreground">
                      Quando ativo, pedidos urgentes vão direto para entrega sem esperar no buffer
                    </p>
                  </div>
                  <Switch
                    checked={(formData as any).urgent_bypass_enabled ?? true}
                    onCheckedChange={(checked) =>
                      {
                        setFormData({ ...formData, urgent_bypass_enabled: checked } as any);
                        debouncedAutoSave({ urgent_bypass_enabled: checked });
                      }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="urgent-timeout">Tempo limite em produção (minutos)</Label>
                  <p className="text-sm text-muted-foreground">
                    Pedidos que ultrapassarem este tempo são marcados como urgentes (borda vermelha)
                  </p>
                  <Input
                    id="urgent-timeout"
                    type="number"
                    min={5}
                    max={120}
                    value={(formData as any).urgent_production_timeout_minutes ?? 25}
                    onChange={(e) =>
                      {
                        const value = parseInt(e.target.value) || 25;
                        setFormData({ ...formData, urgent_production_timeout_minutes: value } as any);
                        debouncedAutoSave({ urgent_production_timeout_minutes: value });
                      }}
                    className="w-24"
                  />
                </div>

                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 mt-4">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    <strong>Comportamento:</strong> Pedidos urgentes ao serem marcados como "Pronto" vão diretamente 
                    para a coluna de prontos e são enviados ao entregador como rota individual (sem agrupamento).
                  </p>
                </div>
              </div>

              {/* Dispatched Column Settings */}
              <div className="border-t border-border/50 pt-4 mt-6">
                <Label className="text-base font-medium mb-4 block">
                  Configurações da Coluna Despachados
                </Label>
                
                {/* Sort Order */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/30 mb-4">
                  <div className="space-y-0.5">
                    <Label>Ordenar do mais recente para o mais antigo</Label>
                    <p className="text-sm text-muted-foreground">
                      Quando habilitado, pedidos mais recentes aparecem no topo
                    </p>
                  </div>
                  <Switch
                    checked={formData.dispatched_order_sort_desc ?? true}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, dispatched_order_sort_desc: checked })
                    }
                  />
                </div>
                
                {/* Visibility Time */}
                <div className="space-y-2">
                  <Label htmlFor="dispatched-visibility">Tempo de visibilidade (minutos)</Label>
                  <p className="text-sm text-muted-foreground">
                    Pedidos despachados são ocultados após este tempo (ex: 60 = 1 hora)
                  </p>
                  <Input
                    id="dispatched-visibility"
                    type="number"
                    min={5}
                    max={1440}
                    value={formData.dispatched_visibility_minutes ?? 60}
                    onChange={(e) =>
                      setFormData({ ...formData, dispatched_visibility_minutes: parseInt(e.target.value) || 60 })
                    }
                    className="w-24"
                  />
                </div>
              </div>
            </TabsContent>

            {isOwner && (
              <TabsContent value="kds" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-medium">Modo de Visualização KDS</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Define como os operadores de cozinha visualizam os pedidos. Esta configuração afeta todos os usuários vinculados a setores KDS.
                    </p>
                  </div>

                  <RadioGroup
                    value={(formData as any).kds_default_mode || 'items'}
                    onValueChange={(value) =>
                      {
                        setFormData({ ...formData, kds_default_mode: value as 'items' | 'orders' } as any);
                        debouncedAutoSave({ kds_default_mode: value as 'items' | 'orders' });
                      }}
                    className="space-y-3"
                  >
                    <div className="flex items-start space-x-3 p-4 rounded-lg border border-border/50 bg-muted/30">
                      <RadioGroupItem value="items" id="kds-items" className="mt-1" />
                      <div className="space-y-1">
                        <Label htmlFor="kds-items" className="font-medium cursor-pointer">
                          Por Item
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Cada item do pedido aparece como um card individual. Ideal para cozinhas com múltiplos operadores trabalhando em paralelo.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 p-4 rounded-lg border border-border/50 bg-muted/30">
                      <RadioGroupItem value="orders" id="kds-orders" className="mt-1" />
                      <div className="space-y-1">
                        <Label htmlFor="kds-orders" className="font-medium cursor-pointer">
                          Por Pedido
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Cada pedido aparece como um card único com todos os itens listados. Ideal para cozinhas onde um operador prepara o pedido completo.
                        </p>
                      </div>
                    </div>
                  </RadioGroup>

                  <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                    <p className="text-sm text-muted-foreground">
                      <strong>Nota:</strong> Administradores podem alternar entre os modos a qualquer momento para visualização. Os operadores sempre verão o modo configurado aqui.
                    </p>
                  </div>

                  {/* Oven Time Configuration */}
                  <div className="border-t border-border/50 pt-4 mt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Flame className="h-4 w-4 text-orange-500" />
                      <Label className="text-base font-medium">Tempo do Forno</Label>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Define o tempo padrão da esteira do forno. Este tempo é usado para calcular a contagem regressiva quando um item é enviado ao forno.
                    </p>
                    
                    <div className="space-y-2">
                      <Label htmlFor="oven-time">Duração (segundos)</Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id="oven-time"
                          type="number"
                          min={30}
                          max={600}
                          value={(formData as any).oven_time_seconds ?? 120}
                          onChange={(e) =>
                            {
                              const value = parseInt(e.target.value) || 120;
                              setFormData({ ...formData, oven_time_seconds: value } as any);
                              debouncedAutoSave({ oven_time_seconds: value });
                            }}
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">
                          = {Math.floor(((formData as any).oven_time_seconds ?? 120) / 60)}m {((formData as any).oven_time_seconds ?? 120) % 60}s
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Valores comuns: 90s (1m30s), 120s (2m), 150s (2m30s), 180s (3m)
                      </p>
                    </div>
                  </div>

                  {/* FIFO Visual System */}
                  <div className="border-t border-border/50 pt-4 mt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Target className="h-4 w-4 text-primary" />
                      <Label className="text-base font-medium">Sistema Visual FIFO</Label>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Destaca visualmente os itens por ordem de entrada, com cores de urgência e badges de sequência.
                    </p>

                    <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/30 mb-4">
                      <div className="space-y-0.5">
                        <Label>Habilitar Priorização Visual FIFO</Label>
                        <p className="text-sm text-muted-foreground">
                          Semáforo de cores, badges de sequência (#1, #2) e barra de progresso
                        </p>
                      </div>
                      <Switch
                        checked={(formData as any).kds_fifo_visual_enabled ?? false}
                        onCheckedChange={(checked) => {
                          setFormData({ ...formData, kds_fifo_visual_enabled: checked } as any);
                          debouncedAutoSave({ kds_fifo_visual_enabled: checked });
                        }}
                      />
                    </div>

                    {/* Configurações adicionais quando FIFO está ativo */}
                    {(formData as any).kds_fifo_visual_enabled && (
                      <div className="space-y-4 pl-4 border-l-2 border-primary/30">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="fifo-warning">Alerta amarelo (min)</Label>
                            <Input
                              id="fifo-warning"
                              type="number"
                              min={1}
                              max={30}
                              value={(formData as any).fifo_warning_minutes ?? 3}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 3;
                                setFormData({ ...formData, fifo_warning_minutes: value } as any);
                                debouncedAutoSave({ fifo_warning_minutes: value });
                              }}
                              className="w-20"
                            />
                            <p className="text-xs text-muted-foreground">Verde → Amarelo</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="fifo-critical">Alerta vermelho (min)</Label>
                            <Input
                              id="fifo-critical"
                              type="number"
                              min={1}
                              max={60}
                              value={(formData as any).fifo_critical_minutes ?? 5}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 5;
                                setFormData({ ...formData, fifo_critical_minutes: value } as any);
                                debouncedAutoSave({ fifo_critical_minutes: value });
                              }}
                              className="w-20"
                            />
                            <p className="text-xs text-muted-foreground">Amarelo → Vermelho</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/30">
                          <div className="space-y-0.5">
                            <Label>Bloquear seleção fora de ordem</Label>
                            <p className="text-sm text-muted-foreground">
                              Só permite iniciar o próximo item após o anterior estar em preparo
                            </p>
                          </div>
                          <Switch
                            checked={(formData as any).fifo_lock_enabled ?? false}
                            onCheckedChange={(checked) => {
                              setFormData({ ...formData, fifo_lock_enabled: checked } as any);
                              debouncedAutoSave({ fifo_lock_enabled: checked });
                            }}
                          />
                        </div>

                        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                          <p className="text-xs text-muted-foreground">
                            <strong>Comportamento:</strong> Cards mostrarão borda verde (novo), amarela (atenção) ou vermelha pulsando (atrasado). O item #1 fica destacado com botão brilhante.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Item Classification Keywords */}
                  <div className="border-t border-border/50 pt-4 mt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Tags className="h-4 w-4 text-primary" />
                      <Label className="text-base font-medium">Classificação de Itens</Label>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Define como o sistema identifica bordas e sabores nos pedidos importados.
                    </p>
                    
                    <div className="space-y-4">
                      {/* Keywords para Bordas */}
                      <div className="space-y-2">
                        <Label htmlFor="edge-keywords" className="flex items-center gap-2">
                          <span className="w-3 h-3 bg-orange-600 rounded-sm"></span>
                          Palavras-chave para BORDAS
                        </Label>
                        <Input
                          id="edge-keywords"
                          value={(formData as any).kds_edge_keywords ?? '#, Borda'}
                          onChange={(e) => {
                            setFormData({ ...formData, kds_edge_keywords: e.target.value } as any);
                            debouncedAutoSave({ kds_edge_keywords: e.target.value });
                          }}
                          placeholder="#, Borda, Recheio"
                        />
                        <p className="text-xs text-muted-foreground">
                          Itens que contenham estas palavras aparecem com tarja laranja piscante. Separar por vírgula.
                        </p>
                      </div>
                      
                      {/* Keywords para Sabores */}
                      <div className="space-y-2">
                        <Label htmlFor="flavor-keywords" className="flex items-center gap-2">
                          <span className="text-lg font-bold leading-none">A</span>
                          Palavras-chave para SABORES
                        </Label>
                        <Input
                          id="flavor-keywords"
                          value={(formData as any).kds_flavor_keywords ?? '(G), (M), (P), Sabor'}
                          onChange={(e) => {
                            setFormData({ ...formData, kds_flavor_keywords: e.target.value } as any);
                            debouncedAutoSave({ kds_flavor_keywords: e.target.value });
                          }}
                          placeholder="(G), (M), (P), Sabor"
                        />
                        <p className="text-xs text-muted-foreground">
                          Itens que contenham estas palavras aparecem com fonte grande em destaque. Separar por vírgula.
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                        <p className="text-xs text-muted-foreground">
                          <strong>Exemplo:</strong> Se sua API envia "Recheio Cheddar" ao invés de "Borda Cheddar", adicione "Recheio" às palavras-chave de bordas.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            )}

            {isOwner && (
              <TabsContent value="sectors" className="space-y-4 mt-4">
                <SectorsManager />
              </TabsContent>
            )}

            {isOwner && (
              <TabsContent value="users" className="space-y-6 mt-4">
                <InvitationsPanel />
                <div className="border-t pt-6">
                  <UsersAdminPanel />
                </div>
              </TabsContent>
            )}

          </Tabs>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-border/50">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saveSettings.isPending}>
            {saveSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
