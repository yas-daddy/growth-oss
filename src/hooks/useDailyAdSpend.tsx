import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface DailyAdSpend {
  id: string;
  user_id: string;
  platform: string;
  campaign_id: string;
  campaign_name: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  installs: number;
  synced_at: string;
  created_at: string;
}

export function useDailyAdSpend(startDate?: string, endDate?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['daily-ad-spend', startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('daily_ad_spend')
        .select('*')
        .order('date', { ascending: false });

      if (startDate) {
        query = query.gte('date', startDate);
      }
      if (endDate) {
        query = query.lte('date', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as DailyAdSpend[];
    },
    enabled: !!user,
  });
}

// Get aggregated spend by platform for a date range
export function useAggregatedSpend(startDate?: string, endDate?: string) {
  const { data: dailySpend, isLoading, error } = useDailyAdSpend(startDate, endDate);

  const aggregated = dailySpend?.reduce((acc, record) => {
    const platform = record.platform;
    if (!acc[platform]) {
      acc[platform] = { spend: 0, impressions: 0, clicks: 0, installs: 0 };
    }
    acc[platform].spend += Number(record.spend);
    acc[platform].impressions += record.impressions;
    acc[platform].clicks += record.clicks;
    acc[platform].installs += record.installs;
    return acc;
  }, {} as Record<string, { spend: number; impressions: number; clicks: number; installs: number }>);

  return { aggregated, isLoading, error };
}
