import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface SyncFunctionLog {
  id: string;
  function_name: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'success' | 'error';
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
}

export interface SyncFunctionStatus {
  function_name: string;
  display_name: string;
  category: string;
  last_run: SyncFunctionLog | null;
  last_success: SyncFunctionLog | null;
}

const SYNC_FUNCTIONS = [
  { name: 'generate-recommendations', display: 'AI Recommendations', category: 'AI Analysis' },
  { name: 'meta-sync-campaigns', display: 'Meta Campaigns', category: 'Ad Platforms' },
  { name: 'meta-sync-ads', display: 'Meta Creatives', category: 'Ad Platforms' },
  { name: 'apple-sync-campaigns', display: 'Apple Campaigns', category: 'Ad Platforms' },
  { name: 'apple-sync-keywords', display: 'Apple Keywords', category: 'Ad Platforms' },
  { name: 'moloco-sync-campaigns', display: 'Moloco Campaigns', category: 'Ad Platforms' },
  { name: 'appsflyer-sync', display: 'AppsFlyer', category: 'Attribution' },
  { name: 'appsflyer-keyword-sync', display: 'AppsFlyer Keywords', category: 'Attribution' },
  { name: 'mixpanel-sync', display: 'Mixpanel', category: 'Analytics' },
  { name: 'google-search-console-sync', display: 'Google Search Console', category: 'Brand Visibility' },
  { name: 'appstore-analytics-sync', display: 'App Store Organic Installs', category: 'Brand Visibility' },
  { name: 'app-store-sync', display: 'App Store Reviews', category: 'Reviews' },
  { name: 'google-play-sync', display: 'Google Play Reviews', category: 'Reviews' },
  { name: 'trustpilot-sync', display: 'Trustpilot Reviews', category: 'Reviews' },


  { name: 'calculate-weekly-metrics', display: 'Weekly Metrics', category: 'Calculations' },
  { name: 'calculate-monthly-metrics', display: 'Monthly Metrics', category: 'Calculations' },
  { name: 'populate-funnel-metrics', display: 'Funnel Metrics', category: 'Calculations' },
  { name: 'auto-respond-reviews', display: 'Auto-Respond Reviews', category: 'Automation' },
];

export function useSyncFunctionLogs() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['sync-function-logs'],
    queryFn: async () => {
      // Get the last 100 logs ordered by started_at
      const { data, error } = await supabase
        .from('sync_function_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching sync logs:', error);
        return [];
      }

      return data as SyncFunctionLog[];
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useSyncFunctionStatuses() {
  const { data: logs, isLoading } = useSyncFunctionLogs();

  const statuses: SyncFunctionStatus[] = SYNC_FUNCTIONS.map(fn => {
    const functionLogs = logs?.filter(log => log.function_name === fn.name) || [];
    const lastRun = functionLogs[0] || null;
    const lastSuccess = functionLogs.find(log => log.status === 'success') || null;

    return {
      function_name: fn.name,
      display_name: fn.display,
      category: fn.category,
      last_run: lastRun,
      last_success: lastSuccess,
    };
  });

  return { statuses, isLoading };
}
