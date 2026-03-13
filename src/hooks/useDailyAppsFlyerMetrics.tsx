import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface DailyInstall {
  id: string;
  user_id: string;
  platform: string;
  media_source: string;
  campaign_name: string;
  date: string;
  installs: number;
  synced_at: string;
  created_at: string;
}

export interface DailyClicks {
  id: string;
  user_id: string;
  platform: string;
  media_source: string;
  campaign_name: string;
  date: string;
  clicks: number;
  synced_at: string;
  created_at: string;
}

export function useDailyAppsFlyerInstalls(startDate?: string, endDate?: string, mediaSource?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['daily-appsflyer-installs', startDate, endDate, mediaSource],
    queryFn: async () => {
      let query = supabase
        .from('daily_appsflyer_installs')
        .select('*')
        .order('date', { ascending: false });
      
      if (startDate) {
        query = query.gte('date', startDate);
      }
      
      if (endDate) {
        query = query.lte('date', endDate);
      }
      
      if (mediaSource) {
        query = query.eq('media_source', mediaSource);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as DailyInstall[];
    },
    enabled: !!user,
  });
}

export function useDailyAppsFlyerClicks(startDate?: string, endDate?: string, mediaSource?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['daily-appsflyer-clicks', startDate, endDate, mediaSource],
    queryFn: async () => {
      let query = supabase
        .from('daily_appsflyer_clicks')
        .select('*')
        .order('date', { ascending: false });
      
      if (startDate) {
        query = query.gte('date', startDate);
      }
      
      if (endDate) {
        query = query.lte('date', endDate);
      }
      
      if (mediaSource) {
        query = query.eq('media_source', mediaSource);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as DailyClicks[];
    },
    enabled: !!user,
  });
}
