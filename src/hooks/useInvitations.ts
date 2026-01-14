import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface Invitation {
  id: string;
  email: string;
  role: AppRole;
  created_at: string;
  expires_at: string;
  used_at: string | null;
}

interface CreateInvitationParams {
  email: string;
  role: 'admin' | 'user';
}

export function useInvitations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invitations = [], isLoading, error } = useQuery({
    queryKey: ['invitations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select('id, email, role, created_at, expires_at, used_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Invitation[];
    },
  });

  const createInvitation = useMutation({
    mutationFn: async ({ email, role }: CreateInvitationParams) => {
      const { data, error } = await supabase.functions.invoke('send-invitation', {
        body: { email, role },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast({
        title: 'Convite enviado',
        description: 'O email de convite foi enviado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar convite',
        description: error.message,
      });
    },
  });

  const deleteInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast({
        title: 'Convite cancelado',
        description: 'O convite foi cancelado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao cancelar convite',
        description: error.message,
      });
    },
  });

  const resendInvitation = useMutation({
    mutationFn: async ({ email, role }: CreateInvitationParams) => {
      const { data, error } = await supabase.functions.invoke('send-invitation', {
        body: { email, role },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast({
        title: 'Convite reenviado',
        description: 'O email de convite foi reenviado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao reenviar convite',
        description: error.message,
      });
    },
  });

  return {
    invitations,
    isLoading,
    error,
    createInvitation,
    deleteInvitation,
    resendInvitation,
  };
}
