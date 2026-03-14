import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from './useOrganization';
import { DEFAULT_TRACKER_METRICS, TrackerMetricDefinition } from '@/lib/trackerMetricDefinitions';

export interface TrackerMetricConfig {
  id: string;
  org_id: string;
  metric_key: string;
  metric_label: string;
  display_order: number;
  is_visible: boolean;
  data_source: string | null;
  created_at: string;
  updated_at: string;
}

export function useTrackerMetricConfig() {
  const { organization } = useOrganization();

  return useQuery({
    queryKey: ['tracker-metric-config', organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tracker_metric_config')
        .select('*')
        .eq('org_id', organization!.id)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as TrackerMetricConfig[];
    },
    enabled: !!organization,
  });
}

/**
 * Returns the merged list of metric definitions:
 * - If org has config rows, use those (respecting is_visible and display_order)
 * - Otherwise, fall back to the full default list
 */
export function useResolvedTrackerMetrics() {
  const { data: config, isLoading } = useTrackerMetricConfig();

  const metrics: TrackerMetricDefinition[] = (() => {
    if (!config || config.length === 0) {
      // No org config yet — use all defaults
      return DEFAULT_TRACKER_METRICS;
    }

    // Build lookup from defaults
    const defaultsByKey = new Map(DEFAULT_TRACKER_METRICS.map(d => [d.key, d]));

    // Return only visible configs, merged with default definitions
    return config
      .filter(c => c.is_visible)
      .map(c => {
        const def = defaultsByKey.get(c.metric_key);
        if (!def) return null;
        return {
          ...def,
          label: c.metric_label || def.label,
          displayOrder: c.display_order,
        };
      })
      .filter(Boolean) as TrackerMetricDefinition[];
  })();

  return { metrics, isLoading };
}

export function useSeedTrackerMetricConfig() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async () => {
      if (!organization) throw new Error('No organization');

      const rows = DEFAULT_TRACKER_METRICS.map((m, idx) => ({
        org_id: organization.id,
        metric_key: m.key,
        metric_label: m.label,
        display_order: idx,
        is_visible: true,
      }));

      const { error } = await supabase
        .from('tracker_metric_config')
        .upsert(rows as any, { onConflict: 'org_id,metric_key' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracker-metric-config', organization?.id] });
    },
  });
}

export function useUpdateTrackerMetricVisibility() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (params: { metricKey: string; isVisible: boolean }) => {
      if (!organization) throw new Error('No organization');

      const { error } = await supabase
        .from('tracker_metric_config')
        .update({ is_visible: params.isVisible, updated_at: new Date().toISOString() })
        .eq('org_id', organization.id)
        .eq('metric_key', params.metricKey);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracker-metric-config', organization?.id] });
    },
  });
}
