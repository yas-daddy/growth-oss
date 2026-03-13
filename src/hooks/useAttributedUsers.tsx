import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface AttributedUser {
  id: string;
  user_id: string;
  appsflyer_id: string;
  media_source: string;
  campaign_name: string | null;
  campaign_id: string | null;
  adset_name: string | null;
  ad_name: string | null;
  platform: string;
  install_time: string;
  country_code: string | null;
  device_type: string | null;
  is_retargeting: boolean;
  created_at: string;
  synced_at: string;
}

export function useAttributedUsers(mediaSource?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['attributed-users', mediaSource],
    queryFn: async () => {
      let query = supabase
        .from('attributed_users')
        .select('*')
        .order('install_time', { ascending: false });
      
      if (mediaSource) {
        query = query.eq('media_source', mediaSource);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as AttributedUser[];
    },
    enabled: !!user,
  });
}

export function useAttributedUserByAppsflyerId(appsflyerId: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['attributed-user', appsflyerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attributed_users')
        .select('*')
        .eq('appsflyer_id', appsflyerId)
        .maybeSingle();
      
      if (error) throw error;
      return data as AttributedUser | null;
    },
    enabled: !!user && !!appsflyerId,
  });
}

export function useAttributionStats() {
  const { data: users } = useAttributedUsers();
  
  if (!users || users.length === 0) {
    return {
      totalUsers: 0,
      byMediaSource: {} as Record<string, number>,
      byCampaign: {} as Record<string, number>,
      byPlatform: { ios: 0, android: 0 },
    };
  }
  
  const byMediaSource: Record<string, number> = {};
  const byCampaign: Record<string, number> = {};
  const byPlatform = { ios: 0, android: 0 };
  
  for (const user of users) {
    // By media source
    byMediaSource[user.media_source] = (byMediaSource[user.media_source] || 0) + 1;
    
    // By campaign
    if (user.campaign_name) {
      byCampaign[user.campaign_name] = (byCampaign[user.campaign_name] || 0) + 1;
    }
    
    // By platform
    if (user.platform === 'ios') {
      byPlatform.ios++;
    } else if (user.platform === 'android') {
      byPlatform.android++;
    }
  }
  
  return {
    totalUsers: users.length,
    byMediaSource,
    byCampaign,
    byPlatform,
  };
}
