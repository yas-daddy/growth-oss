import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AIRecommendation {
  id: string;
  user_id: string;
  keyword_id: string | null;
  keyword_text: string;
  recommendation_type: 'increase_bid' | 'decrease_bid' | 'pause';
  confidence: number;
  reasoning: string;
  suggested_action: {
    type: string;
    current_value?: number;
    suggested_value?: number;
    change_percent?: number;
  } | null;
  metrics_snapshot: Record<string, unknown> | null;
  status: 'pending' | 'applied' | 'dismissed';
  created_at: string;
  updated_at: string;
}

export function useAIKeywordRecommendations() {
  const queryClient = useQueryClient();

  const { data: recommendations, isLoading, error } = useQuery({
    queryKey: ['ai-keyword-recommendations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_keyword_recommendations')
        .select('*')
        .order('confidence', { ascending: false });

      if (error) throw error;
      return data as AIRecommendation[];
    },
  });

  const generateRecommendations = useMutation({
    mutationFn: async (days: number = 14) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-keyword-analysis`,
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
        throw new Error(errorData.error || 'Failed to generate recommendations');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-keyword-recommendations'] });
      toast.success(`Generated ${data.recommendations?.length || 0} AI recommendations`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to generate recommendations');
    },
  });

  const applyBidChange = useMutation({
    mutationFn: async ({ keyword_id, new_bid }: { keyword_id: string; new_bid: number }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/apple-update-keyword-bid`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ keyword_id, new_bid }),
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update bid');
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['apple-keywords'] });
      queryClient.invalidateQueries({ queryKey: ['apple-keyword-analysis'] });
      toast.success(`Updated bid for "${data.keyword_text}" to £${data.new_bid.toFixed(2)}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update bid');
    },
  });

  const updateRecommendationStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'applied' | 'dismissed' }) => {
      const { error } = await supabase
        .from('ai_keyword_recommendations')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-keyword-recommendations'] });
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
    applyBidChange,
    isGenerating: generateRecommendations.isPending,
    isApplyingBid: applyBidChange.isPending,
  };
}
