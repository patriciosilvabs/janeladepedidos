import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Store {
  id: string;
  name: string;
  cardapioweb_api_token: string | null;
  cardapioweb_api_url: string | null;
  cardapioweb_store_code: string | null;
  cardapioweb_enabled: boolean;
  default_city: string | null;
  default_region: string | null;
  default_country: string | null;
  allowed_order_types: string[];
  allowed_categories: string[] | null;
  created_at: string;
  updated_at: string;
}

export type StoreInsert = Omit<Store, 'id' | 'created_at' | 'updated_at'>;
export type StoreUpdate = Partial<StoreInsert>;

export function useStores() {
  const queryClient = useQueryClient();

  const { data: stores, isLoading, error } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Store[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const createStore = useMutation({
    mutationFn: async (store: StoreInsert) => {
      const { data, error } = await supabase
        .from('stores')
        .insert(store)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
  });

  const updateStore = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & StoreUpdate) => {
      const { data, error } = await supabase
        .from('stores')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
  });

  const deleteStore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('stores')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
  });

  const testStoreConnection = useMutation({
    mutationFn: async ({ token, url }: { token: string; url?: string }) => {
      const { data, error } = await supabase.functions.invoke('test-cardapioweb-connection', {
        body: { token, url },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Connection failed');
      }
      return data;
    },
  });

  return {
    stores,
    isLoading,
    error,
    createStore,
    updateStore,
    deleteStore,
    testStoreConnection,
  };
}
