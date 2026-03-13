import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useMetaAccountId() {
  return useQuery({
    queryKey: ['meta-account-id'],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.functions.invoke('meta-get-account-id');
      
      if (error) {
        console.error('Error fetching Meta account ID:', error);
        return null;
      }
      
      return data?.account_id || null;
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour - this won't change often
  });
}
