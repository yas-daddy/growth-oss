import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useReferralSignupCount(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['referral-signups', startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('mixpanel_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_name', 'signup_completed_referral');
      
      if (startDate) {
        query = query.gte('event_time', `${startDate}T00:00:00`);
      }
      if (endDate) {
        query = query.lte('event_time', `${endDate}T23:59:59`);
      }
      
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    enabled: !!startDate && !!endDate,
  });
}

export function useReferralStats(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['referral-stats', startDate, endDate],
    queryFn: async () => {
      const [referralResult, signupResult] = await Promise.all([
        supabase
          .from('mixpanel_events')
          .select('*', { count: 'exact', head: true })
          .eq('event_name', 'signup_completed_referral')
          .gte('event_time', `${startDate}T00:00:00`)
          .lte('event_time', `${endDate}T23:59:59`),
        supabase
          .from('mixpanel_events')
          .select('*', { count: 'exact', head: true })
          .eq('event_name', 'signup_completed')
          .gte('event_time', `${startDate}T00:00:00`)
          .lte('event_time', `${endDate}T23:59:59`),
      ]);

      if (referralResult.error) throw referralResult.error;
      if (signupResult.error) throw signupResult.error;

      const referralCount = referralResult.count || 0;
      const totalSignups = signupResult.count || 0;
      const referralPercent = totalSignups > 0 ? (referralCount / totalSignups) * 100 : 0;

      return {
        referralCount,
        totalSignups,
        referralPercent,
      };
    },
    enabled: !!startDate && !!endDate,
  });
}
