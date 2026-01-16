import { useState } from 'react';
import { useSectors, CreateSectorParams, Sector } from '@/hooks/useSectors';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Pencil, Trash2, ChefHat, LayoutDashboard } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const viewTypeConfig = {
  kds: {
    label: 'KDS',
    description: 'Visualização simplificada para cozinha',
    icon: <ChefHat className="h-3 w-3" />,
    variant: 'secondary' as const,
  },
  management: {
    label: 'Gestão',
    description: 'Visualização completa com todas as colunas',
    icon: <LayoutDashboard className="h-3 w-3" />,
    variant: 'default' as const,
  },
};

export function SectorsManager() {
  const { sectors, isLoading, createSector, updateSector, deleteSector } = useSectors();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Sector | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formViewType, setFormViewType] = useState<'kds' | 'management'>('kds');
  const [formDescription, setFormDescription] = useState('');

  const resetForm = () => {
    setFormName('');
    setFormViewType('kds');
    setFormDescription('');
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowCreateDialog(true);
  };

  const handleOpenEdit = (sector: Sector) => {
    setFormName(sector.name);
    setFormViewType(sector.view_type);
    setFormDescription(sector.description || '');
    setEditingSector(sector);
  };

  const handleCloseDialog = () => {
    setShowCreateDialog(false);
    setEditingSector(null);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      if (editingSector) {
        await updateSector.mutateAsync({
          id: editingSector.id,
          name: formName.trim(),
          view_type: formViewType,
          description: formDescription.trim() || undefined,
        });
        toast.success(`Setor "${formName}" atualizado com sucesso!`);
      } else {
        await createSector.mutateAsync({
          name: formName.trim(),
          view_type: formViewType,
          description: formDescription.trim() || undefined,
        });
        toast.success(`Setor "${formName}" criado com sucesso!`);
      }
      handleCloseDialog();
    } catch (error: any) {
      if (error.message?.includes('duplicate')) {
        toast.error('Já existe um setor com este nome');
      } else {
        toast.error(error.message || 'Erro ao salvar setor');
      }
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;

    try {
      await deleteSector.mutateAsync(pendingDelete.id);
      toast.success(`Setor "${pendingDelete.name}" excluído com sucesso!`);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir setor');
    } finally {
      setPendingDelete(null);
    }
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
        <div className="text-sm text-muted-foreground">
          Gerencie os setores e seus tipos de visualização. Cada usuário pode ser vinculado a um setor.
        </div>
        <Button onClick={handleOpenCreate} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Novo Setor
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!sectors || sectors.length === 0) ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhum setor cadastrado
                </TableCell>
              </TableRow>
            ) : (
              sectors.map((sector) => {
                const config = viewTypeConfig[sector.view_type];
                return (
                  <TableRow key={sector.id}>
                    <TableCell className="font-medium">{sector.name}</TableCell>
                    <TableCell>
                      <Badge variant={config.variant} className="gap-1">
                        {config.icon}
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {sector.description || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {format(new Date(sector.created_at), "dd/MM/yy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenEdit(sector)}
                          disabled={updateSector.isPending || deleteSector.isPending}
                          title="Editar setor"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setPendingDelete(sector)}
                          disabled={deleteSector.isPending || updateSector.isPending}
                          title="Excluir setor"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || !!editingSector} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingSector ? 'Editar Setor' : 'Novo Setor'}</DialogTitle>
            <DialogDescription>
              {editingSector
                ? 'Edite as informações do setor.'
                : 'Crie um novo setor para organizar os usuários.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sector-name">Nome</Label>
              <Input
                id="sector-name"
                placeholder="Ex: Cozinha Principal"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                disabled={createSector.isPending || updateSector.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sector-view-type">Tipo de Visualização</Label>
              <Select
                value={formViewType}
                onValueChange={(value: 'kds' | 'management') => setFormViewType(value)}
                disabled={createSector.isPending || updateSector.isPending}
              >
                <SelectTrigger id="sector-view-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kds">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-4 w-4" />
                      KDS - Visualização simplificada
                    </div>
                  </SelectItem>
                  <SelectItem value="management">
                    <div className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" />
                      Gestão - Visualização completa
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {viewTypeConfig[formViewType].description}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sector-description">Descrição (opcional)</Label>
              <Textarea
                id="sector-description"
                placeholder="Descreva o propósito deste setor..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                disabled={createSector.isPending || updateSector.isPending}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                disabled={createSector.isPending || updateSector.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createSector.isPending || updateSector.isPending}>
                {(createSector.isPending || updateSector.isPending) ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Salvando...
                  </>
                ) : editingSector ? (
                  'Salvar'
                ) : (
                  'Criar Setor'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!pendingDelete} onOpenChange={() => setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Excluir setor</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir o setor <strong>{pendingDelete?.name}</strong>.
              <br /><br />
              Usuários vinculados a este setor ficarão sem setor definido.
              <span className="text-destructive font-medium block mt-2">
                Esta ação não pode ser desfeita.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteSector.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSector.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
