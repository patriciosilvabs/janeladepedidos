import { useState } from 'react';
import { Mail, UserPlus, X, RefreshCw, Loader2, Clock, CheckCircle, XCircle } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useInvitations } from '@/hooks/useInvitations';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function InvitationsPanel() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');

  const {
    invitations,
    isLoading,
    createInvitation,
    deleteInvitation,
    resendInvitation,
  } = useInvitations();

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) return;

    await createInvitation.mutateAsync({ email: email.trim(), role });
    setEmail('');
    setRole('user');
    setDialogOpen(false);
  };

  const getInvitationStatus = (invitation: { used_at: string | null; expires_at: string }) => {
    if (invitation.used_at) {
      return { label: 'Usado', variant: 'secondary' as const, icon: CheckCircle };
    }
    if (new Date(invitation.expires_at) < new Date()) {
      return { label: 'Expirado', variant: 'destructive' as const, icon: XCircle };
    }
    return { label: 'Pendente', variant: 'default' as const, icon: Clock };
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'user':
        return 'Usuário';
      case 'owner':
        return 'Proprietário';
      default:
        return role;
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
        <div>
          <h3 className="text-lg font-semibold">Convites</h3>
          <p className="text-sm text-muted-foreground">
            Convide novos usuários para o sistema
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <UserPlus className="mr-2 h-4 w-4" />
              Convidar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateInvitation}>
              <DialogHeader>
                <DialogTitle>Convidar Usuário</DialogTitle>
                <DialogDescription>
                  Envie um convite por email para um novo usuário se cadastrar.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="email@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invite-role">Função</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'user')}>
                    <SelectTrigger id="invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Usuário</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Administradores têm acesso às configurações do sistema.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createInvitation.isPending}>
                  {createInvitation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Enviar Convite
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {invitations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Mail className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Nenhum convite enviado ainda</p>
          <p className="text-sm text-muted-foreground/75">
            Clique em "Convidar" para enviar o primeiro convite
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Enviado em</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((invitation) => {
                const status = getInvitationStatus(invitation);
                const StatusIcon = status.icon;
                const isPending = !invitation.used_at && new Date(invitation.expires_at) > new Date();

                return (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium max-w-[200px]">
                      <span className="truncate block" title={invitation.email}>{invitation.email}</span>
                    </TableCell>
                    <TableCell>{getRoleLabel(invitation.role)}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {format(new Date(invitation.created_at), "dd/MM/yy HH:mm", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {isPending && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                resendInvitation.mutate({
                                  email: invitation.email,
                                  role: invitation.role as 'admin' | 'user',
                                })
                              }
                              disabled={resendInvitation.isPending}
                              title="Reenviar convite"
                            >
                              {resendInvitation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  title="Cancelar convite"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancelar convite?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    O convite para {invitation.email} será cancelado e o link
                                    de cadastro não funcionará mais.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteInvitation.mutate(invitation.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Cancelar Convite
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
