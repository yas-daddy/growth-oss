import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SearchConsoleMetric {
  id: string;
  date: string;
  impressions: number;
  clicks: number;
  ctr: number | null;
  position: number | null;
  synced_at: string | null;
}

export function useSearchConsoleMetrics(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["search-console-metrics", startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("google_search_console_metrics")
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
      return data as SearchConsoleMetric[];
    },
  });
}

export function useSearchConsoleSummary() {
  return useQuery({
    queryKey: ["search-console-summary"],
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

      // Calculate baseline from 12 months ago (30-day window)
      const twelveMonthsAgo = new Date(referenceDate);
      twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
      const baselineEnd = twelveMonthsAgo.toISOString().split("T")[0];
      const baselineStartDate = new Date(twelveMonthsAgo);
      baselineStartDate.setDate(baselineStartDate.getDate() - 30);
      const baselineStart = baselineStartDate.toISOString().split("T")[0];

      // Fetch current period and baseline period data in parallel
      const [currentResult, baselineResult] = await Promise.all([
        supabase
          .from("google_search_console_metrics")
          .select("impressions, clicks, ctr")
          .gte("date", startDate)
          .lte("date", endDate),
        supabase
          .from("google_search_console_metrics")
          .select("impressions, clicks")
          .gte("date", baselineStart)
          .lte("date", baselineEnd),
      ]);

      if (currentResult.error) throw currentResult.error;
      if (baselineResult.error) throw baselineResult.error;

      const currentData = currentResult.data;
      const baselineData = baselineResult.data;

      const sumMetrics = (data: typeof currentData) => ({
        impressions: data?.reduce((sum, d) => sum + (d.impressions || 0), 0) || 0,
        clicks: data?.reduce((sum, d) => sum + (d.clicks || 0), 0) || 0,
        avgCtr: data && data.length > 0 
          ? data.reduce((sum, d) => sum + ((d as { ctr?: number | null }).ctr || 0), 0) / data.length 
          : 0,
      });

      const current = sumMetrics(currentData);
      const baseline = {
        impressions: baselineData?.reduce((sum, d) => sum + (d.impressions || 0), 0) || 0,
        clicks: baselineData?.reduce((sum, d) => sum + (d.clicks || 0), 0) || 0,
      };

      // Check if we have valid baseline data (at least some data from 12 months ago)
      const hasValidBaseline = baselineData && baselineData.length > 0 && 
        (baseline.impressions > 0 || baseline.clicks > 0);

      // Minimum thresholds to avoid division by zero
      const MIN_IMPRESSIONS = 100;
      const MIN_CLICKS = 10;

      // Calculate targets: baseline × 1.2^12 (12 months of 20% compound growth)
      const compoundMultiplier = Math.pow(1.2, 12); // ≈ 8.916
      const baselineImpressions = Math.max(baseline.impressions, MIN_IMPRESSIONS);
      const baselineClicks = Math.max(baseline.clicks, MIN_CLICKS);
      const targetImpressions = Math.round(baselineImpressions * compoundMultiplier);
      const targetClicks = Math.round(baselineClicks * compoundMultiplier);

      // Calculate achievement percentages
      const impressionsAchievement = targetImpressions > 0 
        ? (current.impressions / targetImpressions) * 100 
        : 0;
      const clicksAchievement = targetClicks > 0 
        ? (current.clicks / targetClicks) * 100 
        : 0;
      const targetAchievementPercent = (impressionsAchievement + clicksAchievement) / 2;

      return {
        impressions: current.impressions,
        clicks: current.clicks,
        ctr: current.avgCtr,
        // New target-based fields
        baselineImpressions: baseline.impressions,
        baselineClicks: baseline.clicks,
        targetImpressions,
        targetClicks,
        targetAchievementPercent,
        hasValidBaseline,
      };
    },
  });
}
