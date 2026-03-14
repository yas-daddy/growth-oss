import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface MixpanelEvent {
  id: string;
  mixpanel_user_id: string | null;
  event_name: string;
  event_time: string;
  distinct_id: string;
  appsflyer_id: string | null;
  properties: Record<string, unknown>;
  amount: number | null;
  revenue: number;
  platform: string | null;
  synced_at: string;
  created_at: string;
}

export function useMixpanelEvents(eventName?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['mixpanel-events', eventName],
    queryFn: async () => {
      let query = supabase
        .from('mixpanel_events')
        .select('*')
        .order('event_time', { ascending: false })
        .limit(50000);
      
      if (eventName) {
        query = query.eq('event_name', eventName);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as unknown as MixpanelEvent[];
    },
    enabled: !!user,
  });
}

// Efficient count-based hook for FTD metrics - counts UNIQUE users
export function useMixpanelFTDCount(startDate?: string, endDate?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['mixpanel-ftd-count', startDate, endDate],
    queryFn: async () => {
      if (!startDate || !endDate) return 0;
      
      // Use RPC function that counts unique users (COALESCE(mixpanel_user_id, distinct_id))
      const { data, error } = await supabase.rpc('get_unique_ftd_count', {
        start_ts: `${startDate}T00:00:00Z`,
        end_ts: `${endDate}T23:59:59Z`,
      });
      
      if (error) throw error;
      return data || 0;
    },
    enabled: !!user && !!startDate && !!endDate,
  });
}

// Hook for deposit aggregations
export function useMixpanelDeposits(startDate?: string, endDate?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['mixpanel-deposits', startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('mixpanel_events')
        .select('amount, mixpanel_user_id')
        .eq('event_name', 'deposit_success');
      
      if (startDate) {
        query = query.gte('event_time', `${startDate}T00:00:00`);
      }
      if (endDate) {
        query = query.lte('event_time', `${endDate}T23:59:59`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      const deposits = data as unknown as { amount: number | null; mixpanel_user_id: string | null }[];
      
      const totalAmount = deposits.reduce((sum, d) => sum + (d.amount || 0), 0);
      const count = deposits.length;
      const uniqueUsers = new Set(deposits.map(d => d.mixpanel_user_id).filter(Boolean)).size;
      
      return {
        totalAmount,
        count,
        uniqueUsers,
        avgPerDeposit: count > 0 ? totalAmount / count : 0,
        avgPerUser: uniqueUsers > 0 ? totalAmount / uniqueUsers : 0,
      };
    },
    enabled: !!user,
  });
}

// Hook for FTD cohort deposits - sum of deposits from users who had FTD in the date range
export function useFTDCohortDeposits(startDate?: string, endDate?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['ftd-cohort-deposits', startDate, endDate],
    queryFn: async () => {
      if (!startDate || !endDate) {
        return { totalDeposits: 0, ftdUserCount: 0, avgPerFTDUser: 0 };
      }
      
      // Use database function to calculate server-side (bypasses row limits)
      const { data, error } = await (supabase.rpc as any)('get_ftd_cohort_deposits', {
        start_date: `${startDate}T00:00:00Z`,
        end_date: `${endDate}T23:59:59Z`,
      });
      
      if (error) {
        console.error('[FTDCohort] RPC error:', error);
        throw error;
      }
      
      const result = data?.[0] || { total_deposits: 0, ftd_user_count: 0, avg_per_ftd_user: 0 };
      
      console.log('[FTDCohort] Server result:', result);
      
      return {
        totalDeposits: Number(result.total_deposits) || 0,
        ftdUserCount: Number(result.ftd_user_count) || 0,
        avgPerFTDUser: Number(result.avg_per_ftd_user) || 0,
      };
    },
    enabled: !!user && !!startDate && !!endDate,
  });
}

// Hook for FTD cohort net deposits (deposits - withdrawals) - sum for users who had FTD in the date range
export function useFTDCohortNetDeposits(startDate?: string, endDate?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['ftd-cohort-net-deposits', startDate, endDate],
    queryFn: async () => {
      if (!startDate || !endDate) {
        return { totalDeposits: 0, totalWithdrawals: 0, netDeposits: 0, ftdUserCount: 0, avgNetPerFTDUser: 0 };
      }
      
      // Use database function to calculate server-side (bypasses row limits)
      const { data, error } = await supabase.rpc('get_ftd_cohort_net_deposits', {
        start_date: `${startDate}T00:00:00Z`,
        end_date: `${endDate}T23:59:59Z`,
      });
      
      if (error) {
        console.error('[FTDCohortNet] RPC error:', error);
        throw error;
      }
      
      const result = data?.[0] || { total_deposits: 0, total_withdrawals: 0, net_deposits: 0, ftd_user_count: 0, avg_net_per_ftd_user: 0 };
      
      console.log('[FTDCohortNet] Server result:', result);
      
      return {
        totalDeposits: Number(result.total_deposits) || 0,
        totalWithdrawals: Number(result.total_withdrawals) || 0,
        netDeposits: Number(result.net_deposits) || 0,
        ftdUserCount: Number(result.ftd_user_count) || 0,
        avgNetPerFTDUser: Number(result.avg_net_per_ftd_user) || 0,
      };
    },
    enabled: !!user && !!startDate && !!endDate,
  });
}

// Hook for withdrawal aggregations
export function useMixpanelWithdrawals(startDate?: string, endDate?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['mixpanel-withdrawals', startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('mixpanel_events')
        .select('amount, mixpanel_user_id')
        .eq('event_name', 'withdrawal_success');
      
      if (startDate) {
        query = query.gte('event_time', `${startDate}T00:00:00`);
      }
      if (endDate) {
        query = query.lte('event_time', `${endDate}T23:59:59`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      const withdrawals = data as unknown as { amount: number | null; mixpanel_user_id: string | null }[];
      
      const totalAmount = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
      const count = withdrawals.length;
      const uniqueUsers = new Set(withdrawals.map(w => w.mixpanel_user_id).filter(Boolean)).size;
      
      return {
        totalAmount,
        count,
        uniqueUsers,
        avgPerWithdrawal: count > 0 ? totalAmount / count : 0,
        avgPerUser: uniqueUsers > 0 ? totalAmount / uniqueUsers : 0,
      };
    },
    enabled: !!user,
  });
}

interface SyncOptions {
  days?: number;
  startDate?: string;
  endDate?: string;
  eventFilter?: string[];
}

export function useSyncMixpanel() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (options?: SyncOptions) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const body: Record<string, unknown> = {};
      if (options?.days) body.days = options.days;
      if (options?.startDate) body.startDate = options.startDate;
      if (options?.endDate) body.endDate = options.endDate;
      if (options?.eventFilter) body.eventFilter = options.eventFilter;
      
      const response = await supabase.functions.invoke('mixpanel-sync', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: Object.keys(body).length > 0 ? body : {},
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mixpanel-events'] });
      queryClient.invalidateQueries({ queryKey: ['mixpanel-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['mixpanel-withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['mixpanel-ftd-count'] });
      queryClient.invalidateQueries({ queryKey: ['user-identity-map'] });
      toast.success('Mixpanel sync started - data will be available shortly');
    },
    onError: (error) => {
      console.error('Mixpanel sync error:', error);
      toast.error(`Failed to sync Mixpanel: ${error.message}`);
    },
  });
}
