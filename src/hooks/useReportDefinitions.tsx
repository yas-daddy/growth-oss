import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ReportConfig {
  variant?: 'primary' | 'accent' | 'default';
  icon?: string;
  format?: 'currency' | 'currency_decimal' | 'number' | 'multiplier' | 'days' | 'percentage' | 'percent' | 'rating';
  invertColors?: boolean;
  subtitle?: string;
  // Chart-specific config
  chartType?: 'pie' | 'bar' | 'stacked_bar' | 'line_multi';
  valueFormat?: 'currency' | 'currency_decimal' | 'number';
  showPercentage?: boolean;
  // Multi-line chart config
  xAxisKey?: string;
  yAxisKey?: string;
  seriesKey?: string;
  // Table-specific config
  columns?: Array<{
    key: string;
    header: string;
    type: 'text' | 'currency' | 'currency_decimal' | 'number' | 'percentage' | 'badge' | 'progress' | 'qualityBadge';
    badgeColors?: Record<string, { bg: string; text: string }>;
    badgeLabels?: Record<string, string>;
  }>;
}

export interface ReportDefinition {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  report_type: 'kpi' | 'chart' | 'table';
  config: ReportConfig;
  data_source: string;
  created_at: string;
  updated_at: string;
}

export function useReportDefinitions(category?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['report-definitions', category],
    queryFn: async () => {
      let query = supabase
        .from('report_definitions')
        .select('*')
        .order('created_at', { ascending: true });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching report definitions:', error);
        throw error;
      }

      return data as ReportDefinition[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

export function useReportDefinition(slug: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['report-definition', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_definitions')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) {
        console.error('Error fetching report definition:', error);
        throw error;
      }

      return data as ReportDefinition;
    },
    enabled: !!user && !!slug,
    staleTime: 30 * 1000, // Reduced cache time
  });
}
