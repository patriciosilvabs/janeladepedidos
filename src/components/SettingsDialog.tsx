import { useState, useEffect } from 'react';
import { Settings, Eye, EyeOff, Loader2, AlertCircle, Copy, Check, Store, Users, Truck, CheckCircle, XCircle, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StoresManager } from '@/components/StoresManager';
import { UsersAdminPanel } from '@/components/UsersAdminPanel';
import { InvitationsPanel } from '@/components/InvitationsPanel';
import { FoodyStatsPanel } from '@/components/FoodyStatsPanel';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
            <TabsList className={`grid w-full ${isOwner ? 'grid-cols-5' : 'grid-cols-4'}`}>
              <TabsTrigger value="stores" className="text-xs sm:text-sm">
                <Store className="h-3 w-3 mr-1 hidden sm:inline" />
                Lojas
              </TabsTrigger>
              <TabsTrigger value="cardapio" className="text-xs sm:text-sm">Cardápio</TabsTrigger>
              <TabsTrigger value="foody" className="text-xs sm:text-sm">
                <Truck className="h-3 w-3 mr-1 hidden sm:inline" />
                Foody
              </TabsTrigger>
              <TabsTrigger value="buffer" className="text-xs sm:text-sm">Buffer</TabsTrigger>
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
              <div className="space-y-2 mb-6">
                <Label htmlFor="buffer-timeout">Tempo Padrão (minutos)</Label>
                <p className="text-sm text-muted-foreground">
                  Usado como fallback quando o dia não tem configuração específica
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

              <div className="border-t border-border/50 pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-base font-medium">Configuração por Dia da Semana</Label>
                </div>
                
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
                            value={setting.buffer_timeout_minutes}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 10;
                              updateBufferSetting.mutate({
                                dayOfWeek: setting.day_of_week,
                                bufferTimeoutMinutes: value,
                              });
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
