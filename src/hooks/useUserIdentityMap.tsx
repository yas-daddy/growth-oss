import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface UserIdentityMapping {
  id: string;
  mixpanel_user_id: string | null;
  distinct_id: string;
  appsflyer_id: string;
  first_seen_at: string;
  created_at: string;
}

export function useUserIdentityMap() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['user-identity-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_identity_map')
        .select('*')
        .order('first_seen_at', { ascending: false });
      
      if (error) throw error;
      return data as UserIdentityMapping[];
    },
    enabled: !!user,
  });
}

export function useIdentityByDistinctId(distinctId: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['identity-by-distinct-id', distinctId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_identity_map')
        .select('*')
        .eq('distinct_id', distinctId)
        .maybeSingle();
      
      if (error) throw error;
      return data as UserIdentityMapping | null;
    },
    enabled: !!user && !!distinctId,
  });
}

// Get appsflyer_id for a distinct_id (useful for attribution)
export function useAppsflyerIdLookup(distinctId: string | null) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['appsflyer-lookup', distinctId],
    queryFn: async () => {
      if (!distinctId) return null;
      
      const { data, error } = await supabase
        .from('user_identity_map')
        .select('appsflyer_id')
        .eq('distinct_id', distinctId)
        .maybeSingle();
      
      if (error) throw error;
      return data?.appsflyer_id || null;
    },
    enabled: !!user && !!distinctId,
  });
}
