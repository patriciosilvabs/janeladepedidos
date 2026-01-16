import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'owner' | 'admin' | 'user';

export interface UserWithRole {
  id: string;
  user_id: string;
  email: string;
  role: AppRole;
  created_at: string;
}

export interface CreateUserParams {
  email: string;
  password: string;
  role: 'admin' | 'user';
}

export interface UpdateUserParams {
  userId: string;
  email?: string;
  password?: string;
}

export function useUsers() {
  const queryClient = useQueryClient();

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_users_with_roles');

      if (error) throw error;
      return data as UserWithRole[];
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const updateUserRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: 'admin' | 'user' }) => {
      const { data, error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
    },
  });

  const createUser = useMutation({
    mutationFn: async (params: CreateUserParams) => {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: params,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
    },
  });

  const updateUser = useMutation({
    mutationFn: async (params: UpdateUserParams) => {
      const { data, error } = await supabase.functions.invoke('admin-update-user', {
        body: params,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
    },
  });

  return {
    users,
    isLoading,
    error,
    updateUserRole,
    createUser,
    deleteUser,
    updateUser,
  };
}
