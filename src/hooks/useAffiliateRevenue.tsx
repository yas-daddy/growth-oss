import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface RevenueByChannel {
  [channel: string]: number;
}

export function useAffiliateRevenue(startDate?: string, endDate?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['affiliate-revenue', user?.id, startDate, endDate],
    queryFn: async (): Promise<RevenueByChannel> => {
      if (!user) return {};

      let query = supabase
        .from('appsflyer_events')
        .select('media_source, event_revenue')
        .eq('event_name', 'net_revenue');

      if (startDate) {
        query = query.gte('event_date', startDate);
      }
      if (endDate) {
        query = query.lte('event_date', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Group by media_source and sum revenue
      const revenueByChannel: RevenueByChannel = {};
      for (const event of data || []) {
        const channel = event.media_source;
        const revenue = Number(event.event_revenue) || 0;
        revenueByChannel[channel] = (revenueByChannel[channel] || 0) + revenue;
      }

      return revenueByChannel;
    },
    enabled: !!user,
  });
}
