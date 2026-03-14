import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export interface DashboardConfig {
  id: string;
  dashboard_slug: string;
  report_slugs: string[];
  name: string | null;
  icon: string | null;
  display_order: number | null;
  is_deletable: boolean | null;
  description: string | null;
  org_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useAllDashboards() {
  const { user } = useAuth();
  const { organization } = useOrganization();

  return useQuery({
    queryKey: ['all-dashboards', organization?.id],
    queryFn: async () => {
      let query = supabase
        .from('dashboard_configs')
        .select('*')
        .order('display_order', { ascending: true });

      if (organization) {
        query = query.eq('org_id', organization.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching dashboards:', error);
        return [];
      }

      return data as DashboardConfig[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateDashboard() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async ({ name, icon }: { name: string; icon: string }) => {
      if (!organization) throw new Error('No organization');

      const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      
      const { data: existing } = await supabase
        .from('dashboard_configs')
        .select('display_order')
        .eq('org_id', organization.id)
        .order('display_order', { ascending: false })
        .limit(1);
      
      const nextOrder = ((existing?.[0]?.display_order ?? 0) as number) + 1;

      const { data, error } = await supabase
        .from('dashboard_configs')
        .insert({
          dashboard_slug: slug,
          name,
          icon,
          display_order: nextOrder,
          is_deletable: true,
          report_slugs: [],
          org_id: organization.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-dashboards', organization?.id] });
      toast.success('Dashboard created');
    },
    onError: (error) => {
      console.error('Error creating dashboard:', error);
      toast.error('Failed to create dashboard');
    },
  });
}

export function useDeleteDashboard() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (dashboardSlug: string) => {
      const { error } = await supabase
        .from('dashboard_configs')
        .delete()
        .eq('dashboard_slug', dashboardSlug);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-dashboards', organization?.id] });
      toast.success('Dashboard deleted');
    },
    onError: (error) => {
      console.error('Error deleting dashboard:', error);
      toast.error('Failed to delete dashboard');
    },
  });
}

export function useReorderDashboards() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (orderedSlugs: string[]) => {
      const updates = orderedSlugs.map((slug, index) => 
        supabase
          .from('dashboard_configs')
          .update({ display_order: index })
          .eq('dashboard_slug', slug)
      );

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error('Failed to reorder some dashboards');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-dashboards', organization?.id] });
    },
    onError: (error) => {
      console.error('Error reordering dashboards:', error);
      toast.error('Failed to reorder dashboards');
    },
  });
}

export function useDashboardConfig(dashboardSlug: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dashboard-config', dashboardSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboard_configs')
        .select('*')
        .eq('dashboard_slug', dashboardSlug)
        .single();

      if (error) {
        console.error('Error fetching dashboard config:', error);
        return null;
      }

      return data as DashboardConfig;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateDashboardConfig() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async ({ dashboardSlug, reportSlugs }: { dashboardSlug: string; reportSlugs: string[] }) => {
      const { data, error } = await supabase
        .from('dashboard_configs')
        .update({ report_slugs: reportSlugs, updated_at: new Date().toISOString() })
        .eq('dashboard_slug', dashboardSlug)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-config', variables.dashboardSlug] });
      toast.success('Dashboard configuration saved');
    },
    onError: (error) => {
      console.error('Error saving dashboard config:', error);
      toast.error('Failed to save dashboard configuration');
    },
  });
}
