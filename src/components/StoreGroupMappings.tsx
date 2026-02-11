import { useState } from 'react';
import { Plus, Trash2, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { useStoreGroupMappings } from '@/hooks/useStoreGroupMappings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const TYPE_CONFIG: Record<string, { label: string; variant: 'destructive' | 'default' | 'secondary' | 'outline' }> = {
  edge: { label: 'Borda', variant: 'destructive' },
  flavor: { label: 'Sabor', variant: 'default' },
  complement: { label: 'Complemento', variant: 'secondary' },
};

// Auto-classify group name by keywords
function autoClassify(name: string): string {
  const lower = name.toLowerCase();
  const flavorKw = ['sabor', 'sabores', 'escolha', 'selecione', 'pizza'];
  const edgeKw = ['borda', 'massa', 'tradicional'];

  if (edgeKw.some((k) => lower.includes(k))) return 'edge';
  if (flavorKw.some((k) => lower.includes(k))) return 'flavor';
  return 'complement';
}

interface ImportGroup {
  option_group_id: number;
  group_name: string;
  option_type: string;
  already_mapped: boolean;
}

export function StoreGroupMappings({ storeId }: { storeId: string }) {
  const { mappings, isLoading, addMapping, deleteMapping, bulkAddMappings } =
    useStoreGroupMappings(storeId);
  const [newGroupId, setNewGroupId] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newType, setNewType] = useState('flavor');

  // Import dialog state
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importGroups, setImportGroups] = useState<ImportGroup[]>([]);
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    const groupId = parseInt(newGroupId);
    if (isNaN(groupId)) {
      toast.error('ID do grupo deve ser um número');
      return;
    }

    if (mappings?.some((m) => m.option_group_id === groupId)) {
      toast.error('Grupo já mapeado');
      return;
    }

    try {
      await addMapping.mutateAsync({
        store_id: storeId,
        option_group_id: groupId,
        option_type: newType,
        group_name: newGroupName.trim() || undefined,
      });
      toast.success('Mapeamento adicionado');
      setNewGroupId('');
      setNewGroupName('');
    } catch {
      toast.error('Erro ao adicionar mapeamento');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMapping.mutateAsync(id);
      toast.success('Mapeamento removido');
    } catch {
      toast.error('Erro ao remover');
    }
  };

  const handleImportFromApi = async () => {
    setImporting(true);
    setImportOpen(true);
    setImportGroups([]);

    try {
      const { data, error } = await supabase.functions.invoke('fetch-store-option-groups', {
        body: { store_id: storeId },
      });

      if (error) throw error;
      if (!data?.groups || data.groups.length === 0) {
        toast.error('Nenhum grupo de opções encontrado. Verifique se há pedidos recentes na API.');
        setImportOpen(false);
        return;
      }

      const existingIds = new Set(mappings?.map((m) => m.option_group_id) || []);

      const groups: ImportGroup[] = data.groups.map((g: any) => ({
        option_group_id: g.option_group_id,
        group_name: g.group_name || '',
        option_type: autoClassify(g.group_name || ''),
        already_mapped: existingIds.has(g.option_group_id),
      }));

      setImportGroups(groups);
      toast.success(`${groups.length} grupos encontrados (${data.orders_checked} pedidos analisados)`);
    } catch (err) {
      console.error('Import error:', err);
      toast.error('Erro ao buscar grupos da API');
      setImportOpen(false);
    } finally {
      setImporting(false);
    }
  };

  const handleChangeImportType = (index: number, type: string) => {
    setImportGroups((prev) =>
      prev.map((g, i) => (i === index ? { ...g, option_type: type } : g))
    );
  };

  const handleSaveImport = async () => {
    const toSave = importGroups.filter((g) => !g.already_mapped);
    if (toSave.length === 0) {
      toast.info('Todos os grupos já estão mapeados');
      setImportOpen(false);
      return;
    }

    setSaving(true);
    try {
      await bulkAddMappings.mutateAsync(
        toSave.map((g) => ({
          store_id: storeId,
          option_group_id: g.option_group_id,
          option_type: g.option_type,
          group_name: g.group_name || undefined,
        }))
      );
      toast.success(`${toSave.length} mapeamentos criados`);
      setImportOpen(false);
    } catch {
      toast.error('Erro ao salvar mapeamentos');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label className="text-xs font-medium">Mapeamento de Grupos de Opções</Label>
          <p className="text-xs text-muted-foreground">
            Classifique grupos do CardápioWeb por{' '}
            <code className="bg-muted px-1 rounded">option_group_id</code>.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 shrink-0"
          onClick={handleImportFromApi}
          disabled={importing}
        >
          {importing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Download className="h-3 w-3" />
          )}
          Importar da API
        </Button>
      </div>

      {/* Existing mappings */}
      {mappings && mappings.length > 0 && (
        <div className="space-y-1">
          {mappings.map((m) => {
            const config = TYPE_CONFIG[m.option_type] || TYPE_CONFIG.complement;
            return (
              <div
                key={m.id}
                className="flex items-center gap-2 text-xs p-1.5 rounded border bg-muted/30"
              >
                <Badge variant={config.variant} className="text-[10px] px-1.5">
                  {config.label}
                </Badge>
                <span className="font-mono text-muted-foreground">{m.option_group_id}</span>
                <span className="flex-1 truncate text-muted-foreground">
                  {m.group_name || '—'}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(m.id)}
                  disabled={deleteMapping.isPending}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add new mapping */}
      <div className="flex gap-2 items-end">
        <div className="space-y-1 w-24">
          <Label className="text-[10px]">ID Grupo</Label>
          <Input
            value={newGroupId}
            onChange={(e) => setNewGroupId(e.target.value)}
            placeholder="944280"
            className="text-xs h-8"
          />
        </div>
        <div className="space-y-1 flex-1">
          <Label className="text-[10px]">Nome (ref.)</Label>
          <Input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Massas & Bordas"
            className="text-xs h-8"
          />
        </div>
        <div className="space-y-1 w-32">
          <Label className="text-[10px]">Tipo</Label>
          <Select value={newType} onValueChange={setNewType}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="edge">Borda</SelectItem>
              <SelectItem value="flavor">Sabor</SelectItem>
              <SelectItem value="complement">Complemento</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleAdd}
          disabled={addMapping.isPending || !newGroupId.trim()}
        >
          {addMapping.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
        </Button>
      </div>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen} modal>
        <DialogContent className="max-h-[85vh] flex flex-col sm:max-w-[550px] z-[60]">
          <DialogHeader>
            <DialogTitle className="text-base">Importar Grupos da API</DialogTitle>
            <DialogDescription className="text-xs">
              Grupos encontrados nos pedidos recentes. Ajuste o tipo antes de salvar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
            {importing ? (
              <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando grupos da API...
              </div>
            ) : importGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum grupo encontrado.
              </p>
            ) : (
              importGroups.map((g, idx) => (
                <div
                  key={g.option_group_id}
                  className={`flex items-center gap-2 text-xs p-2 rounded border ${
                    g.already_mapped ? 'opacity-50 bg-muted/20' : 'bg-muted/30'
                  }`}
                >
                  <span className="font-mono text-muted-foreground w-16 shrink-0">
                    {g.option_group_id}
                  </span>
                  <span className="flex-1 truncate">{g.group_name || '—'}</span>
                  {g.already_mapped ? (
                    <Badge variant="outline" className="text-[10px]">
                      Já mapeado
                    </Badge>
                  ) : (
                    <Select
                      value={g.option_type}
                      onValueChange={(v) => handleChangeImportType(idx, v)}
                    >
                      <SelectTrigger className="h-7 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="edge">Borda</SelectItem>
                        <SelectItem value="flavor">Sabor</SelectItem>
                        <SelectItem value="complement">Complemento</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveImport}
              disabled={saving || importing || importGroups.filter((g) => !g.already_mapped).length === 0}
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : null}
              Salvar {importGroups.filter((g) => !g.already_mapped).length} mapeamentos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
