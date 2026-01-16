import { useState } from 'react';
import { useUsers, UserWithRole, CreateUserParams, UpdateUserParams } from '@/hooks/useUsers';
import { useAuth } from '@/hooks/useAuth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Crown, Shield, User, UserPlus, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CreateUserDialog } from './CreateUserDialog';
import { EditUserDialog, EditUserParams } from './EditUserDialog';

type AppRole = 'owner' | 'admin' | 'user';

const roleConfig: Record<AppRole, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'outline' }> = {
  owner: {
    label: 'Proprietário',
    icon: <Crown className="h-3 w-3" />,
    variant: 'default',
  },
  admin: {
    label: 'Administrador',
    icon: <Shield className="h-3 w-3" />,
    variant: 'secondary',
  },
  user: {
    label: 'Usuário',
    icon: <User className="h-3 w-3" />,
    variant: 'outline',
  },
};

export function UsersAdminPanel() {
  const { users, isLoading, updateUserRole, createUser, deleteUser, updateUser } = useUsers();
  const { user: currentUser } = useAuth();
  const [pendingChange, setPendingChange] = useState<{
    user: UserWithRole;
    newRole: 'admin' | 'user';
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<UserWithRole | null>(null);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const handleCreateUser = async (params: CreateUserParams) => {
    await createUser.mutateAsync(params);
  };

  const handleRoleChange = (userRecord: UserWithRole, newRole: 'admin' | 'user') => {
    if (userRecord.role === 'owner') return;
    if (userRecord.user_id === currentUser?.id) {
      toast.error('Você não pode alterar sua própria role');
      return;
    }
    setPendingChange({ user: userRecord, newRole });
  };

  const confirmRoleChange = async () => {
    if (!pendingChange) return;

    try {
      await updateUserRole.mutateAsync({
        userId: pendingChange.user.user_id,
        newRole: pendingChange.newRole,
      });
      toast.success(`Role de ${pendingChange.user.email} alterada para ${roleConfig[pendingChange.newRole].label}`);
    } catch (error) {
      toast.error('Erro ao alterar role do usuário');
      console.error(error);
    } finally {
      setPendingChange(null);
    }
  };

  const handleDeleteUser = (userRecord: UserWithRole) => {
    if (userRecord.role === 'owner') return;
    if (userRecord.user_id === currentUser?.id) {
      toast.error('Você não pode excluir a si mesmo');
      return;
    }
    setPendingDelete(userRecord);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    try {
      await deleteUser.mutateAsync(pendingDelete.user_id);
      toast.success(`Usuário ${pendingDelete.email} excluído com sucesso`);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir usuário');
      console.error(error);
    } finally {
      setPendingDelete(null);
    }
  };

  const handleEditUser = (userRecord: UserWithRole) => {
    if (userRecord.role === 'owner') return;
    if (userRecord.user_id === currentUser?.id) {
      toast.error('Use o seu perfil para editar seus próprios dados');
      return;
    }
    setEditingUser(userRecord);
  };

  const handleUpdateUser = async (params: UpdateUserParams) => {
    try {
      await updateUser.mutateAsync(params);
      toast.success('Usuário atualizado com sucesso');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar usuário');
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum usuário encontrado
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Gerencie os usuários e suas permissões. O proprietário não pode ter sua role alterada.
        </div>
        <Button onClick={() => setShowCreateDialog(true)} size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Criar Usuário
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Cadastrado em</TableHead>
              <TableHead className="w-[140px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((userRecord) => {
              const config = roleConfig[userRecord.role];
              const isOwner = userRecord.role === 'owner';
              const isSelf = userRecord.user_id === currentUser?.id;

              return (
                <TableRow key={userRecord.id}>
                  <TableCell className="font-medium max-w-[200px]">
                    <div className="flex items-center gap-1">
                      <span className="truncate" title={userRecord.email}>{userRecord.email}</span>
                      {isSelf && <span className="text-xs text-muted-foreground shrink-0">(você)</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={config.variant} className="gap-1">
                      {config.icon}
                      {config.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {format(new Date(userRecord.created_at), "dd/MM/yy", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    {isOwner || isSelf ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Select
                          value={userRecord.role}
                          onValueChange={(value: 'admin' | 'user') => handleRoleChange(userRecord, value)}
                          disabled={updateUserRole.isPending || deleteUser.isPending}
                        >
                          <SelectTrigger className="h-8 w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">
                              <div className="flex items-center gap-2">
                                <Shield className="h-3 w-3" />
                                Admin
                              </div>
                            </SelectItem>
                            <SelectItem value="user">
                              <div className="flex items-center gap-2">
                                <User className="h-3 w-3" />
                                Usuário
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEditUser(userRecord)}
                          disabled={updateUser.isPending || deleteUser.isPending}
                          title="Editar usuário"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteUser(userRecord)}
                          disabled={deleteUser.isPending || updateUser.isPending}
                          title="Excluir usuário"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!pendingChange} onOpenChange={() => setPendingChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alteração de role</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a alterar a role de{' '}
              <strong>{pendingChange?.user.email}</strong> para{' '}
              <strong>{pendingChange && roleConfig[pendingChange.newRole].label}</strong>.
              <br /><br />
              {pendingChange?.newRole === 'admin' 
                ? 'Administradores podem acessar as configurações do sistema.'
                : 'Usuários comuns não podem acessar as configurações do sistema.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange} disabled={updateUserRole.isPending}>
              {updateUserRole.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={() => setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir permanentemente o usuário{' '}
              <strong>{pendingDelete?.email}</strong>.
              <br /><br />
              <span className="text-destructive font-medium">
                Esta ação não pode ser desfeita. Todos os dados do usuário serão removidos.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              disabled={deleteUser.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUser.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditUserDialog
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
        user={editingUser}
        onSubmit={handleUpdateUser}
        isLoading={updateUser.isPending}
      />

      <CreateUserDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateUser}
        isLoading={createUser.isPending}
      />
    </div>
  );
}
