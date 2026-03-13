import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Bookmark, BookmarkCheck, ExternalLink, Loader2, Users, Clock, Globe } from 'lucide-react';
import { useCompetitorAdSearch, useSavedCompetitorAds, CompetitorAd, SavedCompetitorAd } from '@/hooks/useCompetitorAds';
import { formatDistanceToNow } from 'date-fns';

function AdCard({ 
  ad, 
  isSaved, 
  onSave, 
  onUnsave, 
  saving 
}: { 
  ad: CompetitorAd; 
  isSaved: boolean; 
  onSave: () => void; 
  onUnsave: () => void; 
  saving: boolean;
}) {
  const runDuration = ad.ad_delivery_start_time 
    ? formatDistanceToNow(new Date(ad.ad_delivery_start_time), { addSuffix: false })
    : null;

  const bodyText = ad.ad_creative_bodies?.[0] || '';
  const headline = ad.ad_creative_link_titles?.[0] || '';

  return (
    <Card className="overflow-hidden flex flex-col">
      {/* Snapshot preview */}
      <div className="relative aspect-square bg-muted">
        {ad.ad_snapshot_url ? (
          <a href={ad.ad_snapshot_url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm p-4 text-center hover:bg-muted/80 transition-colors">
              <div className="space-y-2">
                <ExternalLink className="h-8 w-8 mx-auto opacity-50" />
                <p>Click to view ad creative</p>
              </div>
            </div>
          </a>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
            No preview available
          </div>
        )}
        {/* Save button overlay */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm hover:bg-background"
          onClick={(e) => { e.preventDefault(); isSaved ? onUnsave() : onSave(); }}
          disabled={saving}
        >
          {isSaved ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
        </Button>
      </div>

      <CardContent className="p-4 flex-1 flex flex-col gap-2">
        {/* Brand name */}
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm truncate">{ad.page_name || 'Unknown brand'}</span>
        </div>

        {/* Headline */}
        {headline && (
          <p className="text-sm font-medium line-clamp-1">{headline}</p>
        )}

        {/* Body text */}
        {bodyText && (
          <p className="text-xs text-muted-foreground line-clamp-2">{bodyText}</p>
        )}

        {/* Metrics row */}
        <div className="flex items-center gap-3 mt-auto pt-2 text-xs text-muted-foreground flex-wrap">
          {ad.eu_total_reach != null && ad.eu_total_reach > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {ad.eu_total_reach.toLocaleString()} reach
            </span>
          )}
          {runDuration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {runDuration}
            </span>
          )}
        </div>

        {/* Platforms */}
        {ad.publisher_platforms && ad.publisher_platforms.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {ad.publisher_platforms.map(p => (
              <Badge key={p} variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                {p}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SavedAdCard({ 
  ad, 
  onUnsave, 
  saving 
}: { 
  ad: SavedCompetitorAd; 
  onUnsave: () => void; 
  saving: boolean;
}) {
  const runDuration = ad.ad_delivery_start_time 
    ? formatDistanceToNow(new Date(ad.ad_delivery_start_time), { addSuffix: false })
    : null;

  return (
    <Card className="overflow-hidden flex flex-col">
      <div className="relative aspect-square bg-muted">
        {ad.ad_snapshot_url ? (
          <a href={ad.ad_snapshot_url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm p-4 text-center hover:bg-muted/80 transition-colors">
              <div className="space-y-2">
                <ExternalLink className="h-8 w-8 mx-auto opacity-50" />
                <p>Click to view ad creative</p>
              </div>
            </div>
          </a>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
            No preview
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm hover:bg-background"
          onClick={onUnsave}
          disabled={saving}
        >
          <BookmarkCheck className="h-4 w-4 text-primary" />
        </Button>
      </div>
      <CardContent className="p-4 flex-1 flex flex-col gap-2">
        <span className="font-semibold text-sm truncate">{ad.page_name || 'Unknown brand'}</span>
        {ad.ad_creative_body && (
          <p className="text-xs text-muted-foreground line-clamp-2">{ad.ad_creative_body}</p>
        )}
        <div className="flex items-center gap-3 mt-auto pt-2 text-xs text-muted-foreground flex-wrap">
          {ad.eu_total_reach != null && ad.eu_total_reach > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {ad.eu_total_reach.toLocaleString()} reach
            </span>
          )}
          {runDuration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {runDuration}
            </span>
          )}
        </div>
        {ad.publisher_platforms && ad.publisher_platforms.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {ad.publisher_platforms.map(p => (
              <Badge key={p} variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                {p}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CompetitorAds() {
  const [searchInput, setSearchInput] = useState('');
  const [mediaType, setMediaType] = useState('ALL');
  const [activeStatus, setActiveStatus] = useState('ACTIVE');
  const [sortBy, setSortBy] = useState<'reach' | 'date'>('reach');

  const { ads, loading, error, hasMore, search, loadMore } = useCompetitorAdSearch();
  const { savedAds, isLoading: savedLoading, saveAd, unsaveAd, isAdSaved } = useSavedCompetitorAds();

  const handleSearch = () => {
    if (!searchInput.trim()) return;
    search({
      search_terms: searchInput.trim(),
      media_type: mediaType,
      ad_active_status: activeStatus,
    });
  };

  const sortedAds = [...ads].sort((a, b) => {
    if (sortBy === 'reach') {
      return (b.eu_total_reach || 0) - (a.eu_total_reach || 0);
    }
    const dateA = a.ad_delivery_start_time ? new Date(a.ad_delivery_start_time).getTime() : 0;
    const dateB = b.ad_delivery_start_time ? new Date(b.ad_delivery_start_time).getTime() : 0;
    return dateB - dateA;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Competitor Ad Library</h1>
        <p className="text-muted-foreground">Search the Meta Ad Library for competitor ads and save the ones you like.</p>
      </div>

      <Tabs defaultValue="explore">
        <TabsList>
          <TabsTrigger value="explore">
            <Search className="h-4 w-4 mr-1.5" />
            Explore
          </TabsTrigger>
          <TabsTrigger value="saved">
            <Bookmark className="h-4 w-4 mr-1.5" />
            Saved ({savedAds.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="explore" className="space-y-4 mt-4">
          {/* Search bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search brand name (e.g. Betfair, Sky Bet)..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="pl-9"
              />
            </div>
            <Select value={activeStatus} onValueChange={setActiveStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="ALL">All</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'reach' | 'date')}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reach">Sort: Reach</SelectItem>
                <SelectItem value="date">Sort: Newest</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} disabled={loading || !searchInput.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Search className="h-4 w-4 mr-1.5" />}
              Search
            </Button>
          </div>

          {/* Error state */}
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Results grid */}
          {sortedAds.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">{sortedAds.length} ads found</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sortedAds.map(ad => (
                  <AdCard
                    key={ad.id}
                    ad={ad}
                    isSaved={isAdSaved(ad.id)}
                    onSave={() => saveAd.mutate(ad)}
                    onUnsave={() => unsaveAd.mutate(ad.id)}
                    saving={saveAd.isPending || unsaveAd.isPending}
                  />
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center">
                  <Button variant="outline" onClick={loadMore} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Empty state */}
          {!loading && sortedAds.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Globe className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="font-medium text-lg">Search the Meta Ad Library</h3>
              <p className="text-muted-foreground text-sm mt-1 max-w-md">
                Enter a brand name above to discover their active ads, see reach data, and save ads for reference.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="saved" className="space-y-4 mt-4">
          {savedLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : savedAds.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {savedAds.map(ad => (
                <SavedAdCard
                  key={ad.id}
                  ad={ad}
                  onUnsave={() => unsaveAd.mutate(ad.ad_archive_id)}
                  saving={unsaveAd.isPending}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bookmark className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="font-medium text-lg">No saved ads yet</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Search for competitor ads in the Explore tab and save the ones you like.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
