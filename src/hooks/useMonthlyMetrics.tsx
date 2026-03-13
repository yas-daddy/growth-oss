import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface MonthlyMetric {
  id: string;
  month_start: string;
  spend_by_channel: Record<string, number>;
  clicks_by_channel: Record<string, number>;
  ftds_by_channel: Record<string, number>;
  cpa_by_channel: Record<string, number>;
  affiliate_metrics: Record<string, { name: string; spend: number; ftds: number }>;
  total_installs: number;
  total_signups: number;
  total_ftds: number;
  total_stds: number;
  total_ad_spend: number;
  total_affiliate_spend: number;
  total_spend: number;
  blended_cac: number;
  blended_cpa: number;
  cvr_install_to_signup: number;
  cvr_signup_to_ftd: number;
  cvr_ftd_to_std: number;
  cvr_install_to_std: number;
  ftd_cohort_deposits: number;
  avg_deposit_per_ftd: number;
  ad_spend_per_1k_deposit: number;
  net_deposits_new_users: number;
  new_users_net_deposits: number;
  roas: number;
  avg_rating: number;
  created_at: string;
  updated_at: string;
}

export type MonthlyRange = '3m' | '6m' | '12m' | 'ytd';

export function useMonthlyMetrics(range: MonthlyRange = '12m') {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['monthly-metrics', range],
    queryFn: async () => {
      let limit = 12;
      let startDate: string | null = null;
      
      const now = new Date();
      const isPastTwelfth = now.getDate() >= 12;
      
      // For each range, we need the base number + 1 to account for:
      // - current incomplete month (if past 12th, we show it)
      // - OR to ensure we always have enough complete months (if before 12th)
      if (range === '3m') {
        limit = 4; // Need up to 4: current + 3 complete, or just 3 complete
      } else if (range === '6m') {
        limit = 7; // Need up to 7: current + 6 complete
      } else if (range === '12m') {
        limit = 13; // Need up to 13: current + 12 complete
      } else if (range === 'ytd') {
        // Year to date - from January 1st of current year
        startDate = `${now.getFullYear()}-01-01`;
        limit = 13; // Max possible months in a year + 1
      }

      let query = supabase
        .from('monthly_metrics')
        .select('*')
        .order('month_start', { ascending: false });
      
      if (startDate) {
        query = query.gte('month_start', startDate);
      } else {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Type assertion since JSONB columns come as unknown
      return (data as unknown as MonthlyMetric[]) || [];
    },
    enabled: !!user,
  });
}

export function useCalculateMonthlyMetrics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (months: number = 12) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('calculate-monthly-metrics', {
        body: { months },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['monthly-metrics'] });
      toast.success(`Calculated metrics for ${data.monthsProcessed} months`);
    },
    onError: (error) => {
      console.error('Monthly metrics calculation error:', error);
      toast.error(`Failed to calculate monthly metrics: ${error.message}`);
    },
  });
}

// Helper to format month label (e.g., "Dec 2024")
export function formatMonthLabel(monthStart: string): string {
  const date = new Date(monthStart);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}
