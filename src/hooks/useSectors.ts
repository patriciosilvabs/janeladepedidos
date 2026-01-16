import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Sector {
  id: string;
  name: string;
  view_type: 'kds' | 'management';
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSectorParams {
  name: string;
  view_type: 'kds' | 'management';
  description?: string;
}

export interface UpdateSectorParams {
  id: string;
  name?: string;
  view_type?: 'kds' | 'management';
  description?: string;
}

export function useSectors() {
  const queryClient = useQueryClient();

  const { data: sectors, isLoading, error } = useQuery({
    queryKey: ['sectors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sectors')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Sector[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const createSector = useMutation({
    mutationFn: async (params: CreateSectorParams) => {
      const { data, error } = await supabase
        .from('sectors')
        .insert({
          name: params.name,
          view_type: params.view_type,
          description: params.description || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sectors'] });
    },
  });

  const updateSector = useMutation({
    mutationFn: async (params: UpdateSectorParams) => {
      const { id, ...updateData } = params;
      const { data, error } = await supabase
        .from('sectors')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sectors'] });
    },
  });

  const deleteSector = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sectors')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sectors'] });
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
    },
  });

  return {
    sectors,
    isLoading,
    error,
    createSector,
    updateSector,
    deleteSector,
  };
}

export function useUserSector(userId: string | undefined) {
  const { data: userSector, isLoading } = useQuery({
    queryKey: ['user-sector', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('sector_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) throw roleError;
      if (!userRole?.sector_id) return null;

      const { data: sector, error: sectorError } = await supabase
        .from('sectors')
        .select('*')
        .eq('id', userRole.sector_id)
        .maybeSingle();

      if (sectorError) throw sectorError;
      return sector as Sector | null;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return { userSector, isLoading };
}
