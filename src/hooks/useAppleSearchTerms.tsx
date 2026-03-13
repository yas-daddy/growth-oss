import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SearchTermMetrics {
  search_term_text: string;
  search_term_source: string | null;
  match_type: string | null;
  spend: number;
  impressions: number;
  taps: number;
  installs: number;
  ttr: number;
  cpt: number;
  cpi: number;
  impression_share_low: number | null;
  impression_share_high: number | null;
  impression_rank: number | null;
  search_popularity: number | null;
}

async function fetchSearchTermsByKeyword(
  keywordId: string,
  startDate: string,
  endDate: string
): Promise<SearchTermMetrics[]> {
  const { data, error } = await supabase
    .from('apple_search_terms')
    .select('*')
    .eq('keyword_id', keywordId)
    .gte('date', startDate)
    .lte('date', endDate);

  if (error) throw error;

  // Aggregate by search_term_text
  const aggregated = new Map<string, {
    search_term_text: string;
    search_term_source: string | null;
    match_type: string | null;
    spend: number;
    impressions: number;
    taps: number;
    installs: number;
    impression_share_low: number | null;
    impression_share_high: number | null;
    impression_rank: number | null;
    search_popularity: number | null;
  }>();

  for (const row of data || []) {
    const key = row.search_term_text;
    const existing = aggregated.get(key) || {
      search_term_text: row.search_term_text,
      search_term_source: row.search_term_source,
      match_type: row.match_type,
      spend: 0,
      impressions: 0,
      taps: 0,
      installs: 0,
      impression_share_low: null as number | null,
      impression_share_high: null as number | null,
      impression_rank: null as number | null,
      search_popularity: null as number | null,
    };

    existing.spend += Number(row.spend) || 0;
    existing.impressions += row.impressions || 0;
    existing.taps += row.taps || 0;
    existing.installs += row.installs || 0;
    
    // Keep the most recent impression share data (non-null)
    if (row.impression_share_low !== null) existing.impression_share_low = row.impression_share_low;
    if (row.impression_share_high !== null) existing.impression_share_high = row.impression_share_high;
    if (row.impression_rank !== null) existing.impression_rank = row.impression_rank;
    if (row.search_popularity !== null) existing.search_popularity = row.search_popularity;

    aggregated.set(key, existing);
  }

  // Calculate derived metrics
  const results: SearchTermMetrics[] = Array.from(aggregated.values()).map(st => ({
    ...st,
    ttr: st.impressions > 0 ? (st.taps / st.impressions) * 100 : 0,
    cpt: st.taps > 0 ? st.spend / st.taps : 0,
    cpi: st.installs > 0 ? st.spend / st.installs : 0,
  }));

  return results.sort((a, b) => b.spend - a.spend);
}

export function useAppleSearchTerms(
  keywordId: string | null,
  startDate?: string,
  endDate?: string
) {
  return useQuery({
    queryKey: ['apple-search-terms', keywordId, startDate, endDate],
    queryFn: () => fetchSearchTermsByKeyword(keywordId!, startDate!, endDate!),
    enabled: !!keywordId && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
