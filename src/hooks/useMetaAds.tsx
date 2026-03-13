import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSyncFunctionLogs } from './useSyncFunctionLogs';

export interface MetaAd {
  id: string;
  ad_id: string;
  ad_name: string;
  adset_id: string | null;
  adset_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  preview_url: string | null;
  thumbnail_url: string | null;
  creative_type: string | null;
  status: string | null;
  created_time: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  date_start: string | null;
  date_stop: string | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface DailyMetaAdSpend {
  id: string;
  ad_id: string;
  ad_name: string;
  campaign_id: string | null;
  campaign_name: string | null;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  synced_at: string;
  created_at: string;
  user_id: string;
}

export function useMetaAds() {
  return useQuery({
    queryKey: ['meta-ads'],
    queryFn: async (): Promise<MetaAd[]> => {
      const { data, error } = await supabase
        .from('meta_ads')
        .select('*')
        .order('spend', { ascending: false });

      if (error) throw error;
      return (data || []) as MetaAd[];
    },
  });
}

export function useDailyMetaAdSpend(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['daily-meta-ad-spend', startDate, endDate],
    queryFn: async (): Promise<DailyMetaAdSpend[]> => {
      let query = supabase
        .from('daily_meta_ad_spend')
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
      return (data || []) as DailyMetaAdSpend[];
    },
    enabled: !!startDate && !!endDate,
  });
}

export interface MonthlyTopAds {
  month: string;
  totalSpend: number;
  weightedAvgAge: number;
  ads: {
    ad_name: string;
    thumbnail_url: string | null;
    spend: number;
    impressions: number;
    conversions: number;
    age_days: number;
  }[];
}

export function useMonthlyTopAds() {
  return useQuery({
    queryKey: ['monthly-top-ads'],
    queryFn: async (): Promise<MonthlyTopAds[]> => {
      // Get all daily ad spend records - fetch in batches to avoid 1000 row limit
      let allDailyData: DailyMetaAdSpend[] = [];
      let offset = 0;
      const batchSize = 1000;
      
      while (true) {
        const { data: batch, error } = await supabase
          .from('daily_meta_ad_spend')
          .select('*')
          .order('date', { ascending: false })
          .range(offset, offset + batchSize - 1);
        
        if (error) throw error;
        if (!batch || batch.length === 0) break;
        
        allDailyData = [...allDailyData, ...(batch as DailyMetaAdSpend[])];
        if (batch.length < batchSize) break;
        offset += batchSize;
      }

      // Get ad metadata (thumbnail, created_time) - we'll use the first one found per ad_name
      const { data: adsData, error: adsError } = await supabase
        .from('meta_ads')
        .select('ad_name, thumbnail_url, created_time');

      if (adsError) throw adsError;

      // Map ad_name to metadata (first found thumbnail and earliest created_time)
      const adMetadataByName = new Map<string, { 
        thumbnail_url: string | null; 
        created_times: Date[];
      }>();
      
      for (const ad of (adsData || [])) {
        const existing = adMetadataByName.get(ad.ad_name);
        const createdTime = ad.created_time ? new Date(ad.created_time) : null;
        
        if (existing) {
          // Keep first non-null thumbnail
          if (!existing.thumbnail_url && ad.thumbnail_url) {
            existing.thumbnail_url = ad.thumbnail_url;
          }
          // Collect all created times for averaging
          if (createdTime) {
            existing.created_times.push(createdTime);
          }
        } else {
          adMetadataByName.set(ad.ad_name, {
            thumbnail_url: ad.thumbnail_url,
            created_times: createdTime ? [createdTime] : [],
          });
        }
      }

      // Group daily spend by month and ad_name (not ad_id)
      const monthlySpend = new Map<string, Map<string, { 
        spend: number; 
        impressions: number; 
        conversions: number;
      }>>();

      for (const record of allDailyData) {
        const month = record.date.substring(0, 7); // YYYY-MM
        
        if (!monthlySpend.has(month)) {
          monthlySpend.set(month, new Map());
        }
        
        const monthAds = monthlySpend.get(month)!;
        const existing = monthAds.get(record.ad_name) || {
          spend: 0,
          impressions: 0,
          conversions: 0,
        };
        
        existing.spend += record.spend;
        existing.impressions += record.impressions;
        existing.conversions += record.conversions;
        
        monthAds.set(record.ad_name, existing);
      }

      // Convert to array and get top 5 per month
      const result: MonthlyTopAds[] = [];
      const now = new Date();
      
      for (const [month, adsMap] of monthlySpend) {
        // Calculate total spend and weighted age sum for ALL ads in this month
        let totalMonthSpend = 0;
        let weightedAgeSum = 0;
        
        const allAdsWithAge = Array.from(adsMap.entries()).map(([ad_name, data]) => {
          const metadata = adMetadataByName.get(ad_name);
          
          // Calculate average age from all created times
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
            ad_name,
            thumbnail_url: metadata?.thumbnail_url || null,
            spend: data.spend,
            impressions: data.impressions,
            conversions: data.conversions,
            age_days: avgAgeDays,
          };
        });
        
        const weightedAvgAge = totalMonthSpend > 0 ? Math.round(weightedAgeSum / totalMonthSpend) : 0;
        
        const ads = allAdsWithAge
          .sort((a, b) => b.spend - a.spend)
          .slice(0, 5);
        
        if (ads.length > 0) {
          result.push({ month, totalSpend: totalMonthSpend, weightedAvgAge, ads });
        }
      }

      // Sort months descending (newest first)
      result.sort((a, b) => b.month.localeCompare(a.month));
      
      return result;
    },
  });
}

export function useSyncMetaAds() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (): Promise<{ success: boolean; summary?: { totalAds: number; totalDailyRecords: number } }> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('meta-sync-ads', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-ads'] });
      queryClient.invalidateQueries({ queryKey: ['daily-meta-ad-spend'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-top-ads'] });
      queryClient.invalidateQueries({ queryKey: ['sync-function-logs'] });
    },
  });
}

export function useMetaAdsSyncStatus() {
  const { data: logs } = useSyncFunctionLogs();
  
  const metaAdsLogs = logs?.filter(log => log.function_name === 'meta-sync-ads') || [];
  const latestSync = metaAdsLogs[0];
  const isConnected = latestSync?.status === 'success';
  const lastSyncedAt = latestSync?.completed_at;
  
  return {
    isConnected,
    lastSyncedAt,
    latestLog: latestSync,
  };
}
