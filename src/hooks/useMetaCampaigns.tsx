import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from './useOrganization';

export interface MetaCampaign {
  id: string;
  user_id: string;
  campaign_id: string;
  campaign_name: string;
  status: string;
  objective: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  installs: number;
  cpc: number;
  cpm: number;
  cpa: number;
  date_start: string | null;
  date_stop: string | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface MetaSummary {
  totalCampaigns: number;
  totalSpend: number;
  totalInstalls: number;
  avgCpa: number;
  lastSyncedAt: string | null;
}

export function useMetaCampaigns() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  const campaignsQuery = useQuery({
    queryKey: ['meta-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_campaigns')
        .select('*')
        .order('spend', { ascending: false });

      if (error) throw error;
      return data as MetaCampaign[];
    },
  });

  const summaryQuery = useQuery({
    queryKey: ['meta-campaigns-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_campaigns')
        .select('spend, installs, synced_at');

      if (error) throw error;

      const campaigns = data || [];
      const totalSpend = campaigns.reduce((sum, c) => sum + Number(c.spend), 0);
      const totalInstalls = campaigns.reduce((sum, c) => sum + c.installs, 0);
      const avgCpa = totalInstalls > 0 ? totalSpend / totalInstalls : 0;
      const lastSyncedAt = campaigns.length > 0 
        ? campaigns.reduce((latest, c) => 
            new Date(c.synced_at) > new Date(latest) ? c.synced_at : latest, 
            campaigns[0].synced_at
          )
        : null;

      return {
        totalCampaigns: campaigns.length,
        totalSpend,
        totalInstalls,
        avgCpa,
        lastSyncedAt,
      } as MetaSummary;
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('meta-sync-campaigns', {
        body: { org_id: organization?.id },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['meta-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['meta-campaigns-summary'] });
      toast({
        title: 'Sync Complete',
        description: `Synced ${data.summary?.totalCampaigns || 0} campaigns from Meta Ads`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    campaigns: campaignsQuery.data || [],
    summary: summaryQuery.data,
    isLoading: campaignsQuery.isLoading || summaryQuery.isLoading,
    isError: campaignsQuery.isError || summaryQuery.isError,
    error: campaignsQuery.error || summaryQuery.error,
    syncCampaigns: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
  };
}
