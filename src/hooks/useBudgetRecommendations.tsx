import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BudgetRecommendation {
  id: string;
  user_id: string;
  entity_type: 'channel' | 'campaign' | 'keyword';
  entity_id: string;
  entity_name: string;
  channel: string;
  action_type: 'increase' | 'decrease' | 'reallocate' | 'pause';
  confidence: number;
  reasoning: string;
  recommended_action: string | null;
  current_spend: number | null;
  suggested_change: number | null;
  metrics_snapshot: Record<string, unknown> | null;
  status: 'pending' | 'applied' | 'dismissed';
  created_at: string;
  updated_at: string;
}

export function useBudgetRecommendations() {
  const queryClient = useQueryClient();

  const { data: recommendations, isLoading, error } = useQuery({
    queryKey: ['budget-recommendations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_budget_recommendations' as any)
        .select('*')
        .order('confidence', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as BudgetRecommendation[];
    },
  });

  const generateRecommendations = useMutation({
    mutationFn: async ({ days = 30 }: { days?: number }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-budget-analysis`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ days }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate budget recommendations');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['budget-recommendations'] });
      toast.success(`Generated ${data.recommendations?.length || 0} budget recommendations`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to analyze budgets');
    },
  });

  const updateRecommendationStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'applied' | 'dismissed' }) => {
      const { error } = await supabase
        .from('ai_budget_recommendations' as any)
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-recommendations'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update recommendation');
    },
  });

  const pendingRecommendations = recommendations?.filter(r => r.status === 'pending') || [];
  const appliedRecommendations = recommendations?.filter(r => r.status === 'applied') || [];
  const dismissedRecommendations = recommendations?.filter(r => r.status === 'dismissed') || [];

  return {
    recommendations,
    pendingRecommendations,
    appliedRecommendations,
    dismissedRecommendations,
    isLoading,
    error,
    generateRecommendations,
    updateRecommendationStatus,
    isGenerating: generateRecommendations.isPending,
  };
}
