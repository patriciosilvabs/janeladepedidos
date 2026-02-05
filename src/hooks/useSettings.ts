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
  max_order_age_hours: number;
  default_city: string;
  default_region: string;
  default_country: string;
  created_at: string;
  updated_at: string;
  dispatched_order_sort_desc: boolean;
  dispatched_visibility_minutes: number;
  urgent_production_timeout_minutes: number;
  urgent_bypass_enabled: boolean;
  kds_default_mode: 'items' | 'orders';
  oven_time_seconds: number;
  kds_fifo_visual_enabled: boolean;
  fifo_warning_minutes: number;
  fifo_critical_minutes: number;
  fifo_lock_enabled: boolean;
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
    staleTime: 1000 * 30, // 30 seconds for faster config updates
  });

  const saveSettings = useMutation({
    mutationFn: async (newSettings: Partial<AppSettings>) => {
      const { data, error } = await supabase
        .from('app_settings')
        .upsert({ id: 'default', ...newSettings })
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
