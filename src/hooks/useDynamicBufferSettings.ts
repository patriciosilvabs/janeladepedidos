import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DynamicBufferSettings {
  id: string;
  enabled: boolean;
  low_volume_min_orders: number;
  low_volume_max_orders: number;
  low_volume_timer_minutes: number;
  medium_volume_min_orders: number;
  medium_volume_max_orders: number;
  medium_volume_timer_minutes: number;
  high_volume_min_orders: number;
  high_volume_timer_minutes: number;
  max_buffer_time_minutes: number;
  created_at: string;
  updated_at: string;
}

export type VolumeScenario = 'low' | 'medium' | 'high' | null;

export interface DynamicTimerResult {
  timerMinutes: number;
  scenario: VolumeScenario;
  scenarioLabel: string;
  scenarioDescription: string;
}

export function useDynamicBufferSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['dynamic-buffer-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dynamic_buffer_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();

      if (error) throw error;
      return data as DynamicBufferSettings | null;
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<DynamicBufferSettings>) => {
      const { data, error } = await supabase
        .from('dynamic_buffer_settings')
        .upsert({ 
          id: 'default', 
          ...updates, 
          updated_at: new Date().toISOString() 
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dynamic-buffer-settings'] });
    },
  });

  /**
   * Calculate the dynamic buffer timer based on active order count.
   * Returns null if dynamic buffer is disabled.
   */
  const calculateDynamicTimer = (activeOrderCount: number): DynamicTimerResult | null => {
    if (!settings?.enabled) {
      return null;
    }

    let timerMinutes: number;
    let scenario: VolumeScenario;
    let scenarioLabel: string;
    let scenarioDescription: string;

    if (activeOrderCount <= settings.low_volume_max_orders) {
      // Low volume: priority is speed
      timerMinutes = settings.low_volume_timer_minutes;
      scenario = 'low';
      scenarioLabel = 'Baixo Movimento';
      scenarioDescription = 'Prioridade: Velocidade de entrega';
    } else if (activeOrderCount <= settings.medium_volume_max_orders) {
      // Medium volume: priority is grouping
      timerMinutes = settings.medium_volume_timer_minutes;
      scenario = 'medium';
      scenarioLabel = 'Movimento Moderado';
      scenarioDescription = 'Prioridade: Agrupamento de pedidos';
    } else {
      // High volume: priority is freight efficiency
      timerMinutes = settings.high_volume_timer_minutes;
      scenario = 'high';
      scenarioLabel = 'Pico de Demanda';
      scenarioDescription = 'Prioridade: Eficiência de frete';
    }

    // Apply safety lock: never exceed max buffer time
    timerMinutes = Math.min(timerMinutes, settings.max_buffer_time_minutes);

    return {
      timerMinutes,
      scenario,
      scenarioLabel,
      scenarioDescription,
    };
  };

  return {
    settings,
    isLoading,
    error,
    updateSettings,
    calculateDynamicTimer,
  };
}
