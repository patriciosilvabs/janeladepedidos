import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AppSettings {
  id: string;
  cardapioweb_api_token: string | null;
  cardapioweb_webhook_token: string | null;
  cardapioweb_api_url: string;
  cardapioweb_enabled: boolean;
  foody_api_token: string | null;
  foody_api_url: string;
  foody_enabled: boolean;
  buffer_timeout_minutes: number;
  grouping_radius_km: number;
  max_orders_per_group: number;
  default_city: string;
  default_region: string;
  default_country: string;
  created_at: string;
  updated_at: string;
}

export function useSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();

      if (error) throw error;
      return data as AppSettings | null;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const saveSettings = useMutation({
    mutationFn: async (newSettings: Partial<AppSettings>) => {
      const { data, error } = await supabase
        .from('app_settings')
        .update(newSettings)
        .eq('id', 'default')
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
    },
  });

  const testCardapioWebConnection = useMutation({
    mutationFn: async ({ token, url }: { token: string; url?: string }) => {
      // Determine if we should use sandbox based on the URL
      const useSandbox = url?.includes('sandbox') || false;
      
      const { data, error } = await supabase.functions.invoke('test-cardapioweb-connection', {
        body: { token, useSandbox },
      });

      if (error) {
        // Attach the response data to the error for better error handling
        const enhancedError = new Error(error.message);
        (enhancedError as any).context = { data };
        throw enhancedError;
      }
      
      // Check if the response indicates failure
      if (data && data.success === false) {
        const enhancedError = new Error(data.error || 'Connection failed');
        (enhancedError as any).context = { data };
        throw enhancedError;
      }
      
      return data;
    },
  });

  const testFoodyConnection = useMutation({
    mutationFn: async ({ token, url }: { token: string; url: string }) => {
      const { data, error } = await supabase.functions.invoke('test-foody-connection', {
        body: { token, url },
      });

      if (error) throw error;
      return data;
    },
  });

  return {
    settings,
    isLoading,
    error,
    saveSettings,
    testCardapioWebConnection,
    testFoodyConnection,
  };
}
