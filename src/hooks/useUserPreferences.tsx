import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useUserPreference<T>(preferenceKey: string, defaultValue: T) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['user-preference', preferenceKey, user?.id],
    queryFn: async () => {
      if (!user) return defaultValue;

      const { data, error } = await supabase
        .from('user_preferences')
        .select('preference_value')
        .eq('user_id', user.id)
        .eq('preference_key', preferenceKey)
        .maybeSingle();

      if (error) {
        console.error('Error fetching preference:', error);
        return defaultValue;
      }

      return data?.preference_value as T ?? defaultValue;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const mutation = useMutation({
    mutationFn: async (value: T) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('user_preferences')
        .upsert(
          {
            user_id: user.id,
            preference_key: preferenceKey,
            preference_value: value as any,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,preference_key',
          }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preference', preferenceKey, user?.id] });
    },
  });

  const setValue = (value: T) => {
    // Optimistic update
    queryClient.setQueryData(['user-preference', preferenceKey, user?.id], value);
    mutation.mutate(value);
  };

  return {
    value: data ?? defaultValue,
    isLoading,
    setValue,
    isSaving: mutation.isPending,
  };
}
