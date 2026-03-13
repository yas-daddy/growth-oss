import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FatiguePrediction {
  id: string;
  user_id: string;
  creative_id: string;
  creative_name: string;
  platform: 'meta' | 'moloco';
  fatigue_status: 'healthy' | 'early_warning' | 'fatiguing' | 'fatigued';
  confidence: number;
  days_until_fatigue: number | null;
  reasoning: string;
  trend_data: {
    avg_ctr_first_week?: number;
    avg_ctr_last_week?: number;
    ctr_decline_percent?: number;
    trend_ctr_slope?: number;
  } | null;
  recommended_action: string | null;
  metrics_snapshot: {
    total_spend?: number;
    total_impressions?: number;
    days_active?: number;
  } | null;
  status: 'active' | 'dismissed' | 'rotated';
  created_at: string;
  updated_at: string;
}

export function useCreativeFatigueAnalysis() {
  const queryClient = useQueryClient();

  const { data: predictions, isLoading, error } = useQuery({
    queryKey: ['creative-fatigue-predictions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_creative_fatigue_predictions')
        .select('*')
        .eq('status', 'active')
        .order('confidence', { ascending: false });

      if (error) throw error;
      return data as FatiguePrediction[];
    },
  });

  const generatePredictions = useMutation({
    mutationFn: async ({ days = 30, platform = 'all' }: { days?: number; platform?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-creative-fatigue-analysis`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ days, platform }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to analyze creative fatigue');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['creative-fatigue-predictions'] });
      toast.success(`Analyzed ${data.creatives_analyzed} creatives for fatigue`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to analyze creative fatigue');
    },
  });

  const updatePredictionStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'dismissed' | 'rotated' }) => {
      const { error } = await supabase
        .from('ai_creative_fatigue_predictions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creative-fatigue-predictions'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update prediction');
    },
  });

  const pauseCreative = useMutation({
    mutationFn: async ({ creative_id, creative_name, platform }: { creative_id: string; creative_name: string; platform: string }) => {
      if (platform !== 'meta') {
        throw new Error(`Pausing ${platform} creatives is not yet supported`);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-pause-ad`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ ad_id: creative_id, ad_name: creative_name }),
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to pause creative');
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['meta-ads'] });
      queryClient.invalidateQueries({ queryKey: ['creative-fatigue-predictions'] });
      toast.success(`Paused "${data.ad_name || data.ad_id}"`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to pause creative');
    },
  });

  // Group predictions by status for easy access
  const healthyCreatives = predictions?.filter(p => p.fatigue_status === 'healthy') || [];
  const earlyWarningCreatives = predictions?.filter(p => p.fatigue_status === 'early_warning') || [];
  const fatiguingCreatives = predictions?.filter(p => p.fatigue_status === 'fatiguing') || [];
  const fatiguedCreatives = predictions?.filter(p => p.fatigue_status === 'fatigued') || [];
  
  // Creatives needing attention (not healthy)
  const creativesNeedingAttention = predictions?.filter(p => p.fatigue_status !== 'healthy') || [];

  return {
    predictions,
    healthyCreatives,
    earlyWarningCreatives,
    fatiguingCreatives,
    fatiguedCreatives,
    creativesNeedingAttention,
    isLoading,
    error,
    generatePredictions,
    updatePredictionStatus,
    pauseCreative,
    isGenerating: generatePredictions.isPending,
    isPausing: pauseCreative.isPending,
  };
}
