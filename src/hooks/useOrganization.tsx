import { createContext, useContext, ReactNode } from 'react';
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
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['user-organization', user?.id],
    queryFn: async () => {
      // Get the user's org membership (take the first org for now)
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
  const organization = membership?.organization ?? null;
  const isOrgAdmin = membership?.role === 'admin' || membership?.role === 'owner';
  const isOrgOwner = membership?.role === 'owner';

  return (
    <OrganizationContext.Provider value={{ organization, membership, isLoading, isOrgAdmin, isOrgOwner, refetch }}>
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
