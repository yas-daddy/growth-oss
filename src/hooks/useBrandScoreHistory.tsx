import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface WeeklyBrandScore {
  week: string;
  weekLabel: string;
  totalScore: number;
  nps: number;
  searchVisibility: number;
  rating: number;
  organicInstalls: number;
  referrals: number;
}

export function useBrandScoreHistory(weeks: number = 52) {
  return useQuery({
    queryKey: ["brand-score-history", weeks],
    queryFn: async (): Promise<WeeklyBrandScore[]> => {
      const { data, error } = await supabase
        .from("weekly_brand_scores")
        .select("*")
        .order("week_start", { ascending: true })
        .limit(weeks);

      if (error) throw error;

      return (data || []).map(row => ({
        week: row.week_start,
        weekLabel: format(new Date(row.week_start), "MMM d"),
        totalScore: row.total_score,
        nps: row.nps_score,
        searchVisibility: row.search_visibility_score,
        rating: row.rating_score,
        organicInstalls: row.organic_installs_score,
        referrals: row.referrals_score,
      }));
    },
  });
}
