import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface AppsFlyerCampaign {
  id: string;
  user_id: string;
  platform: string;
  media_source: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  installs: number;
  spend: number;
  revenue: number;
  arpu: number;
  roi: number;
  cpc: number;
  cpi: number;
  date_start: string | null;
  date_end: string | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface AppsFlyerEvent {
  id: string;
  user_id: string;
  platform: string;
  media_source: string;
  campaign_name: string;
  event_name: string;
  event_count: number;
  event_revenue: number;
  event_date: string;
  synced_at: string;
  created_at: string;
}

export function useAppsFlyerCampaigns(platform?: 'ios' | 'android') {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['appsflyer-campaigns', platform],
    queryFn: async () => {
      let query = supabase
        .from('appsflyer_campaigns')
        .select('*')
        .order('installs', { ascending: false });
      
      if (platform) {
        query = query.eq('platform', platform);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as AppsFlyerCampaign[];
    },
    enabled: !!user,
  });
}

export function useAppsFlyerEvents(eventName?: string, startDate?: string, endDate?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['appsflyer-events', eventName, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('appsflyer_events')
        .select('*')
        .order('event_date', { ascending: false });
      
      if (eventName) {
        query = query.eq('event_name', eventName);
      }
      
      if (startDate) {
        query = query.gte('event_date', startDate);
      }
      
      if (endDate) {
        query = query.lte('event_date', endDate);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as AppsFlyerEvent[];
    },
    enabled: !!user,
  });
}

export function useSyncAppsFlyer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const response = await supabase.functions.invoke('appsflyer-sync', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['appsflyer-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['appsflyer-events'] });
      queryClient.invalidateQueries({ queryKey: ['affiliates'] });
      queryClient.invalidateQueries({ queryKey: ['daily-affiliate-spend'] });
      toast.success(`AppsFlyer sync complete: ${data.totalInstalls} installs, ${data.totalFTDs} FTDs`);
    },
    onError: (error) => {
      console.error('AppsFlyer sync error:', error);
      toast.error(`Failed to sync AppsFlyer: ${error.message}`);
    },
  });
}

export function useAppsFlyerTotals() {
  const { data: campaigns } = useAppsFlyerCampaigns();
  const { data: events } = useAppsFlyerEvents('first_time_deposit');
  
  if (!campaigns) {
    return {
      totalSpend: 0,
      totalRevenue: 0,
      totalInstalls: 0,
      totalClicks: 0,
      totalImpressions: 0,
      totalFTDs: 0,
      totalFTDRevenue: 0,
      overallROI: 0,
      blendedCPI: 0,
    };
  }
  
  const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
  const totalRevenue = campaigns.reduce((sum, c) => sum + (c.revenue || 0), 0);
  const totalInstalls = campaigns.reduce((sum, c) => sum + (c.installs || 0), 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
  const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
  
  const totalFTDs = events?.reduce((sum, e) => sum + (e.event_count || 0), 0) || 0;
  const totalFTDRevenue = events?.reduce((sum, e) => sum + (e.event_revenue || 0), 0) || 0;
  
  const overallROI = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;
  const blendedCPI = totalInstalls > 0 ? totalSpend / totalInstalls : 0;
  
  return {
    totalSpend,
    totalRevenue,
    totalInstalls,
    totalClicks,
    totalImpressions,
    totalFTDs,
    totalFTDRevenue,
    overallROI,
    blendedCPI,
  };
}