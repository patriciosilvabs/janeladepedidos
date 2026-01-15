import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BufferSettingByDay {
  id: string;
  day_of_week: number;
  buffer_timeout_minutes: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function useBufferSettings() {
  const queryClient = useQueryClient();

  const { data: bufferSettings = [], isLoading, error } = useQuery({
    queryKey: ['buffer-settings-by-day'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('buffer_settings_by_day')
        .select('*')
        .order('day_of_week', { ascending: true });

      if (error) throw error;
      return data as BufferSettingByDay[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const updateBufferSetting = useMutation({
    mutationFn: async ({ 
      dayOfWeek, 
      bufferTimeoutMinutes, 
      enabled 
    }: { 
      dayOfWeek: number; 
      bufferTimeoutMinutes?: number; 
      enabled?: boolean;
    }) => {
      const updates: Partial<BufferSettingByDay> = {};
      if (bufferTimeoutMinutes !== undefined) {
        updates.buffer_timeout_minutes = bufferTimeoutMinutes;
      }
      if (enabled !== undefined) {
        updates.enabled = enabled;
      }

      const { data, error } = await supabase
        .from('buffer_settings_by_day')
        .update(updates)
        .eq('day_of_week', dayOfWeek)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buffer-settings-by-day'] });
    },
  });

  // Get buffer timeout for today
  const getTodayBufferTimeout = (fallbackMinutes: number = 10): number => {
    const today = new Date().getDay();
    const todaySetting = bufferSettings.find(s => s.day_of_week === today);
    
    if (todaySetting && todaySetting.enabled) {
      return todaySetting.buffer_timeout_minutes;
    }
    
    return fallbackMinutes;
  };

  // Get day name helper
  const getDayName = (dayOfWeek: number): string => {
    return DAY_NAMES[dayOfWeek] || '';
  };

  return {
    bufferSettings,
    isLoading,
    error,
    updateBufferSetting,
    getTodayBufferTimeout,
    getDayName,
  };
}
