import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MolocoCreative {
  id: string;
  user_id: string;
  creative_id: string;
  creative_name: string;
  creative_type: string | null;
  main_asset_url: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  ad_group_id: string | null;
  ad_group_name: string | null;
  status: string | null;
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_installs: number;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface DailyMolocoCreativeSpend {
  id: string;
  user_id: string;
  creative_id: string;
  creative_name: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  installs: number;
  revenue: number;
  synced_at: string;
  created_at: string;
}

export function useMolocoCreatives() {
  return useQuery({
    queryKey: ['moloco-creatives'],
    queryFn: async (): Promise<MolocoCreative[]> => {
      const { data, error } = await supabase
        .from('moloco_creatives')
        .select('*')
        .order('total_spend', { ascending: false });

      if (error) throw error;
      return (data || []) as MolocoCreative[];
    },
  });
}

export function useDailyMolocoCreativeSpend(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['daily-moloco-creative-spend', startDate, endDate],
    queryFn: async (): Promise<DailyMolocoCreativeSpend[]> => {
      let query = supabase
        .from('daily_moloco_creative_spend')
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
      return (data || []) as DailyMolocoCreativeSpend[];
    },
    enabled: !!startDate && !!endDate,
  });
}

export interface MonthlyTopCreatives {
  month: string;
  totalSpend: number;
  weightedAvgAge: number;
  creatives: {
    creative_name: string;
    thumbnail_url: string | null;
    spend: number;
    impressions: number;
    installs: number;
    age_days: number;
  }[];
}

export function useMonthlyTopMolocoCreatives() {
  return useQuery({
    queryKey: ['monthly-top-moloco-creatives'],
    queryFn: async (): Promise<MonthlyTopCreatives[]> => {
      // Get all daily creative spend records
      const { data: dailyData, error: dailyError } = await supabase
        .from('daily_moloco_creative_spend')
        .select('*')
        .order('date', { ascending: false });

      if (dailyError) throw dailyError;

      // Get creative metadata (main_asset_url)
      const { data: creativesData, error: creativesError } = await supabase
        .from('moloco_creatives')
        .select('creative_name, main_asset_url, created_at');

      if (creativesError) throw creativesError;

      // Map creative_name to metadata
      const creativeMetadataByName = new Map<string, { 
        thumbnail_url: string | null; 
        created_times: Date[];
      }>();
      
      for (const creative of (creativesData || [])) {
        const existing = creativeMetadataByName.get(creative.creative_name);
        const createdTime = creative.created_at ? new Date(creative.created_at) : null;
        
        if (existing) {
          if (!existing.thumbnail_url && creative.main_asset_url) {
            existing.thumbnail_url = creative.main_asset_url;
          }
          if (createdTime) {
            existing.created_times.push(createdTime);
          }
        } else {
          creativeMetadataByName.set(creative.creative_name, {
            thumbnail_url: creative.main_asset_url,
            created_times: createdTime ? [createdTime] : [],
          });
        }
      }

      // Group daily spend by month and creative_name
      const monthlySpend = new Map<string, Map<string, { 
        spend: number; 
        impressions: number; 
        installs: number;
      }>>();

      for (const record of (dailyData || []) as DailyMolocoCreativeSpend[]) {
        const month = record.date.substring(0, 7); // YYYY-MM
        
        if (!monthlySpend.has(month)) {
          monthlySpend.set(month, new Map());
        }
        
        const monthCreatives = monthlySpend.get(month)!;
        const existing = monthCreatives.get(record.creative_name) || {
          spend: 0,
          impressions: 0,
          installs: 0,
        };
        
        existing.spend += record.spend;
        existing.impressions += record.impressions;
        existing.installs += record.installs;
        
        monthCreatives.set(record.creative_name, existing);
      }

      // Convert to array and get top 5 per month
      const result: MonthlyTopCreatives[] = [];
      const now = new Date();
      
      for (const [month, creativesMap] of monthlySpend) {
        // Calculate total spend and weighted age sum for ALL creatives in this month
        let totalMonthSpend = 0;
        let weightedAgeSum = 0;
        
        const allCreativesWithAge = Array.from(creativesMap.entries()).map(([creative_name, data]) => {
          const metadata = creativeMetadataByName.get(creative_name);
          
          let avgAgeDays = 0;
          if (metadata?.created_times && metadata.created_times.length > 0) {
            const totalAgeDays = metadata.created_times.reduce((sum, ct) => {
              return sum + Math.floor((now.getTime() - ct.getTime()) / (1000 * 60 * 60 * 24));
            }, 0);
            avgAgeDays = Math.round(totalAgeDays / metadata.created_times.length);
          }
          
          totalMonthSpend += data.spend;
          weightedAgeSum += avgAgeDays * data.spend;
          
          return {
            creative_name,
            thumbnail_url: metadata?.thumbnail_url || null,
            spend: data.spend,
            impressions: data.impressions,
            installs: data.installs,
            age_days: avgAgeDays,
          };
        });
        
        const weightedAvgAge = totalMonthSpend > 0 ? Math.round(weightedAgeSum / totalMonthSpend) : 0;
        
        const creatives = allCreativesWithAge
          .sort((a, b) => b.spend - a.spend)
          .slice(0, 5);
        
        if (creatives.length > 0) {
          result.push({ month, totalSpend: totalMonthSpend, weightedAvgAge, creatives });
        }
      }

      // Sort months descending (newest first)
      result.sort((a, b) => b.month.localeCompare(a.month));
      
      return result;
    },
  });
}

export function useMolocoCreativesSyncStatus() {
  const { data: creatives } = useMolocoCreatives();
  
  const isConnected = (creatives?.length || 0) > 0;
  const lastSyncedAt = creatives && creatives.length > 0 
    ? creatives.reduce((latest, c) => {
        const syncedAt = new Date(c.synced_at);
        return syncedAt > latest ? syncedAt : latest;
      }, new Date(0)).toISOString()
    : null;
  
  return {
    isConnected,
    lastSyncedAt,
  };
}
