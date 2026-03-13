import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AdDefaults {
  id: string;
  user_id: string;
  primary_text: string | null;
  headline: string | null;
  primary_texts: string[] | null;
  headlines: string[] | null;
  description: string | null;
  call_to_action: string | null;
  destination_url: string | null;
  url_parameters: string | null;
  created_at: string;
  updated_at: string;
}

export function useAdDefaults() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ad-defaults'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ad_defaults')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as AdDefaults | null;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (defaults: Partial<AdDefaults>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const existing = query.data;
      
      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('ad_defaults')
          .update({
            ...defaults,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('ad_defaults')
          .insert({
            user_id: user.id,
            ...defaults,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-defaults'] });
      toast({
        title: 'Defaults saved',
        description: 'Your ad defaults have been saved.',
      });
    },
    onError: (error) => {
      console.error('Error saving defaults:', error);
      toast({
        title: 'Error saving defaults',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  return {
    defaults: query.data,
    isLoading: query.isLoading,
    error: query.error,
    saveDefaults: saveMutation.mutate,
    isSaving: saveMutation.isPending,
  };
}
