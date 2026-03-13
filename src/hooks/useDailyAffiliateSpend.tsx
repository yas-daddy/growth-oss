import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface DailyAffiliateSpend {
  id: string;
  user_id: string;
  affiliate_id: string;
  date: string;
  ftds: number;
  spend: number;
  created_at: string;
  synced_at: string;
}

export function useDailyAffiliateSpend(startDate?: string, endDate?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['daily-affiliate-spend', startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('daily_affiliate_spend')
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
      return data as DailyAffiliateSpend[];
    },
    enabled: !!user,
  });
}

export function useAffiliateSpendTotals(startDate?: string, endDate?: string) {
  const { data: dailySpend, isLoading } = useDailyAffiliateSpend(startDate, endDate);
  
  const totals = {
    totalSpend: dailySpend?.reduce((sum, d) => sum + Number(d.spend), 0) || 0,
    totalFTDs: dailySpend?.reduce((sum, d) => sum + d.ftds, 0) || 0,
  };
  
  return { ...totals, isLoading };
}
