import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useUserProfile() {
  const { user } = useAuth();

  const updateEmail = useMutation({
    mutationFn: async (newEmail: string) => {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
    },
  });

  const updatePassword = useMutation({
    mutationFn: async ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('update-user', {
        body: { currentPassword, newPassword },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
  });

  return {
    user,
    updateEmail,
    updatePassword,
  };
}
