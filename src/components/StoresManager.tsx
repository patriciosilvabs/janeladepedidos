import { useState } from 'react';
import { CategoriesTagInput } from '@/components/CategoriesTagInput';
import { StoreGroupMappings } from '@/components/StoreGroupMappings';
import { Plus, Pencil, Trash2, Store, Eye, EyeOff, Loader2, CheckCircle, XCircle, Copy, ExternalLink, X, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useStores, Store as StoreType, StoreInsert } from '@/hooks/useStores';
import { toast } from 'sonner';

const ORDER_TYPE_OPTIONS = [
  { value: 'delivery', label: 'Delivery' },
  { value: 'takeaway', label: 'Retirada' },
  { value: 'dine_in', label: 'Mesa' },
  { value: 'counter', label: 'Balcão' },
];

const DEFAULT_STORE: StoreInsert = {
  name: '',
  cardapioweb_api_token: '',
  cardapioweb_api_url: 'https://integracao.cardapioweb.com',
  cardapioweb_store_code: '',
  cardapioweb_enabled: true,
  default_city: 'João Pessoa',
  default_region: 'PB',
  default_country: 'BR',
  allowed_order_types: ['delivery', 'takeaway', 'dine_in', 'counter'],
  allowed_categories: null,
};

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-orders`;

export function StoresManager() {
  const { stores, isLoading, createStore, updateStore, deleteStore, testStoreConnection } = useStores();
  const [editingStore, setEditingStore] = useState<StoreType | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<StoreInsert>(DEFAULT_STORE);
  const [showToken, setShowToken] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<Record<string, 'success' | 'error' | null>>({});

  const openCreateDialog = () => {
    setFormData(DEFAULT_STORE);
    setIsCreating(true);
    setShowToken(false);
  };

  const openEditDialog = (store: StoreType) => {
    setFormData({
      name: store.name,
      cardapioweb_api_token: store.cardapioweb_api_token || '',
      cardapioweb_api_url: store.cardapioweb_api_url || 'https://integracao.cardapioweb.com',
      cardapioweb_store_code: store.cardapioweb_store_code || '',
      cardapioweb_enabled: store.cardapioweb_enabled,
      default_city: store.default_city || 'João Pessoa',
      default_region: store.default_region || 'PB',
      default_country: store.default_country || 'BR',
      allowed_order_types: store.allowed_order_types || ['delivery', 'takeaway', 'dine_in', 'counter'],
      allowed_categories: store.allowed_categories || null,
    });
    setEditingStore(store);
    setShowToken(false);
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    toast.success('URL do Webhook copiada!');
  };

  const closeDialogs = () => {
    setIsCreating(false);
    setEditingStore(null);
    setFormData(DEFAULT_STORE);
    setShowToken(false);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome da loja é obrigatório');
      return;
    }

    try {
      if (editingStore) {
        await updateStore.mutateAsync({ id: editingStore.id, ...formData });
        toast.success('Loja atualizada com sucesso!');
      } else {
        await createStore.mutateAsync(formData);
        toast.success('Loja criada com sucesso!');
      }
      closeDialogs();
    } catch (error) {
      toast.error('Erro ao salvar loja');
      console.error(error);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;

    try {
      await deleteStore.mutateAsync(deleteConfirmId);
      toast.success('Loja removida com sucesso!');
      setDeleteConfirmId(null);
    } catch (error) {
      toast.error('Erro ao remover loja');
      console.error(error);
    }
  };

  const handleTestConnection = async (store: StoreType) => {
    if (!store.cardapioweb_api_token) {
      toast.error('Token não configurado');
      return;
    }

    setTestingId(store.id);
    setTestStatus((prev) => ({ ...prev, [store.id]: null }));

    try {
      await testStoreConnection.mutateAsync({
        token: store.cardapioweb_api_token,
        url: store.cardapioweb_api_url || undefined,
      });
      setTestStatus((prev) => ({ ...prev, [store.id]: 'success' }));
      toast.success(`Conexão OK: ${store.name}`);
    } catch (error) {
      setTestStatus((prev) => ({ ...prev, [store.id]: 'error' }));
      toast.error(`Falha na conexão: ${store.name}`);
      console.error(error);
    } finally {
      setTestingId(null);
    }
  };

  const handleUseSandbox = () => {
    setFormData({
      ...formData,
      cardapioweb_api_token: '7nSyGq49NVXuyZfgEQNPg3TdUqLNXTMNMNJwckvE',
      cardapioweb_api_url: 'https://integracao.sandbox.cardapioweb.com',
    });
    toast.info('Token Sandbox inserido');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Lojas Cadastradas</h3>
          <p className="text-sm text-muted-foreground">
            {stores?.length || 0} loja(s) configurada(s)
          </p>
        </div>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-1" />
          Nova Loja
        </Button>
      </div>

      {stores && stores.length > 0 ? (
        <div className="space-y-2">
          {stores.map((store) => (
            <Card key={store.id} className="overflow-hidden">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">{store.name}</CardTitle>
                    <div
                      className={`h-2 w-2 rounded-full ${
                        store.cardapioweb_enabled ? 'bg-green-500' : 'bg-muted-foreground'
                      }`}
                    />
                    {testStatus[store.id] === 'success' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {testStatus[store.id] === 'error' && (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleTestConnection(store)}
                      disabled={testingId === store.id}
                    >
                      {testingId === store.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(store)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirmId(store.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="py-2 px-4 border-t bg-muted/30">
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {store.cardapioweb_api_url || 'URL não configurada'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <Store className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma loja cadastrada</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Primeira Loja
          </Button>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isCreating || !!editingStore} onOpenChange={closeDialogs}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStore ? 'Editar Loja' : 'Nova Loja'}</DialogTitle>
            <DialogDescription>
              Configure os dados da loja e o token de integração com o Cardápio Web
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="store-name">Nome da Loja *</Label>
              <Input
                id="store-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Loja Centro"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="store-enabled">Integração Ativa</Label>
                <p className="text-xs text-muted-foreground">
                  Habilitar polling de pedidos
                </p>
              </div>
              <Switch
                id="store-enabled"
                checked={formData.cardapioweb_enabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, cardapioweb_enabled: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-token">Token API (X-API-KEY)</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="store-token"
                    type={showToken ? 'text' : 'password'}
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
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="whitespace-nowrap text-xs"
                  onClick={handleUseSandbox}
                >
                  Sandbox
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="store-code">Código da Loja</Label>
                <Input
                  id="store-code"
                  value={formData.cardapioweb_store_code || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, cardapioweb_store_code: e.target.value })
                  }
                  placeholder="Ex: 8268"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="store-url">URL da API</Label>
                <Input
                  id="store-url"
                  value={formData.cardapioweb_api_url || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, cardapioweb_api_url: e.target.value })
                  }
                  placeholder="https://integracao.cardapioweb.com"
                />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">URL do Webhook (configure no CardápioWeb)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={copyWebhookUrl}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copiar
                </Button>
              </div>
              <p className="text-xs font-mono text-muted-foreground break-all select-all">
                {WEBHOOK_URL}
              </p>
              <p className="text-xs text-muted-foreground">
                Configure o header <code className="bg-muted px-1 rounded">X-API-KEY</code> com o mesmo token acima.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="store-city" className="text-xs">
                  Cidade Padrão
                </Label>
                <Input
                  id="store-city"
                  value={formData.default_city || ''}
                  onChange={(e) => setFormData({ ...formData, default_city: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="store-region" className="text-xs">
                  Estado
                </Label>
                <Input
                  id="store-region"
                  value={formData.default_region || ''}
                  onChange={(e) => setFormData({ ...formData, default_region: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="store-country" className="text-xs">
                  País
                </Label>
                <Input
                  id="store-country"
                  value={formData.default_country || ''}
                  onChange={(e) => setFormData({ ...formData, default_country: e.target.value })}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Tipos de Pedido Aceitos */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Tipos de Pedido Aceitos</Label>
              <p className="text-xs text-muted-foreground">
                Apenas pedidos dos tipos selecionados serão importados para esta loja
              </p>
              <div className="grid grid-cols-2 gap-2">
                {ORDER_TYPE_OPTIONS.map((opt) => {
                  const isChecked = (formData.allowed_order_types || []).includes(opt.value);
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                        isChecked ? 'border-primary bg-primary/10' : 'border-border/50 bg-muted/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const current = formData.allowed_order_types || [];
                          const updated = e.target.checked
                            ? [...current, opt.value]
                            : current.filter((t) => t !== opt.value);
                          setFormData({ ...formData, allowed_order_types: updated });
                        }}
                        className="rounded border-border"
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Categorias Exibidas no Tablet */}
            <CategoriesTagInput
              categories={formData.allowed_categories}
              onChange={(cats) => setFormData({ ...formData, allowed_categories: cats })}
            />

            {/* Mapeamento de Grupos de Opções (só na edição) */}
            {editingStore && (
              <StoreGroupMappings storeId={editingStore.id} />
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={createStore.isPending || updateStore.isPending}
            >
              {(createStore.isPending || updateStore.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Loja</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta loja? Esta ação não pode ser desfeita. Pedidos
              existentes vinculados a esta loja não serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteStore.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
