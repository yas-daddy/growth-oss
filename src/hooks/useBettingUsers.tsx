import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface BettingUsersByChannel {
  channel: string;
  users: number;
}

export function useBettingUsers(startDate?: string, endDate?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['betting-users', user?.id, startDate, endDate],
    queryFn: async (): Promise<BettingUsersByChannel[]> => {
      if (!user) return [];

      let query = supabase
        .from('appsflyer_events')
        .select('media_source, event_count')
        .eq('event_name', 'betting_users');

      if (startDate) {
        query = query.gte('event_date', startDate);
      }
      if (endDate) {
        query = query.lte('event_date', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Group by media_source and sum unique users
      const usersByChannel = new Map<string, number>();
      for (const event of data || []) {
        const channel = event.media_source;
        const users = event.event_count || 0;
        usersByChannel.set(channel, (usersByChannel.get(channel) || 0) + users);
      }

      return Array.from(usersByChannel.entries())
        .map(([channel, users]) => ({ channel, users }))
        .sort((a, b) => b.users - a.users);
    },
    enabled: !!user,
  });
}

export function useTotalBettingUsers(startDate?: string, endDate?: string) {
  const { data: bettingUsers = [] } = useBettingUsers(startDate, endDate);
  
  return bettingUsers.reduce((sum, c) => sum + c.users, 0);
}
