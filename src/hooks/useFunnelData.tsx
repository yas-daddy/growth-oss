import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface FunnelData {
  impressions: number;
  clicks: number;
  installs: number;
  signups: number;
  ftds: number;
  stds: number;
}

export function useFunnelData(startDate?: string, endDate?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['funnel-data', startDate, endDate],
    queryFn: async (): Promise<FunnelData> => {
      const startTimestamp = startDate ? `${startDate}T00:00:00.000Z` : undefined;
      const endTimestamp = endDate ? `${endDate}T23:59:59.999Z` : undefined;

      // Get blended installs from daily_appsflyer_installs (includes organic)
      let installsQuery = supabase
        .from('daily_appsflyer_installs')
        .select('installs');
      
      if (startDate) {
        installsQuery = installsQuery.gte('date', startDate);
      }
      if (endDate) {
        installsQuery = installsQuery.lte('date', endDate);
      }

      // Count signups
      let signupQuery = supabase
        .from('mixpanel_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_name', 'signup_completed');
      
      if (startTimestamp) {
        signupQuery = signupQuery.gte('event_time', startTimestamp);
      }
      if (endTimestamp) {
        signupQuery = signupQuery.lte('event_time', endTimestamp);
      }

      // Count unique FTDs using RPC function
      const ftdQuery = startTimestamp && endTimestamp 
        ? supabase.rpc('get_unique_ftd_count', {
            start_ts: startTimestamp,
            end_ts: endTimestamp,
          })
        : Promise.resolve({ data: 0, error: null });

      // Count STDs
      let stdQuery = supabase
        .from('mixpanel_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_name', 'second_time_deposit');
      
      if (startTimestamp) {
        stdQuery = stdQuery.gte('event_time', startTimestamp);
      }
      if (endTimestamp) {
        stdQuery = stdQuery.lte('event_time', endTimestamp);
      }

      // Execute all count queries in parallel
      const [installsResult, signupResult, ftdResult, stdResult] = await Promise.all([
        installsQuery,
        signupQuery,
        ftdQuery,
        stdQuery,
      ]);

      if (installsResult.error) throw installsResult.error;
      if (signupResult.error) throw signupResult.error;
      if (ftdResult.error) throw ftdResult.error;
      if (stdResult.error) throw stdResult.error;

      // Sum installs from daily records
      const totalInstalls = installsResult.data?.reduce((sum, row) => sum + (row.installs || 0), 0) || 0;

      return {
        impressions: 0, // Not used in funnel visualization
        clicks: 0, // Not used in funnel visualization
        installs: totalInstalls,
        signups: signupResult.count || 0,
        ftds: ftdResult.data || 0, // RPC returns data, not count
        stds: stdResult.count || 0,
      };
    },
    enabled: !!user,
  });
}
