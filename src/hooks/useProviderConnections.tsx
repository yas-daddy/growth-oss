import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from './useOrganization';

export interface ProviderConnection {
  id: string;
  org_id: string;
  provider: string;
  auth_method: string;
  credentials: Record<string, any>;
  status: 'connected' | 'disconnected' | 'error';
  display_name: string | null;
  connected_at: string | null;
  last_synced_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export function useProviderConnections() {
  const { organization } = useOrganization();

  return useQuery({
    queryKey: ['provider-connections', organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('provider_connections')
        .select('*')
        .eq('org_id', organization!.id);
      if (error) throw error;
      return data as ProviderConnection[];
    },
    enabled: !!organization,
  });
}

export function useUpsertProviderConnection() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (params: {
      provider: string;
      auth_method: string;
      credentials: Record<string, any>;
      display_name?: string;
    }) => {
      if (!organization) throw new Error('No organization');

      const { data, error } = await supabase
        .from('provider_connections')
        .upsert({
          org_id: organization.id,
          provider: params.provider,
          auth_method: params.auth_method,
          credentials: params.credentials,
          display_name: params.display_name || null,
          status: 'connected',
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'org_id,provider' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-connections', organization?.id] });
    },
  });
}

export function useDisconnectProvider() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (provider: string) => {
      if (!organization) throw new Error('No organization');

      const { error } = await supabase
        .from('provider_connections')
        .update({
          status: 'disconnected',
          credentials: {},
          updated_at: new Date().toISOString(),
        })
        .eq('org_id', organization.id)
        .eq('provider', provider);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-connections', organization?.id] });
    },
  });
}
