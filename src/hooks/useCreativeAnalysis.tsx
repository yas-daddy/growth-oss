import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CreativeMetrics {
  ad_name: string;
  ad_id: string | null;
  thumbnail_url: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  reach: number;
  frequency: number;
  ctr: number;
  cpc: number;
  cpm: number;
  registrations: number;
  registrations_cost: number;
  purchases: number;
  purchases_cost: number;
  purchases_value: number;
  add_to_cart: number;
  link_clicks: number;
  landing_page_views: number;
  video_views_25: number;
  video_views_50: number;
  video_views_75: number;
  video_views_100: number;
  video_views_3s: number;
  // Calculated metrics
  cost_per_conversion: number;
  cost_per_registration: number;
  hook_rate: number; // video_views_3s / impressions
  hold_rate: number; // video_views_100 / video_views_3s
}

export interface CreativeAnalysisResult {
  current: CreativeMetrics[];
  previous: Map<string, CreativeMetrics>;
}

async function fetchCreativeMetrics(startDate: string, endDate: string): Promise<CreativeMetrics[]> {
  // Fetch daily spend data in batches to avoid 1000 row limit
  let allData: any[] = [];
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data: batch, error } = await supabase
      .from('daily_meta_ad_spend')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .range(offset, offset + batchSize - 1);

    if (error) throw error;
    if (!batch || batch.length === 0) break;

    allData = [...allData, ...batch];
    if (batch.length < batchSize) break;
    offset += batchSize;
  }

  // Fetch thumbnails and ad_ids from meta_ads - get the most recent per ad_name
  const { data: adsData } = await supabase
    .from('meta_ads')
    .select('ad_name, ad_id, thumbnail_url')
    .not('thumbnail_url', 'is', null);

  // Create maps of ad_name to thumbnail_url and ad_id
  const thumbnailMap = new Map<string, string>();
  const adIdMap = new Map<string, string>();
  for (const ad of adsData || []) {
    if (!thumbnailMap.has(ad.ad_name)) {
      if (ad.thumbnail_url) thumbnailMap.set(ad.ad_name, ad.thumbnail_url);
      if (ad.ad_id) adIdMap.set(ad.ad_name, ad.ad_id);
    }
  }

  // Aggregate by ad_name
  const aggregated = new Map<string, CreativeMetrics>();

  for (const row of allData) {
    const existing = aggregated.get(row.ad_name) || {
      ad_name: row.ad_name,
      ad_id: adIdMap.get(row.ad_name) || null,
      thumbnail_url: thumbnailMap.get(row.ad_name) || null,
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      reach: 0,
      frequency: 0,
      ctr: 0,
      cpc: 0,
      cpm: 0,
      registrations: 0,
      registrations_cost: 0,
      purchases: 0,
      purchases_cost: 0,
      purchases_value: 0,
      add_to_cart: 0,
      link_clicks: 0,
      landing_page_views: 0,
      video_views_25: 0,
      video_views_50: 0,
      video_views_75: 0,
      video_views_100: 0,
      video_views_3s: 0,
      cost_per_conversion: 0,
      cost_per_registration: 0,
      hook_rate: 0,
      hold_rate: 0,
    };

    existing.spend += Number(row.spend) || 0;
    existing.impressions += Number(row.impressions) || 0;
    existing.clicks += Number(row.clicks) || 0;
    existing.conversions += Number(row.conversions) || 0;
    existing.reach += Number(row.reach) || 0;
    existing.registrations += Number(row.registrations) || 0;
    existing.purchases += Number(row.purchases) || 0;
    existing.purchases_value += Number(row.purchases_value) || 0;
    existing.add_to_cart += Number(row.add_to_cart) || 0;
    existing.link_clicks += Number(row.link_clicks) || 0;
    existing.landing_page_views += Number(row.landing_page_views) || 0;
    existing.video_views_25 += Number(row.video_views_25) || 0;
    existing.video_views_50 += Number(row.video_views_50) || 0;
    existing.video_views_75 += Number(row.video_views_75) || 0;
    existing.video_views_100 += Number(row.video_views_100) || 0;
    existing.video_views_3s += Number(row.video_views_3s) || 0;

    aggregated.set(row.ad_name, existing);
  }

  // Calculate derived metrics
  const result: CreativeMetrics[] = [];
  for (const [, metrics] of aggregated) {
    // CTR = clicks / impressions * 100
    metrics.ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
    
    // CPC = spend / clicks
    metrics.cpc = metrics.clicks > 0 ? metrics.spend / metrics.clicks : 0;
    
    // CPM = spend / impressions * 1000
    metrics.cpm = metrics.impressions > 0 ? (metrics.spend / metrics.impressions) * 1000 : 0;
    
    // Frequency = impressions / reach (approximate)
    metrics.frequency = metrics.reach > 0 ? metrics.impressions / metrics.reach : 0;
    
    // Cost per conversion (install)
    metrics.cost_per_conversion = metrics.conversions > 0 ? metrics.spend / metrics.conversions : 0;
    
    // Cost per registration
    metrics.cost_per_registration = metrics.registrations > 0 ? metrics.spend / metrics.registrations : 0;
    metrics.registrations_cost = metrics.cost_per_registration;
    
    // Cost per purchase
    metrics.purchases_cost = metrics.purchases > 0 ? metrics.spend / metrics.purchases : 0;
    
    // Hook rate = 3s video views / impressions * 100
    metrics.hook_rate = metrics.impressions > 0 ? (metrics.video_views_3s / metrics.impressions) * 100 : 0;
    
    // Hold rate = 100% video views / 3s video views * 100
    metrics.hold_rate = metrics.video_views_3s > 0 ? (metrics.video_views_100 / metrics.video_views_3s) * 100 : 0;

    result.push(metrics);
  }

  // Sort by spend descending by default
  result.sort((a, b) => b.spend - a.spend);

  return result;
}

export function useCreativeAnalysis(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['creative-analysis', startDate, endDate],
    queryFn: async (): Promise<CreativeAnalysisResult> => {
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
        fetchCreativeMetrics(startDate, endDate),
        fetchCreativeMetrics(prevStartStr, prevEndStr),
      ]);

      // Build a map for quick lookup of previous period data
      const previous = new Map<string, CreativeMetrics>();
      for (const m of previousList) {
        previous.set(m.ad_name, m);
      }

      return { current, previous };
    },
    enabled: !!startDate && !!endDate,
  });
}

// Column definitions for the table
export interface ColumnDef {
  key: keyof CreativeMetrics;
  label: string;
  format: 'currency' | 'number' | 'percentage' | 'decimal';
  defaultVisible: boolean;
  category: 'core' | 'efficiency' | 'conversions' | 'engagement' | 'video';
}

// Cost metrics that should have inverted colors (lower is better)
export const COST_METRICS: Set<keyof CreativeMetrics> = new Set([
  'cpc',
  'cpm',
  'cost_per_conversion',
  'cost_per_registration',
  'registrations_cost',
  'purchases_cost',
]);

export const COLUMN_DEFINITIONS: ColumnDef[] = [
  // Core metrics
  { key: 'ad_name', label: 'Ad Name', format: 'number', defaultVisible: true, category: 'core' },
  { key: 'spend', label: 'Spend', format: 'currency', defaultVisible: true, category: 'core' },
  { key: 'impressions', label: 'Impressions', format: 'number', defaultVisible: true, category: 'core' },
  { key: 'clicks', label: 'Clicks', format: 'number', defaultVisible: true, category: 'core' },
  { key: 'reach', label: 'Reach', format: 'number', defaultVisible: false, category: 'core' },
  
  // Efficiency metrics
  { key: 'ctr', label: 'CTR', format: 'percentage', defaultVisible: true, category: 'efficiency' },
  { key: 'cpc', label: 'CPC', format: 'currency', defaultVisible: true, category: 'efficiency' },
  { key: 'cpm', label: 'CPM', format: 'currency', defaultVisible: false, category: 'efficiency' },
  { key: 'frequency', label: 'Frequency', format: 'decimal', defaultVisible: false, category: 'efficiency' },
  
  // Conversion metrics
  { key: 'conversions', label: 'App Installs', format: 'number', defaultVisible: true, category: 'conversions' },
  { key: 'cost_per_conversion', label: 'Cost/Install', format: 'currency', defaultVisible: true, category: 'conversions' },
  { key: 'registrations', label: 'Registrations', format: 'number', defaultVisible: true, category: 'conversions' },
  { key: 'registrations_cost', label: 'Cost/Registration', format: 'currency', defaultVisible: true, category: 'conversions' },
  { key: 'purchases', label: 'Purchases', format: 'number', defaultVisible: false, category: 'conversions' },
  { key: 'purchases_cost', label: 'Cost/Purchase', format: 'currency', defaultVisible: false, category: 'conversions' },
  { key: 'purchases_value', label: 'Purchase Value', format: 'currency', defaultVisible: false, category: 'conversions' },
  
  // Engagement metrics
  { key: 'link_clicks', label: 'Link Clicks', format: 'number', defaultVisible: false, category: 'engagement' },
  { key: 'landing_page_views', label: 'Landing Page Views', format: 'number', defaultVisible: false, category: 'engagement' },
  { key: 'add_to_cart', label: 'Add to Cart', format: 'number', defaultVisible: false, category: 'engagement' },
  
  // Video metrics
  { key: 'video_views_3s', label: 'ThruPlays (3s)', format: 'number', defaultVisible: false, category: 'video' },
  { key: 'video_views_25', label: 'Video 25%', format: 'number', defaultVisible: false, category: 'video' },
  { key: 'video_views_50', label: 'Video 50%', format: 'number', defaultVisible: false, category: 'video' },
  { key: 'video_views_75', label: 'Video 75%', format: 'number', defaultVisible: false, category: 'video' },
  { key: 'video_views_100', label: 'Video 100%', format: 'number', defaultVisible: false, category: 'video' },
  { key: 'hook_rate', label: 'Hook Rate', format: 'percentage', defaultVisible: false, category: 'video' },
  { key: 'hold_rate', label: 'Hold Rate', format: 'percentage', defaultVisible: false, category: 'video' },
];
