import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AppleKeyword {
  id: string;
  user_id: string;
  keyword_id: string;
  keyword_text: string;
  match_type: string | null;
  status: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  adgroup_id: string | null;
  adgroup_name: string | null;
  bid_amount: number;
  impressions: number;
  taps: number;
  installs: number;
  spend: number;
  avg_cpa: number | null;
  avg_cpt: number | null;
  ttr: number | null;
  synced_at: string;
}

export interface KeywordMetrics {
  keyword_text: string;
  keyword_id: string;
  match_type: string;
  campaign_name: string;
  adgroup_name: string;
  bid_amount: number;
  spend: number;
  impressions: number;
  taps: number;
  installs: number;
  ttr: number;
  cpt: number;
  cpi: number;
  // AppsFlyer attributed metrics
  af_installs: number;
  ftds: number;
  bets_placed: number;
  cpa_ftd: number;
  cpa_bet: number;
  // Impression share metrics
  impression_share_low: number | null;
  impression_share_high: number | null;
  impression_rank: number | null;
  search_popularity: number | null;
}

export interface KeywordColumnDef {
  key: keyof KeywordMetrics;
  label: string;
  format: 'string' | 'currency' | 'number' | 'percentage' | 'decimal';
  defaultVisible: boolean;
  category: 'core' | 'efficiency' | 'engagement' | 'conversions';
}

export const KEYWORD_COLUMN_DEFINITIONS: KeywordColumnDef[] = [
  { key: 'keyword_text', label: 'Keyword', format: 'string', defaultVisible: true, category: 'core' },
  { key: 'match_type', label: 'Match Type', format: 'string', defaultVisible: true, category: 'core' },
  { key: 'bid_amount', label: 'Max CPT Bid', format: 'currency', defaultVisible: true, category: 'core' },
  { key: 'campaign_name', label: 'Campaign', format: 'string', defaultVisible: false, category: 'core' },
  { key: 'adgroup_name', label: 'Ad Group', format: 'string', defaultVisible: false, category: 'core' },
  { key: 'spend', label: 'Spend', format: 'currency', defaultVisible: true, category: 'core' },
  { key: 'impressions', label: 'Impressions', format: 'number', defaultVisible: true, category: 'core' },
  { key: 'taps', label: 'Taps', format: 'number', defaultVisible: true, category: 'core' },
  { key: 'installs', label: 'Installs (Apple)', format: 'number', defaultVisible: true, category: 'core' },
  { key: 'af_installs', label: 'Installs (AF)', format: 'number', defaultVisible: true, category: 'conversions' },
  { key: 'ftds', label: 'FTDs', format: 'number', defaultVisible: true, category: 'conversions' },
  { key: 'bets_placed', label: 'Bets Placed', format: 'number', defaultVisible: true, category: 'conversions' },
  { key: 'ttr', label: 'TTR', format: 'percentage', defaultVisible: true, category: 'engagement' },
  { key: 'impression_share_low', label: 'Imp. Share', format: 'string', defaultVisible: false, category: 'engagement' },
  { key: 'impression_rank', label: 'Rank', format: 'number', defaultVisible: false, category: 'engagement' },
  { key: 'search_popularity', label: 'Popularity', format: 'number', defaultVisible: false, category: 'engagement' },
  { key: 'cpt', label: 'CPT', format: 'currency', defaultVisible: true, category: 'efficiency' },
  { key: 'cpi', label: 'CPI', format: 'currency', defaultVisible: true, category: 'efficiency' },
  { key: 'cpa_ftd', label: 'CPA (FTD)', format: 'currency', defaultVisible: true, category: 'efficiency' },
  { key: 'cpa_bet', label: 'CPA (Bet)', format: 'currency', defaultVisible: false, category: 'efficiency' },
];

export interface KeywordAnalysisResult {
  current: KeywordMetrics[];
  previous: Map<string, KeywordMetrics>;
}

// Cost metrics that should have inverted colors (lower is better)
export const KEYWORD_COST_METRICS = new Set<keyof KeywordMetrics>([
  'spend', 'cpt', 'cpi', 'cpa_ftd', 'cpa_bet', 'bid_amount'
]);

async function fetchKeywordMetrics(startDate: string, endDate: string): Promise<KeywordMetrics[]> {
  // Fetch daily keyword spend in batches to avoid 1000 row limit
  let dailyData: any[] = [];
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data: batch, error } = await supabase
      .from('daily_apple_keyword_spend')
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

  // Fetch AppsFlyer keyword events for the same date range
  const { data: afEvents, error: afError } = await supabase
    .from('appsflyer_keyword_events')
    .select('*')
    .gte('event_date', startDate)
    .lte('event_date', endDate);
  
  if (afError) {
    console.error('Error fetching AppsFlyer keyword events:', afError);
  }

  // Aggregate AppsFlyer events by keyword_id
  const afEventsByKeyword = new Map<string, { installs: number; ftds: number; bets: number }>();
  for (const event of afEvents || []) {
    const existing = afEventsByKeyword.get(event.keyword_id) || { installs: 0, ftds: 0, bets: 0 };
    
    if (event.event_name === 'install') {
      existing.installs += event.event_count || 0;
    } else if (event.event_name === 'first_time_deposit') {
      existing.ftds += event.event_count || 0;
    } else if (event.event_name === 'bet_placed') {
      existing.bets += event.event_count || 0;
    }
    
    afEventsByKeyword.set(event.keyword_id, existing);
  }

  // Aggregate by keyword
  const keywordMap = new Map<string, KeywordMetrics>();

  for (const row of dailyData || []) {
    const existing = keywordMap.get(row.keyword_id) || {
      keyword_text: row.keyword_text,
      keyword_id: row.keyword_id,
      match_type: row.match_type || 'UNKNOWN',
      campaign_name: row.campaign_name || '',
      adgroup_name: '',
      bid_amount: 0,
      spend: 0,
      impressions: 0,
      taps: 0,
      installs: 0,
      ttr: 0,
      cpt: 0,
      cpi: 0,
      af_installs: 0,
      ftds: 0,
      bets_placed: 0,
      cpa_ftd: 0,
      cpa_bet: 0,
      impression_share_low: null as number | null,
      impression_share_high: null as number | null,
      impression_rank: null as number | null,
      search_popularity: null as number | null,
    };

    existing.spend += Number(row.spend) || 0;
    existing.impressions += row.impressions || 0;
    existing.taps += row.taps || 0;
    existing.installs += row.installs || 0;

    keywordMap.set(row.keyword_id, existing);
  }

  // Fetch keyword metadata for additional fields including impression share
  // Order by synced_at desc to get most recent data when duplicates exist
  const { data: keywordMeta } = await supabase
    .from('apple_keywords')
    .select('keyword_id, adgroup_name, bid_amount, impression_share_low, impression_share_high, impression_rank, search_popularity, synced_at')
    .order('synced_at', { ascending: false });

  // Build map keeping only the most recent entry per keyword_id (first one due to desc order)
  const metaMap = new Map<string, typeof keywordMeta[0]>();
  for (const k of keywordMeta || []) {
    if (!metaMap.has(k.keyword_id)) {
      metaMap.set(k.keyword_id, k);
    }
  }

  // Calculate derived metrics and merge AppsFlyer data
  const results: KeywordMetrics[] = Array.from(keywordMap.values()).map(kw => {
    const meta = metaMap.get(kw.keyword_id);
    const afData = afEventsByKeyword.get(kw.keyword_id) || { installs: 0, ftds: 0, bets: 0 };
    
    return {
      ...kw,
      adgroup_name: meta?.adgroup_name || '',
      bid_amount: Number(meta?.bid_amount) || 0,
      ttr: kw.impressions > 0 ? (kw.taps / kw.impressions) * 100 : 0,
      cpt: kw.taps > 0 ? kw.spend / kw.taps : 0,
      cpi: kw.installs > 0 ? kw.spend / kw.installs : 0,
      af_installs: afData.installs,
      ftds: afData.ftds,
      bets_placed: afData.bets,
      cpa_ftd: afData.ftds > 0 ? kw.spend / afData.ftds : 0,
      cpa_bet: afData.bets > 0 ? kw.spend / afData.bets : 0,
      impression_share_low: meta?.impression_share_low ?? null,
      impression_share_high: meta?.impression_share_high ?? null,
      impression_rank: meta?.impression_rank ?? null,
      search_popularity: meta?.search_popularity ?? null,
    };
  });

  return results.sort((a, b) => b.spend - a.spend);
}

export function useAppleKeywordAnalysis(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['apple-keyword-analysis', startDate, endDate],
    queryFn: async (): Promise<KeywordAnalysisResult> => {
      // Calculate previous period dates (same duration, immediately before)
      const start = new Date(startDate!);
      const end = new Date(endDate!);
      const duration = end.getTime() - start.getTime();
      const prevEnd = new Date(start.getTime() - 1); // day before start
      const prevStart = new Date(prevEnd.getTime() - duration);
      
      const prevStartStr = prevStart.toISOString().split('T')[0];
      const prevEndStr = prevEnd.toISOString().split('T')[0];
      
      // Fetch both periods in parallel
      const [current, previous] = await Promise.all([
        fetchKeywordMetrics(startDate!, endDate!),
        fetchKeywordMetrics(prevStartStr, prevEndStr),
      ]);
      
      // Build previous period map keyed by keyword_id
      const previousMap = new Map<string, KeywordMetrics>();
      previous.forEach(kw => previousMap.set(kw.keyword_id, kw));
      
      return { current, previous: previousMap };
    },
    enabled: !!startDate && !!endDate,
  });
}

export function useAppleKeywords() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const keywordsQuery = useQuery({
    queryKey: ['apple-keywords'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('apple_keywords')
        .select('*')
        .order('spend', { ascending: false });

      if (error) throw error;
      return data as AppleKeyword[];
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('apple-sync-keywords', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['apple-keywords'] });
      queryClient.invalidateQueries({ queryKey: ['apple-keyword-analysis'] });
      toast({
        title: 'Keywords synced',
        description: `Synced ${data.totalKeywords} keywords, £${data.totalSpend?.toFixed(2) || '0'} spend`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Sync failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const syncAppsFlyerMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('appsflyer-keyword-sync', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['apple-keyword-analysis'] });
      toast({
        title: 'AppsFlyer keyword data synced',
        description: `Synced ${data.totalRecords} records: ${data.installs} installs, ${data.ftds} FTDs, ${data.betsPlaced} bets`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'AppsFlyer sync failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const keywords = keywordsQuery.data || [];
  const totalSpend = keywords.reduce((sum, k) => sum + k.spend, 0);
  const totalInstalls = keywords.reduce((sum, k) => sum + k.installs, 0);
  const lastSynced = keywords.length > 0
    ? new Date(Math.max(...keywords.map(k => new Date(k.synced_at).getTime())))
    : null;

  return {
    keywords,
    isLoading: keywordsQuery.isLoading,
    isError: keywordsQuery.isError,
    error: keywordsQuery.error,
    syncKeywords: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
    syncAppsFlyerKeywords: syncAppsFlyerMutation.mutate,
    isSyncingAppsFlyer: syncAppsFlyerMutation.isPending,
    isConnected: keywords.length > 0,
    totalSpend,
    totalInstalls,
    lastSynced,
  };
}
