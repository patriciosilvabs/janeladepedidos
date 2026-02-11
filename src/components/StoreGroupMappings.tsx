import { useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
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
import { useStoreGroupMappings } from '@/hooks/useStoreGroupMappings';
import { toast } from 'sonner';

const TYPE_CONFIG: Record<string, { label: string; variant: 'destructive' | 'default' | 'secondary' | 'outline' }> = {
  edge: { label: 'Borda', variant: 'destructive' },
  flavor: { label: 'Sabor', variant: 'default' },
  complement: { label: 'Complemento', variant: 'secondary' },
};

export function StoreGroupMappings({ storeId }: { storeId: string }) {
  const { mappings, isLoading, addMapping, deleteMapping } = useStoreGroupMappings(storeId);
  const [newGroupId, setNewGroupId] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newType, setNewType] = useState('flavor');

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

  if (isLoading) return null;

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium">Mapeamento de Grupos de Opções</Label>
        <p className="text-xs text-muted-foreground">
          Classifique grupos do CardápioWeb por <code className="bg-muted px-1 rounded">option_group_id</code>.
          Grupos mapeados têm prioridade sobre keywords.
        </p>
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
    </div>
  );
}
