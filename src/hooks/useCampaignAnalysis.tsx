import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CampaignMetrics {
  campaign_name: string;
  media_source: string;
  spend: number;
  installs: number;
  signups: number;
  ftds: number;
  cpa: number;
  revenue: number;
  revenue_per_ftd: number;
  avg_net_per_ftd: number;
}

export interface KPIData {
  totalSpend: number;
  totalFtds: number;
  cpa: number;
  spendChange?: number;
  ftdsChange?: number;
  cpaChange?: number;
}

export interface CampaignAnalysisResult {
  current: CampaignMetrics[];
  previous: Map<string, CampaignMetrics>;
  kpiData: KPIData;
}

function campaignKey(row: CampaignMetrics): string {
  return `${row.campaign_name}|||${row.media_source}`;
}

async function fetchCampaignMetrics(startDate: string, endDate: string): Promise<CampaignMetrics[]> {
  const { data, error } = await (supabase.rpc as any)('get_report_campaign_performance', {
    start_date: startDate,
    end_date: endDate,
  });

  if (error) throw error;

  return (data || []).map((row: any) => ({
    campaign_name: row.campaign_name,
    media_source: row.media_source,
    spend: Number(row.spend) || 0,
    installs: Number(row.installs) || 0,
    signups: Number(row.signups) || 0,
    ftds: Number(row.ftds) || 0,
    cpa: Number(row.cpa) || 0,
    revenue: Number(row.revenue) || 0,
    revenue_per_ftd: Number(row.revenue_per_ftd) || 0,
    avg_net_per_ftd: Number(row.avg_net_per_ftd) || 0,
  }));
}

export function useCampaignAnalysis(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['campaign-analysis', startDate, endDate],
    queryFn: async (): Promise<CampaignAnalysisResult> => {
      if (!startDate || !endDate) {
        return { current: [], previous: new Map(), kpiData: { totalSpend: 0, totalFtds: 0, cpa: 0 } };
      }

      // Calculate previous period
      const start = new Date(startDate);
      const end = new Date(endDate);
      const durationMs = end.getTime() - start.getTime();
      const prevEnd = new Date(start.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - durationMs);

      const prevStartStr = prevStart.toISOString().split('T')[0];
      const prevEndStr = prevEnd.toISOString().split('T')[0];

      const [current, previousList, ftdCurrent, ftdPrev, spendCurrent, spendPrev] = await Promise.all([
        fetchCampaignMetrics(startDate, endDate),
        fetchCampaignMetrics(prevStartStr, prevEndStr),
        (supabase.rpc as any)('get_report_ftd_count', { start_date: startDate, end_date: endDate }),
        (supabase.rpc as any)('get_report_ftd_count', { start_date: prevStartStr, end_date: prevEndStr }),
        (supabase.rpc as any)('get_report_total_spend', { start_date: startDate, end_date: endDate }),
        (supabase.rpc as any)('get_report_total_spend', { start_date: prevStartStr, end_date: prevEndStr }),
      ]);

      const previous = new Map<string, CampaignMetrics>();
      for (const m of previousList) {
        previous.set(campaignKey(m), m);
      }

      const totalFtds = Number(ftdCurrent.data?.[0]?.value) || 0;
      const prevFtds = Number(ftdPrev.data?.[0]?.value) || 0;
      const totalSpend = Number(spendCurrent.data?.[0]?.value) || 0;
      const prevSpend = Number(spendPrev.data?.[0]?.value) || 0;
      const cpa = totalFtds > 0 ? totalSpend / totalFtds : 0;
      const prevCpa = prevFtds > 0 ? prevSpend / prevFtds : 0;

      const kpiData: KPIData = {
        totalSpend,
        totalFtds,
        cpa,
        spendChange: prevSpend > 0 ? ((totalSpend - prevSpend) / prevSpend) * 100 : undefined,
        ftdsChange: prevFtds > 0 ? ((totalFtds - prevFtds) / prevFtds) * 100 : undefined,
        cpaChange: prevCpa > 0 ? ((cpa - prevCpa) / prevCpa) * 100 : undefined,
      };

      return { current, previous, kpiData };
    },
    enabled: !!startDate && !!endDate,
  });
}

// Column definitions
export interface CampaignColumnDef {
  key: keyof CampaignMetrics;
  label: string;
  format: 'currency' | 'number' | 'percentage' | 'decimal' | 'text';
  defaultVisible: boolean;
  category: 'core' | 'conversions' | 'revenue';
}

export const CAMPAIGN_COST_METRICS: Set<keyof CampaignMetrics> = new Set([
  'cpa',
]);

export const CAMPAIGN_COLUMN_DEFINITIONS: CampaignColumnDef[] = [
  // Core
  { key: 'campaign_name', label: 'Campaign', format: 'text', defaultVisible: true, category: 'core' },
  { key: 'media_source', label: 'Media Source', format: 'text', defaultVisible: true, category: 'core' },
  { key: 'spend', label: 'Spend', format: 'currency', defaultVisible: true, category: 'core' },
  { key: 'installs', label: 'Installs', format: 'number', defaultVisible: true, category: 'core' },
  // Conversions
  { key: 'signups', label: 'Signups', format: 'number', defaultVisible: true, category: 'conversions' },
  { key: 'ftds', label: 'FTDs', format: 'number', defaultVisible: true, category: 'conversions' },
  { key: 'cpa', label: 'CPA', format: 'currency', defaultVisible: true, category: 'conversions' },
  // Revenue
  { key: 'revenue', label: 'Revenue', format: 'currency', defaultVisible: true, category: 'revenue' },
  { key: 'revenue_per_ftd', label: 'Revenue/FTD', format: 'currency', defaultVisible: true, category: 'revenue' },
  { key: 'avg_net_per_ftd', label: 'Avg Net/FTD', format: 'currency', defaultVisible: false, category: 'revenue' },
];

export function getCampaignKey(row: CampaignMetrics): string {
  return campaignKey(row);
}
