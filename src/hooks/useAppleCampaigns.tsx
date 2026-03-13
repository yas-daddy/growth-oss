import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AppleCampaign {
  id: string;
  user_id: string;
  campaign_id: string;
  campaign_name: string;
  status: string | null;
  impressions: number;
  taps: number;
  conversions: number;
  spend: number;
  avg_cpa: number | null;
  avg_cpt: number | null;
  start_date: string | null;
  end_date: string | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export function useAppleCampaigns() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const campaignsQuery = useQuery({
    queryKey: ['apple-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('apple_campaigns')
        .select('*')
        .order('spend', { ascending: false });

      if (error) throw error;
      return data as AppleCampaign[];
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('apple-sync-campaigns', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['apple-campaigns'] });
      toast({
        title: 'Apple Search Ads synced',
        description: `Synced ${data.totalCampaigns} campaigns, $${data.totalSpend?.toFixed(2) || '0'} spend`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Sync failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Calculate totals
  const campaigns = campaignsQuery.data || [];
  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
  const totalTaps = campaigns.reduce((sum, c) => sum + c.taps, 0);
  const totalImpressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);
  const lastSynced = campaigns.length > 0 
    ? new Date(Math.max(...campaigns.map(c => new Date(c.synced_at).getTime())))
    : null;

  return {
    campaigns,
    isLoading: campaignsQuery.isLoading,
    isError: campaignsQuery.isError,
    error: campaignsQuery.error,
    syncCampaigns: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
    isConnected: campaigns.length > 0,
    totalSpend,
    totalConversions,
    totalTaps,
    totalImpressions,
    lastSynced,
  };
}
