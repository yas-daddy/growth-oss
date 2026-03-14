import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from './useOrganization';

export interface ConversionEvent {
  id: string;
  org_id: string;
  event_name: string;
  event_label: string;
  is_primary: boolean;
  source_provider: string | null;
  created_at: string;
  updated_at: string;
}

export function useConversionEvents() {
  const { organization } = useOrganization();

  return useQuery({
    queryKey: ['conversion-events', organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversion_events')
        .select('*')
        .eq('org_id', organization!.id)
        .order('is_primary', { ascending: false });
      if (error) throw error;
      return data as ConversionEvent[];
    },
    enabled: !!organization,
  });
}

export function useCreateConversionEvent() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (params: { event_name: string; event_label: string; is_primary: boolean; source_provider?: string }) => {
      if (!organization) throw new Error('No organization');

      // If setting as primary, unset existing primary first
      if (params.is_primary) {
        await supabase
          .from('conversion_events')
          .update({ is_primary: false, updated_at: new Date().toISOString() })
          .eq('org_id', organization.id)
          .eq('is_primary', true);
      }

      const { data, error } = await supabase
        .from('conversion_events')
        .insert({
          org_id: organization.id,
          event_name: params.event_name,
          event_label: params.event_label,
          is_primary: params.is_primary,
          source_provider: (params.source_provider as any) || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversion-events', organization?.id] });
    },
  });
}

export function useUpdateConversionEvent() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (params: { id: string; event_name?: string; event_label?: string; is_primary?: boolean }) => {
      if (!organization) throw new Error('No organization');

      if (params.is_primary) {
        await supabase
          .from('conversion_events')
          .update({ is_primary: false, updated_at: new Date().toISOString() })
          .eq('org_id', organization.id)
          .eq('is_primary', true);
      }

      const { error } = await supabase
        .from('conversion_events')
        .update({
          ...(params.event_name !== undefined && { event_name: params.event_name }),
          ...(params.event_label !== undefined && { event_label: params.event_label }),
          ...(params.is_primary !== undefined && { is_primary: params.is_primary }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversion-events', organization?.id] });
    },
  });
}

export function useDeleteConversionEvent() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('conversion_events')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversion-events', organization?.id] });
    },
  });
}
