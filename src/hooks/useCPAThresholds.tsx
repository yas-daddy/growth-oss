import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CPAThresholds {
  id: string;
  min_cpa: number;
  max_cpa: number;
  target_cpa: number;
  green_threshold: number;
  orange_threshold: number;
}

const defaultThresholds: Omit<CPAThresholds, 'id'> = {
  min_cpa: 20,
  max_cpa: 55,
  target_cpa: 35,
  green_threshold: 42,
  orange_threshold: 48,
};

export function useCPAThresholds() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['cpa-thresholds'],
    queryFn: async () => {
      // Fetch organization-wide settings (single row)
      const { data, error } = await supabase
        .from('cpa_threshold_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      // Return data or defaults if no row exists
      if (!data) {
        return defaultThresholds as CPAThresholds;
      }
      
      return data as CPAThresholds;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Omit<CPAThresholds, 'id'>>) => {
      // First check if a row exists
      const { data: existing } = await supabase
        .from('cpa_threshold_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        // Update existing row
        const { error } = await supabase
          .from('cpa_threshold_settings')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        // Insert new row with defaults + updates
        const { error } = await supabase
          .from('cpa_threshold_settings')
          .insert({
            ...defaultThresholds,
            ...updates,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cpa-thresholds'] });
      toast({
        title: 'Settings saved',
        description: 'CPA thresholds have been updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error saving settings',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    thresholds: data ?? defaultThresholds,
    isLoading,
    error,
    updateThresholds: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
