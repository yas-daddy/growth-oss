import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole = 'admin' | 'editor' | 'viewer' | 'user' | 'affiliate';

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface AffiliateAccess {
  id: string;
  user_id: string;
  affiliate_id: string;
  created_at: string;
}

export function useUserRole() {
  const { user } = useAuth();
  
  const { data: roles, isLoading } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user!.id);
      
      if (error) throw error;
      return data as UserRole[];
    },
    enabled: !!user,
  });

  const { data: affiliateAccess } = useQuery({
    queryKey: ['affiliate-access', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affiliate_user_access')
        .select('*')
        .eq('user_id', user!.id);
      
      if (error) throw error;
      return data as AffiliateAccess[];
    },
    enabled: !!user,
  });

  const role = roles?.[0]?.role || 'viewer';
  const isAdmin = role === 'admin';
  const isUser = role === 'user' || role === 'viewer' || role === 'editor';
  const isAffiliate = role === 'affiliate';
  
  // Admins can do everything
  // Users can view everything but not change settings or sync
  // Affiliates can only access their specific partner page
  const canManageSettings = isAdmin;
  const canSyncData = isAdmin;
  const canViewDashboard = isAdmin || isUser;
  const canManageUsers = isAdmin;

  const affiliateIds = affiliateAccess?.map(a => a.affiliate_id) || [];

  return {
    role,
    roles,
    isAdmin,
    isUser,
    isAffiliate,
    canManageSettings,
    canSyncData,
    canViewDashboard,
    canManageUsers,
    affiliateIds,
    isLoading,
  };
}

export function useAllUsers() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  
  return useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      // Get all profiles with their roles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');
      
      if (rolesError) throw rolesError;

      const { data: affiliateAccess, error: accessError } = await supabase
        .from('affiliate_user_access')
        .select('*, affiliates(name)');
      
      if (accessError) throw accessError;

      // Merge data
      return profiles.map(profile => {
        const userRoles = roles.filter(r => r.user_id === profile.user_id);
        const userAffiliates = affiliateAccess.filter(a => a.user_id === profile.user_id);
        return {
          ...profile,
          roles: userRoles,
          affiliateAccess: userAffiliates,
        };
      });
    },
    enabled: !!user && isAdmin,
  });
}

export function useUserInvitations() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  
  return useQuery({
    queryKey: ['user-invitations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_invitations')
        .select('*, affiliates(name)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user && isAdmin,
  });
}
