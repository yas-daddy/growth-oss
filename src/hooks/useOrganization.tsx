import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Organization {
  id: string;
  name: string;
  slug: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface OrgMembership {
  org_id: string;
  role: 'owner' | 'admin' | 'member';
  organization: Organization;
}

interface OrganizationContextType {
  organization: Organization | null;
  membership: OrgMembership | null;
  isLoading: boolean;
  isOrgAdmin: boolean;
  isOrgOwner: boolean;
  refetch: () => void;
  // Super admin org switching
  allOrganizations: Organization[];
  switchOrganization: (orgId: string) => void;
  isSuperAdmin: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const SELECTED_ORG_KEY = 'growthOS_selectedOrgId';

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(() => {
    try { return localStorage.getItem(SELECTED_ORG_KEY); } catch { return null; }
  });

  // Check if user is super_admin
  const { data: isSuperAdmin = false } = useQuery({
    queryKey: ['is-super-admin', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id)
        .eq('role', 'super_admin');
      if (error) return false;
      return (data?.length ?? 0) > 0;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch all organizations (super admins only)
  const { data: allOrganizations = [] } = useQuery({
    queryKey: ['all-organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Organization[];
    },
    enabled: !!user && isSuperAdmin,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch user's own membership
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['user-organization', user?.id],
    queryFn: async () => {
      const { data: memberships, error } = await supabase
        .from('organization_members')
        .select('org_id, role, organizations(*)')
        .eq('user_id', user!.id)
        .limit(1);

      if (error) throw error;
      if (!memberships || memberships.length === 0) return null;

      const m = memberships[0] as any;
      return {
        org_id: m.org_id,
        role: m.role as 'owner' | 'admin' | 'member',
        organization: m.organizations as Organization,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const membership = data ?? null;

  // For super admins with a selected org, use that org; otherwise use their own
  const activeOrg = isSuperAdmin && selectedOrgId
    ? allOrganizations.find(o => o.id === selectedOrgId) ?? membership?.organization ?? null
    : membership?.organization ?? null;

  const isOrgAdmin = isSuperAdmin || membership?.role === 'admin' || membership?.role === 'owner';
  const isOrgOwner = isSuperAdmin || membership?.role === 'owner';

  const switchOrganization = useCallback((orgId: string) => {
    setSelectedOrgId(orgId);
    try { localStorage.setItem(SELECTED_ORG_KEY, orgId); } catch {}
  }, []);

  // If super admin has no selected org but has orgs available, select first
  useEffect(() => {
    if (isSuperAdmin && !selectedOrgId && allOrganizations.length > 0) {
      const defaultOrg = membership?.organization?.id || allOrganizations[0].id;
      switchOrganization(defaultOrg);
    }
  }, [isSuperAdmin, selectedOrgId, allOrganizations, membership, switchOrganization]);

  return (
    <OrganizationContext.Provider value={{
      organization: activeOrg,
      membership,
      isLoading,
      isOrgAdmin,
      isOrgOwner,
      refetch,
      allOrganizations,
      switchOrganization,
      isSuperAdmin,
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}
