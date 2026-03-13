import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NPSMetric {
  id: string;
  date: string;
  promoters: number;
  passives: number;
  detractors: number;
  nps_score: number | null;
  calculated_at: string | null;
}

export function useNPSMetrics(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["nps-metrics", startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("daily_nps_metrics")
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
      return data as NPSMetric[];
    },
  });
}

export function useCurrentNPS() {
  return useQuery({
    queryKey: ["current-nps"],
    queryFn: async () => {
      // Get aggregate NPS from typeform_surveys directly for most accurate current NPS
      const { data, error } = await supabase
        .from("typeform_surveys")
        .select("nps_score")
        .not("nps_score", "is", null);

      if (error) throw error;

      if (!data || data.length === 0) {
        return { nps: null, promoters: 0, passives: 0, detractors: 0, total: 0 };
      }

      let promoters = 0;
      let passives = 0;
      let detractors = 0;

      for (const survey of data) {
        const score = survey.nps_score;
        if (score >= 9) promoters++;
        else if (score >= 7) passives++;
        else detractors++;
      }

      const total = promoters + passives + detractors;
      const nps = total > 0 
        ? Math.round(((promoters / total) - (detractors / total)) * 100) 
        : null;

      return { nps, promoters, passives, detractors, total };
    },
  });
}

export interface MonthlyNPSMetric {
  month: string;
  monthLabel: string;
  nps: number | null;
  promoters: number;
  passives: number;
  detractors: number;
  total: number;
}

export function useMonthlyNPSMetrics(months: number = 12) {
  return useQuery({
    queryKey: ["monthly-nps-metrics", months],
    queryFn: async () => {
      // Calculate date range for the past N months
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);
      
      const { data, error } = await supabase
        .from("typeform_surveys")
        .select("nps_score, submitted_at")
        .not("nps_score", "is", null)
        .gte("submitted_at", startDate.toISOString())
        .lte("submitted_at", endDate.toISOString())
        .order("submitted_at", { ascending: true });

      if (error) throw error;

      // Group by month
      const monthlyData: Record<string, { promoters: number; passives: number; detractors: number }> = {};
      
      for (const survey of data || []) {
        const date = new Date(survey.submitted_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { promoters: 0, passives: 0, detractors: 0 };
        }
        
        const score = survey.nps_score;
        if (score >= 9) monthlyData[monthKey].promoters++;
        else if (score >= 7) monthlyData[monthKey].passives++;
        else monthlyData[monthKey].detractors++;
      }

      // Convert to array with NPS calculation
      const result: MonthlyNPSMetric[] = Object.entries(monthlyData)
        .map(([month, counts]) => {
          const total = counts.promoters + counts.passives + counts.detractors;
          const nps = total > 0 
            ? Math.round(((counts.promoters / total) - (counts.detractors / total)) * 100)
            : null;
          
          // Format month label (e.g., "Jan 2025")
          const [year, monthNum] = month.split('-');
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const monthLabel = `${monthNames[parseInt(monthNum) - 1]} ${year}`;
          
          return {
            month,
            monthLabel,
            nps,
            ...counts,
            total,
          };
        })
        .sort((a, b) => a.month.localeCompare(b.month));

      return result;
    },
  });
}
