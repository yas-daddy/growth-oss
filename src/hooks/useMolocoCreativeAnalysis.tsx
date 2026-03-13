import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MolocoCreativeMetrics {
  creative_name: string;
  thumbnail_url: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  installs: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpi: number;
}

export interface MolocoCreativeAnalysisResult {
  current: MolocoCreativeMetrics[];
  previous: Map<string, MolocoCreativeMetrics>;
}

export interface MolocoColumnDef {
  key: keyof MolocoCreativeMetrics;
  label: string;
  format: 'currency' | 'number' | 'percentage' | 'decimal' | 'text';
  defaultVisible: boolean;
  category: 'core' | 'efficiency' | 'conversions';
}

// Cost metrics that should have inverted colors (lower is better)
export const MOLOCO_COST_METRICS: Set<keyof MolocoCreativeMetrics> = new Set([
  'cpc',
  'cpm',
  'cpi',
]);

export const MOLOCO_COLUMN_DEFINITIONS: MolocoColumnDef[] = [
  { key: 'creative_name', label: 'Creative Name', format: 'text', defaultVisible: true, category: 'core' },
  { key: 'spend', label: 'Spend', format: 'currency', defaultVisible: true, category: 'core' },
  { key: 'impressions', label: 'Impressions', format: 'number', defaultVisible: true, category: 'core' },
  { key: 'clicks', label: 'Clicks', format: 'number', defaultVisible: true, category: 'core' },
  { key: 'installs', label: 'Installs', format: 'number', defaultVisible: true, category: 'conversions' },
  { key: 'revenue', label: 'Revenue', format: 'currency', defaultVisible: false, category: 'core' },
  { key: 'ctr', label: 'CTR', format: 'percentage', defaultVisible: true, category: 'efficiency' },
  { key: 'cpc', label: 'CPC', format: 'currency', defaultVisible: true, category: 'efficiency' },
  { key: 'cpm', label: 'CPM', format: 'currency', defaultVisible: false, category: 'efficiency' },
  { key: 'cpi', label: 'CPI', format: 'currency', defaultVisible: true, category: 'efficiency' },
];

async function fetchMolocoCreativeMetrics(startDate: string, endDate: string): Promise<MolocoCreativeMetrics[]> {
  // Get daily creative spend in batches to avoid 1000 row limit
  let dailyData: any[] = [];
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data: batch, error } = await supabase
      .from('daily_moloco_creative_spend')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .range(offset, offset + batchSize - 1);

    if (error) throw error;
    if (!batch || batch.length === 0) break;

    dailyData = [...dailyData, ...batch];
    if (batch.length < batchSize) break;
    offset += batchSize;
  }

  // Get creative metadata for thumbnails
  const { data: creativeData, error: creativeError } = await supabase
    .from('moloco_creatives')
    .select('creative_name, main_asset_url');

  if (creativeError) throw creativeError;

  // Map creative_name to thumbnail
  const thumbnailMap = new Map<string, string | null>();
  for (const c of creativeData || []) {
    if (!thumbnailMap.has(c.creative_name) && c.main_asset_url) {
      thumbnailMap.set(c.creative_name, c.main_asset_url);
    }
  }

  // Aggregate by creative_name
  const aggregated = new Map<string, {
    spend: number;
    impressions: number;
    clicks: number;
    installs: number;
    revenue: number;
  }>();

  for (const row of dailyData || []) {
    const existing = aggregated.get(row.creative_name) || {
      spend: 0,
      impressions: 0,
      clicks: 0,
      installs: 0,
      revenue: 0,
    };

    existing.spend += Number(row.spend) || 0;
    existing.impressions += Number(row.impressions) || 0;
    existing.clicks += Number(row.clicks) || 0;
    existing.installs += Number(row.installs) || 0;
    existing.revenue += Number(row.revenue) || 0;

    aggregated.set(row.creative_name, existing);
  }

  // Build final metrics
  const result: MolocoCreativeMetrics[] = [];
  for (const [creative_name, data] of aggregated) {
    const ctr = data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0;
    const cpc = data.clicks > 0 ? data.spend / data.clicks : 0;
    const cpm = data.impressions > 0 ? (data.spend / data.impressions) * 1000 : 0;
    const cpi = data.installs > 0 ? data.spend / data.installs : 0;

    result.push({
      creative_name,
      thumbnail_url: thumbnailMap.get(creative_name) || null,
      spend: data.spend,
      impressions: data.impressions,
      clicks: data.clicks,
      installs: data.installs,
      revenue: data.revenue,
      ctr,
      cpc,
      cpm,
      cpi,
    });
  }

  // Sort by spend descending
  result.sort((a, b) => b.spend - a.spend);

  return result;
}

export function useMolocoCreativeAnalysis(
  startDate?: string,
  endDate?: string
) {
  return useQuery({
    queryKey: ['moloco-creative-analysis', startDate, endDate],
    queryFn: async (): Promise<MolocoCreativeAnalysisResult> => {
      if (!startDate || !endDate) {
        return { current: [], previous: new Map() };
      }

      // Calculate previous period dates (same duration as current period)
      const start = new Date(startDate);
      const end = new Date(endDate);
      const durationMs = end.getTime() - start.getTime();
      const prevEnd = new Date(start.getTime() - 1); // Day before start
      const prevStart = new Date(prevEnd.getTime() - durationMs);
      
      const prevStartStr = prevStart.toISOString().split('T')[0];
      const prevEndStr = prevEnd.toISOString().split('T')[0];

      // Fetch both periods in parallel
      const [current, previousList] = await Promise.all([
        fetchMolocoCreativeMetrics(startDate, endDate),
        fetchMolocoCreativeMetrics(prevStartStr, prevEndStr),
      ]);

      // Build a map for quick lookup of previous period data
      const previous = new Map<string, MolocoCreativeMetrics>();
      for (const m of previousList) {
        previous.set(m.creative_name, m);
      }

      return { current, previous };
    },
    enabled: !!startDate && !!endDate,
  });
}
