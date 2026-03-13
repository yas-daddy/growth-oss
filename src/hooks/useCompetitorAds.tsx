import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface CompetitorAd {
  id: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_snapshot_url?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  page_name?: string;
  page_id?: string;
  publisher_platforms?: string[];
  eu_total_reach?: number;
  languages?: string[];
}

export interface SavedCompetitorAd {
  id: string;
  user_id: string;
  ad_archive_id: string;
  page_name: string | null;
  page_id: string | null;
  ad_creative_body: string | null;
  ad_snapshot_url: string | null;
  ad_delivery_start_time: string | null;
  eu_total_reach: number | null;
  publisher_platforms: string[] | null;
  media_type: string | null;
  saved_at: string;
  notes: string | null;
}

interface SearchParams {
  search_terms: string;
  media_type?: string;
  ad_active_status?: string;
}

export function useCompetitorAdSearch() {
  const [ads, setAds] = useState<CompetitorAd[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [searchParams, setSearchParams] = useState<SearchParams | null>(null);

  const search = useCallback(async (params: SearchParams) => {
    setLoading(true);
    setError(null);
    setSearchParams(params);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('meta-ad-library-search', {
        body: params,
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      setAds(data.ads || []);
      setNextCursor(data.next_cursor);
      setHasMore(data.has_more);
    } catch (err: any) {
      setError(err.message || 'Search failed');
      setAds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!searchParams || !nextCursor || loading) return;

    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('meta-ad-library-search', {
        body: { ...searchParams, after: nextCursor },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      setAds(prev => [...prev, ...(data.ads || [])]);
      setNextCursor(data.next_cursor);
      setHasMore(data.has_more);
    } catch (err: any) {
      setError(err.message || 'Failed to load more');
    } finally {
      setLoading(false);
    }
  }, [searchParams, nextCursor, loading]);

  const reset = useCallback(() => {
    setAds([]);
    setError(null);
    setNextCursor(null);
    setHasMore(false);
    setSearchParams(null);
  }, []);

  return { ads, loading, error, hasMore, search, loadMore, reset };
}

export function useSavedCompetitorAds() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const savedAdsQuery = useQuery({
    queryKey: ['saved-competitor-ads', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_competitor_ads')
        .select('*')
        .order('saved_at', { ascending: false });
      if (error) throw error;
      return data as SavedCompetitorAd[];
    },
    enabled: !!user,
  });

  const saveAd = useMutation({
    mutationFn: async (ad: CompetitorAd) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('saved_competitor_ads').insert({
        user_id: user.id,
        ad_archive_id: ad.id,
        page_name: ad.page_name || null,
        page_id: ad.page_id || null,
        ad_creative_body: ad.ad_creative_bodies?.[0] || null,
        ad_snapshot_url: ad.ad_snapshot_url || null,
        ad_delivery_start_time: ad.ad_delivery_start_time || null,
        eu_total_reach: ad.eu_total_reach || null,
        publisher_platforms: ad.publisher_platforms || null,
        media_type: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-competitor-ads'] });
      toast.success('Ad saved');
    },
    onError: (err: any) => {
      if (err.message?.includes('duplicate')) {
        toast.info('Ad already saved');
      } else {
        toast.error('Failed to save ad');
      }
    },
  });

  const unsaveAd = useMutation({
    mutationFn: async (adArchiveId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('saved_competitor_ads')
        .delete()
        .eq('user_id', user.id)
        .eq('ad_archive_id', adArchiveId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-competitor-ads'] });
      toast.success('Ad removed');
    },
    onError: () => toast.error('Failed to remove ad'),
  });

  const isAdSaved = useCallback((adArchiveId: string) => {
    return savedAdsQuery.data?.some(a => a.ad_archive_id === adArchiveId) || false;
  }, [savedAdsQuery.data]);

  return {
    savedAds: savedAdsQuery.data || [],
    isLoading: savedAdsQuery.isLoading,
    saveAd,
    unsaveAd,
    isAdSaved,
  };
}
