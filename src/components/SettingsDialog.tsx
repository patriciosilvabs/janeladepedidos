import { useState, useEffect } from 'react';
import { Settings, Eye, EyeOff, Loader2, CheckCircle, XCircle, AlertCircle, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { toast } from 'sonner';

export function SettingsDialog() {
  const { settings, isLoading, saveSettings, testCardapioWebConnection, testFoodyConnection } = useSettings();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<AppSettings>>({});
  const [showCardapioToken, setShowCardapioToken] = useState(false);
  const [showCardapioWebhook, setShowCardapioWebhook] = useState(false);
  const [showFoodyToken, setShowFoodyToken] = useState(false);
  const [cardapioStatus, setCardapioStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [foodyStatus, setFoodyStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [webhookCopied, setWebhookCopied] = useState(false);

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
      await saveSettings.mutateAsync(formData);
      toast.success('Configurações salvas com sucesso!');
      setOpen(false);
    } catch (error) {
      toast.error('Erro ao salvar configurações');
      console.error(error);
    }
  };

  const handleTestCardapio = async () => {
    if (!formData.cardapioweb_api_token) {
      toast.error('Insira o token da API primeiro');
      return;
    }
    setCardapioStatus('testing');
    try {
      const result = await testCardapioWebConnection.mutateAsync({
        token: formData.cardapioweb_api_token,
        url: formData.cardapioweb_api_url
      });
      if (result?.note) {
        setCardapioStatus('success');
        toast.success(`Conexão OK! ${result.note}`);
      } else {
        setCardapioStatus('success');
        toast.success('Conexão com Cardápio Web OK!');
      }
    } catch (error: any) {
      setCardapioStatus('error');
      // Try to extract the detailed error message from the response
      const errorData = error?.context?.data;
      if (errorData?.details) {
        toast.error(errorData.details);
      } else if (errorData?.error) {
        toast.error(errorData.error);
      } else {
        toast.error('Falha na conexão com Cardápio Web');
      }
      console.error(error);
    }
  };

  const handleTestFoody = async () => {
    if (!formData.foody_api_token) {
      toast.error('Insira o token da API primeiro');
      return;
    }
    setFoodyStatus('testing');
    try {
      await testFoodyConnection.mutateAsync({
        token: formData.foody_api_token,
        url: formData.foody_api_url || 'https://app.foodydelivery.com/rest/1.2',
      });
      setFoodyStatus('success');
      toast.success('Conexão com Foody Delivery OK!');
    } catch (error) {
      setFoodyStatus('error');
      toast.error('Falha na conexão com Foody Delivery');
      console.error(error);
    }
  };

  const getStatusIcon = (status: 'idle' | 'testing' | 'success' | 'error') => {
    switch (status) {
      case 'testing':
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getApiStatus = () => {
    const cardapioConfigured = settings?.cardapioweb_enabled && settings?.cardapioweb_api_token;
    const foodyConfigured = settings?.foody_enabled && settings?.foody_api_token;

    if (cardapioConfigured && foodyConfigured) {
      return { color: 'bg-green-500', text: 'APIs OK' };
    } else if (cardapioConfigured || foodyConfigured) {
      return { color: 'bg-yellow-500', text: 'Parcial' };
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
          <Tabs defaultValue="cardapio" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="cardapio" className="text-xs sm:text-sm">Cardápio Web</TabsTrigger>
              <TabsTrigger value="foody" className="text-xs sm:text-sm">Foody</TabsTrigger>
              <TabsTrigger value="buffer" className="text-xs sm:text-sm">Buffer</TabsTrigger>
              <TabsTrigger value="location" className="text-xs sm:text-sm">Local</TabsTrigger>
            </TabsList>

            <TabsContent value="cardapio" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="cardapio-enabled">Integração Ativa</Label>
                  <p className="text-sm text-muted-foreground">
                    Habilitar recebimento de pedidos
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

              <div className="space-y-2">
                <Label htmlFor="cardapio-token">Token API (X-API-KEY)</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="cardapio-token"
                      type={showCardapioToken ? 'text' : 'password'}
                      value={formData.cardapioweb_api_token || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, cardapioweb_api_token: e.target.value })
                      }
                      placeholder="Digite o token da API"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowCardapioToken(!showCardapioToken)}
                    >
                      {showCardapioToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="whitespace-nowrap text-xs"
                    onClick={() => {
                      setFormData({ 
                        ...formData, 
                        cardapioweb_api_token: '7nSyGq49NVXuyZfgEQNPg3TdUqLNXTMNMNJwckvE',
                        cardapioweb_api_url: 'https://integracao.sandbox.cardapioweb.com'
                      });
                      toast.info('Token Sandbox inserido. Clique em "Testar Conexão"');
                    }}
                  >
                    Usar Sandbox
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardapio-webhook">Token Webhook (X-Webhook-Token)</Label>
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

              <div className="space-y-2">
                <Label htmlFor="cardapio-url">URL da API</Label>
                <Input
                  id="cardapio-url"
                  value={formData.cardapioweb_api_url || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, cardapioweb_api_url: e.target.value })
                  }
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleTestCardapio}
                  disabled={testCardapioWebConnection.isPending}
                >
                  {testCardapioWebConnection.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Testar Conexão
                </Button>
                {getStatusIcon(cardapioStatus)}
              </div>

              <div className="mt-6 pt-4 border-t border-border/50">
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
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="foody-enabled">Integração Ativa</Label>
                  <p className="text-sm text-muted-foreground">
                    Habilitar envio de pedidos para entrega
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
                <Label htmlFor="foody-token">Token API (Authorization)</Label>
                <div className="relative">
                  <Input
                    id="foody-token"
                    type={showFoodyToken ? 'text' : 'password'}
                    value={formData.foody_api_token || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, foody_api_token: e.target.value })
                    }
                    placeholder="Digite o token da API Foody"
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

              <div className="space-y-2">
                <Label htmlFor="foody-url">URL da API</Label>
                <Input
                  id="foody-url"
                  value={formData.foody_api_url || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, foody_api_url: e.target.value })
                  }
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleTestFoody}
                  disabled={testFoodyConnection.isPending}
                >
                  {testFoodyConnection.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Testar Conexão
                </Button>
                {getStatusIcon(foodyStatus)}
              </div>
            </TabsContent>

            <TabsContent value="buffer" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="buffer-timeout">Tempo de Espera (minutos)</Label>
                <p className="text-sm text-muted-foreground">
                  Quanto tempo esperar antes de despachar automaticamente
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

              <div className="space-y-2">
                <Label htmlFor="grouping-radius">Raio de Agrupamento (km)</Label>
                <p className="text-sm text-muted-foreground">
                  Distância máxima para agrupar pedidos
                </p>
                <Input
                  id="grouping-radius"
                  type="number"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={formData.grouping_radius_km || 2}
                  onChange={(e) =>
                    setFormData({ ...formData, grouping_radius_km: parseFloat(e.target.value) || 2 })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-orders">Máximo de Pedidos por Grupo</Label>
                <p className="text-sm text-muted-foreground">
                  Limite de pedidos em um mesmo grupo de entrega
                </p>
                <Input
                  id="max-orders"
                  type="number"
                  min={1}
                  max={10}
                  value={formData.max_orders_per_group || 3}
                  onChange={(e) =>
                    setFormData({ ...formData, max_orders_per_group: parseInt(e.target.value) || 3 })
                  }
                />
              </div>
            </TabsContent>

            <TabsContent value="location" className="space-y-4 mt-4">
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Estes valores serão usados como padrão quando o pedido não informar a localização completa.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-city">Cidade Padrão</Label>
                <Input
                  id="default-city"
                  value={formData.default_city || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, default_city: e.target.value })
                  }
                  placeholder="Ex: João Pessoa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-region">Estado Padrão</Label>
                <Input
                  id="default-region"
                  value={formData.default_region || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, default_region: e.target.value })
                  }
                  placeholder="Ex: PB"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-country">País Padrão</Label>
                <Input
                  id="default-country"
                  value={formData.default_country || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, default_country: e.target.value })
                  }
                  placeholder="Ex: BR"
                />
              </div>
            </TabsContent>
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
