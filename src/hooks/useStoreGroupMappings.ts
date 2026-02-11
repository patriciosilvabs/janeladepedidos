import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StoreGroupMapping {
  id: string;
  store_id: string;
  option_group_id: number;
  option_type: string;
  group_name: string | null;
  created_at: string;
}

export function useStoreGroupMappings(storeId: string | null) {
  const queryClient = useQueryClient();

  const { data: mappings, isLoading } = useQuery({
    queryKey: ['store-group-mappings', storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const { data, error } = await supabase
        .from('store_option_group_mappings' as any)
        .select('*')
        .eq('store_id', storeId)
        .order('created_at');
      if (error) throw error;
      return data as unknown as StoreGroupMapping[];
    },
    enabled: !!storeId,
  });

  const addMapping = useMutation({
    mutationFn: async (mapping: {
      store_id: string;
      option_group_id: number;
      option_type: string;
      group_name?: string;
    }) => {
      const { data, error } = await supabase
        .from('store_option_group_mappings' as any)
        .insert(mapping)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-group-mappings', storeId] });
    },
  });

  const deleteMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('store_option_group_mappings' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-group-mappings', storeId] });
    },
  });

  return { mappings, isLoading, addMapping, deleteMapping };
}
