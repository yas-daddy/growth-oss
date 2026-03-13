import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface WeeklyMetric {
  id: string;
  week_start: string;
  spend_by_channel: Record<string, number>;
  clicks_by_channel: Record<string, number>;
  ftds_by_channel: Record<string, number>;
  cpa_by_channel: Record<string, number>;
  affiliate_metrics: Record<string, { name: string; spend: number; ftds: number }>;
  total_installs: number;
  total_signups: number;
  total_ftds: number;
  total_stds: number;
  total_hvps: number;
  total_ad_spend: number;
  total_affiliate_spend: number;
  total_spend: number;
  blended_cac: number;
  blended_cpa: number;
  cost_per_hvp: number;
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

export function useWeeklyMetrics() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['weekly-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_metrics')
        .select('*')
        .order('week_start', { ascending: false });

      if (error) throw error;
      
      // Type assertion since JSONB columns come as unknown
      return (data as unknown as WeeklyMetric[]) || [];
    },
    enabled: !!user,
  });
}

export function useCalculateWeeklyMetrics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (weeks: number = 4) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('calculate-weekly-metrics', {
        body: { weeks },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['weekly-metrics'] });
      toast.success(`Calculated metrics for ${data.weeksProcessed} weeks`);
    },
    onError: (error) => {
      console.error('Weekly metrics calculation error:', error);
      toast.error(`Failed to calculate weekly metrics: ${error.message}`);
    },
  });
}

// Helper to format week label (e.g., "W/C 2.12.24")
export function formatWeekLabel(weekStart: string): string {
  const date = new Date(weekStart);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear().toString().slice(-2);
  return `W/C ${day}.${month}.${year}`;
}
