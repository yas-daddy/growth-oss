import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subWeeks, startOfWeek } from 'date-fns';

export interface AdLaunchHistoryItem {
  id: string;
  created_at: string;
  ad_name: string;
  media_urls: string[];
  adset_ids: string[];
  adset_names: string[];
  campaign_name: string | null;
  campaign_names: string[];
  meta_ad_ids: string[];
  ads_count: number;
  adsets_count: number;
  status: string;
  duration_ms: number | null;
  error_message: string | null;
  primary_text: string | null;
  headline: string | null;
  call_to_action: string | null;
}

export function useAdLaunchHistory() {
  return useQuery({
    queryKey: ['ad-launch-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ad_launch_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as AdLaunchHistoryItem[];
    }
  });
}

export function useAdLaunchHistoryChart() {
  const sixWeeksAgo = startOfWeek(subWeeks(new Date(), 5), { weekStartsOn: 1 }).toISOString();

  return useQuery({
    queryKey: ['ad-launch-history-chart'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ad_launch_history')
        .select('created_at, adset_names, ads_count')
        .gte('created_at', sixWeeksAgo)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Pick<AdLaunchHistoryItem, 'created_at' | 'adset_names' | 'ads_count'>[];
    }
  });
}

export function useCreateAdLaunchHistory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: {
      ad_name: string;
      media_urls: string[];
      adset_ids: string[];
      adset_names: string[];
      campaign_name?: string;
      campaign_names?: string[];
      ads_count: number;
      adsets_count: number;
      primary_text?: string;
      headline?: string;
      call_to_action?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('ad_launch_history')
        .insert({
          user_id: user.id,
          ad_name: params.ad_name,
          media_urls: params.media_urls,
          adset_ids: params.adset_ids,
          adset_names: params.adset_names,
          campaign_name: params.campaign_name,
          campaign_names: params.campaign_names || [],
          ads_count: params.ads_count,
          adsets_count: params.adsets_count,
          status: 'pending',
          primary_text: params.primary_text,
          headline: params.headline,
          call_to_action: params.call_to_action
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-launch-history'] });
    }
  });
}

export function useUpdateAdLaunchHistory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: {
      id: string;
      status: 'success' | 'failed';
      meta_ad_ids?: string[];
      duration_ms?: number;
      error_message?: string;
    }) => {
      const { data, error } = await supabase
        .from('ad_launch_history')
        .update({
          status: params.status,
          meta_ad_ids: params.meta_ad_ids || [],
          duration_ms: params.duration_ms,
          error_message: params.error_message
        })
        .eq('id', params.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-launch-history'] });
    }
  });
}
