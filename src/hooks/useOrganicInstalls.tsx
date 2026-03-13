import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface OrganicMetric {
  id: string;
  date: string;
  source_type: string;
  downloads: number;
  first_time_downloads: number | null;
  redownloads: number | null;
  synced_at: string | null;
}

export function useOrganicInstalls(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["organic-installs", startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("appstore_organic_metrics")
        .select("*")
        .order("date", { ascending: true });

      if (startDate) {
        query = query.gte("date", startDate);
      }
      if (endDate) {
        query = query.lte("date", endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as OrganicMetric[];
    },
  });
}

export function useOrganicInstallsSummary() {
  return useQuery({
    queryKey: ["organic-installs-summary"],
    queryFn: async () => {
      // Account for 4-day data delay
      const DATA_DELAY_DAYS = 4;
      const referenceDate = new Date();
      referenceDate.setDate(referenceDate.getDate() - DATA_DELAY_DAYS);

      // Get last 30 days (ending at reference date)
      const thirtyDaysAgo = new Date(referenceDate);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = thirtyDaysAgo.toISOString().split("T")[0];
      const endDate = referenceDate.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("appstore_organic_metrics")
        .select("source_type, downloads")
        .gte("date", startDate)
        .lte("date", endDate);

      if (error) throw error;

      // Aggregate by source type
      const bySource: Record<string, number> = {};
      let totalOrganic = 0;

      for (const row of data || []) {
        const source = row.source_type || "unknown";
        bySource[source] = (bySource[source] || 0) + (row.downloads || 0);
        totalOrganic += row.downloads || 0;
      }

      // Get total installs from appsflyer for comparison
      const { data: appsflyerData, error: afError } = await supabase
        .from("daily_appsflyer_installs")
        .select("installs")
        .gte("date", startDate)
        .lte("date", endDate);

      if (afError) {
        console.error("Error fetching appsflyer installs:", afError);
      }

      const paidInstalls = appsflyerData?.reduce((sum, d) => sum + (d.installs || 0), 0) || 0;
      const totalInstalls = totalOrganic + paidInstalls;
      const organicPercentage = totalInstalls > 0 ? (totalOrganic / totalInstalls) * 100 : 0;

      return {
        bySource,
        totalOrganic,
        paidInstalls,
        totalInstalls,
        organicPercentage,
        appStoreSearch: bySource["app_store_search"] || 0,
        appStoreBrowse: bySource["app_store_browse"] || 0,
      };
    },
  });
}

export function useOrganicInstallsStats() {
  return useQuery({
    queryKey: ['organic-installs-stats'],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('appstore_organic_metrics')
        .select('*', { count: 'exact' })
        .order('synced_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      return {
        totalRecords: count || 0,
        lastSynced: data?.[0]?.synced_at || null,
      };
    },
  });
}

export function useSyncOrganicInstalls() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('appstore-analytics-sync', {
        method: 'POST',
        body: {},
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Sync Complete',
        description: data?.message || 'App Store organic installs synced successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['organic-installs'] });
      queryClient.invalidateQueries({ queryKey: ['organic-installs-stats'] });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Sync Failed',
        description: error.message,
      });
    },
  });
}

export function useSearchConsoleStats() {
  return useQuery({
    queryKey: ['search-console-stats'],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('google_search_console_metrics')
        .select('*', { count: 'exact' })
        .order('synced_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      return {
        totalRecords: count || 0,
        lastSynced: data?.[0]?.synced_at || null,
      };
    },
  });
}

export function useSyncSearchConsole() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('google-search-console-sync', {
        method: 'POST',
        body: {},
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Sync Complete',
        description: data?.message || 'Google Search Console synced successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['search-console-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['search-console-stats'] });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Sync Failed',
        description: error.message,
      });
    },
  });
}
