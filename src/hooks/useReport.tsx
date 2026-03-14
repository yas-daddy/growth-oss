import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useReportDefinition, ReportConfig } from './useReportDefinitions';

export interface ReportData {
  value: number;
  previousValue: number;
  change?: number;
}

export interface ChartDataPoint {
  channel: string;
  value: number;
  channelType?: string;
  date?: string;
  dailyCpa?: number;
  week_start?: string;
  cpa?: number;
  spend?: number;
  ftds?: number;
}

interface UseReportOptions {
  startDate?: string;
  endDate?: string;
  prevStartDate?: string;
  prevEndDate?: string;
}

// Type for KPI RPC function names
type KpiRpcFunction = 
  | 'get_report_total_spend'
  | 'get_report_ftd_count'
  | 'get_report_blended_cpa'
  | 'get_report_cpa_excl_affiliates'
  | 'get_report_ftd_cohort_deposits'
  | 'get_report_ftd_cohort_deposits_cached'
  | 'get_report_new_users_net_deposits'
  | 'get_report_new_users_net_deposits_cached'
  | 'get_report_avg_net_per_ftd'
  | 'get_report_avg_net_per_ftd_cached'
  | 'get_report_blended_roas'
  | 'get_report_payback_period'
  | 'get_report_total_installs'
  | 'get_report_affiliate_ftds'
  | 'get_report_affiliate_spend'
  | 'get_report_affiliate_count'
  | 'get_report_hvp_count';

// Type for Chart RPC function names
type ChartRpcFunction = 
  | 'get_report_spend_by_channel'
  | 'get_report_ftds_by_channel'
  | 'get_report_cpa_by_channel'
  | 'get_report_daily_spend_by_channel'
  | 'get_report_cpa_per_channel_weekly';

export function useReport(slug: string, options: UseReportOptions) {
  const { user } = useAuth();
  const { data: definition, isLoading: definitionLoading } = useReportDefinition(slug);
  const { startDate, endDate, prevStartDate, prevEndDate } = options;

  const { data, isLoading: dataLoading, error } = useQuery({
    queryKey: ['report-data', slug, startDate, endDate],
    queryFn: async () => {
      if (!definition?.data_source || !startDate || !endDate) {
        return null;
      }

      // Call the RPC function for current period
      // Only the weekly CPA function uses p_ prefixed parameter names
      // All other functions (including cached ones) use non-prefixed names
      const usesPrefixedParams = 
        definition.data_source === 'get_report_cpa_per_channel_weekly' ||
        definition.data_source === 'get_report_avg_deposit_per_ftd_cached';
      const currentParams = usesPrefixedParams
        ? { p_start_date: startDate, p_end_date: endDate }
        : { start_date: startDate, end_date: endDate };

      const { data: currentData, error: currentError } = await (supabase.rpc as any)(
        definition.data_source,
        currentParams
      );

      if (currentError) {
        console.error(`Error calling ${definition.data_source}:`, currentError);
        throw currentError;
      }

      // For chart reports, return the array data directly
      if (definition.report_type === 'chart') {
        // Map snake_case to camelCase for chart data
        const chartResults = currentData as unknown as Array<{ 
          channel: string; 
          value?: number; 
          channel_type?: string; 
          date?: string; 
          report_date?: string; 
          daily_cpa?: number;
          week_start?: string;
          cpa?: number;
          spend?: number;
          ftds?: number;
        }>;
        return chartResults.map(item => ({
          channel: item.channel,
          value: Number(item.value ?? item.cpa ?? 0),
          channelType: item.channel_type,
          date: item.date || item.report_date,
          dailyCpa: item.daily_cpa != null ? Number(item.daily_cpa) : undefined,
          week_start: item.week_start,
          cpa: item.cpa != null ? Number(item.cpa) : undefined,
          spend: item.spend != null ? Number(item.spend) : undefined,
          ftds: item.ftds != null ? Number(item.ftds) : undefined,
        })) as ChartDataPoint[];
      }

      // For KPI reports, calculate with previous period
      let previousValue = 0;

      if (prevStartDate && prevEndDate) {
        const prevParams = usesPrefixedParams
          ? { p_start_date: prevStartDate, p_end_date: prevEndDate }
          : { start_date: prevStartDate, end_date: prevEndDate };

        const { data: prevData, error: prevError } = await (supabase.rpc as any)(
          definition.data_source,
          prevParams
        );

        if (!prevError && prevData && (prevData as any[]).length > 0) {
          previousValue = Number(prevData[0]?.value || 0);
        }
      }

      const value = Number(currentData?.[0]?.value || 0);

      let change: number | undefined;
      if (prevStartDate && prevEndDate) {
        if (previousValue === 0) {
          change = value > 0 ? 100 : 0;
        } else {
          change = ((value - previousValue) / previousValue) * 100;
        }
      }

      return {
        value,
        previousValue,
        change,
      } as ReportData;
    },
    enabled: !!user && !!definition?.data_source && !!startDate && !!endDate,
    staleTime: 30 * 1000,
  });

  return {
    definition,
    data,
    isLoading: definitionLoading || dataLoading,
    error,
  };
}

// Helper to format report values based on config
export function formatReportValue(value: number, format?: ReportConfig['format'] | ReportConfig['valueFormat']): string {
  switch (format) {
    case 'currency':
      return `£${Math.round(value).toLocaleString()}`;
    case 'currency_decimal':
      return `£${value.toFixed(2)}`;
    case 'number':
      return value.toLocaleString();
    case 'multiplier':
      return `${value.toFixed(2)}x`;
    case 'days':
      return `${Math.round(value)} days`;
    case 'percentage':
    case 'percent':
      return `${value.toFixed(2)}%`;
    default:
      return value.toLocaleString();
  }
}
