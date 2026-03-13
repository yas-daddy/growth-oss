import { useState } from 'react';
import { Helmet } from 'react-helmet';
import { format, parseISO } from 'date-fns';
import { Image, Clock, Eye, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMonthlyTopAds, useMetaAdsSyncStatus } from '@/hooks/useMetaAds';
import { useMonthlyTopMolocoCreatives, useMolocoCreativesSyncStatus } from '@/hooks/useMolocoCreatives';

type Channel = 'meta' | 'moloco';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-GB').format(value);
}

function formatMonthName(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return format(date, 'MMMM yyyy');
}

export default function TopAds() {
  // Meta data
  const { data: metaMonthlyAds, isLoading: metaLoading, error: metaError } = useMonthlyTopAds();
  const { isConnected: metaConnected, lastSyncedAt: metaLastSynced } = useMetaAdsSyncStatus();
  
  // Moloco data
  const { data: molocoMonthlyCreatives, isLoading: molocoLoading, error: molocoError } = useMonthlyTopMolocoCreatives();
  const { isConnected: molocoConnected, lastSyncedAt: molocoLastSynced } = useMolocoCreativesSyncStatus();
  
  // Determine available channels (only show channels with data)
  const availableChannels: Channel[] = [];
  if (metaConnected || (metaMonthlyAds && metaMonthlyAds.length > 0)) {
    availableChannels.push('meta');
  }
  if (molocoConnected || (molocoMonthlyCreatives && molocoMonthlyCreatives.length > 0)) {
    availableChannels.push('moloco');
  }
  
  // Default to first available channel, or meta if none
  const [selectedChannel, setSelectedChannel] = useState<Channel>(availableChannels[0] || 'meta');
  
  // Get current channel data
  const isLoading = selectedChannel === 'meta' ? metaLoading : molocoLoading;
  const error = selectedChannel === 'meta' ? metaError : molocoError;
  const lastSyncedAt = selectedChannel === 'meta' ? metaLastSynced : molocoLastSynced;
  
  // Normalize data structure for display
  const monthlyData = selectedChannel === 'meta' 
    ? metaMonthlyAds?.map(m => ({
        month: m.month,
        totalSpend: m.totalSpend,
        weightedAvgAge: m.weightedAvgAge,
        items: m.ads.map(ad => ({
          name: ad.ad_name,
          thumbnail_url: ad.thumbnail_url,
          spend: ad.spend,
          impressions: ad.impressions,
          conversions: ad.conversions,
          age_days: ad.age_days,
        })),
      }))
    : molocoMonthlyCreatives?.map(m => ({
        month: m.month,
        totalSpend: m.totalSpend,
        weightedAvgAge: m.weightedAvgAge,
        items: m.creatives.map(c => ({
          name: c.creative_name,
          thumbnail_url: c.thumbnail_url,
          spend: c.spend,
          impressions: c.impressions,
          conversions: c.installs,
          age_days: c.age_days,
        })),
      }));

  const channelLabel = selectedChannel === 'meta' ? 'Meta' : 'Moloco';
  const itemLabel = selectedChannel === 'meta' ? 'ads' : 'creatives';

  return (
    <>
      <Helmet>
        <title>Top Ads | GrowthOS</title>
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-muted-foreground">
            Monthly breakdown of your highest-spending {itemLabel}
          </p>
          <div className="flex items-center gap-3">
            {/* Channel selector - only show if multiple channels available */}
            {availableChannels.length > 1 && (
              <Select value={selectedChannel} onValueChange={(v) => setSelectedChannel(v as Channel)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableChannels.includes('meta') && (
                    <SelectItem value="meta">Meta Ads</SelectItem>
                  )}
                  {availableChannels.includes('moloco') && (
                    <SelectItem value="moloco">Moloco</SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
            
            {lastSyncedAt && (
              <span className="text-xs text-muted-foreground">
                Last synced: {format(parseISO(lastSyncedAt), 'dd MMM HH:mm')}
              </span>
            )}
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <Skeleton key={j} className="h-64" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Error state */}
        {error && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to load {itemLabel}</h3>
              <p className="text-muted-foreground">{error.message}</p>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!isLoading && !error && (!monthlyData || monthlyData.length === 0) && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Image className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No {itemLabel} data yet</h3>
              <p className="text-muted-foreground">
                Data will appear here after the nightly sync runs
              </p>
            </CardContent>
          </Card>
        )}

        {/* Monthly tiles */}
        {!isLoading && !error && monthlyData && monthlyData.length > 0 && (
          <div className="space-y-8">
            {monthlyData.map((monthData) => (
              <Card key={monthData.month}>
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{formatMonthName(monthData.month)}</CardTitle>
                      <CardDescription>
                        Top 5 {itemLabel} by spend
                      </CardDescription>
                    </div>
                    <div className="flex gap-6">
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Total Spend</div>
                        <div className="text-lg font-semibold">{formatCurrency(monthData.totalSpend)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Avg Age</div>
                        <div className="text-lg font-semibold">{monthData.weightedAvgAge}d</div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {monthData.items.map((item, index) => (
                      <Card 
                        key={`${monthData.month}-${item.name}`}
                        className="overflow-hidden border-border/50 bg-card/50"
                      >
                        {/* Thumbnail */}
                        <div className="aspect-video bg-muted relative overflow-hidden">
                          {item.thumbnail_url ? (
                            <img 
                              src={item.thumbnail_url} 
                              alt={item.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Image className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                          <Badge 
                            className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm"
                            variant="secondary"
                          >
                            #{index + 1}
                          </Badge>
                        </div>

                        {/* Details */}
                        <div className="p-3 space-y-3">
                          <div>
                            <h4 className="font-medium text-sm line-clamp-2 leading-tight" title={item.name}>
                              {item.name}
                            </h4>
                          </div>

                          {/* Metrics grid */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <DollarSign className="h-3 w-3 flex-shrink-0" />
                              <span className="font-medium text-foreground">
                                {formatCurrency(item.spend)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Eye className="h-3 w-3 flex-shrink-0" />
                              <span>{formatNumber(item.impressions)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <TrendingUp className="h-3 w-3 flex-shrink-0" />
                              <span>{formatNumber(item.conversions)} {selectedChannel === 'meta' ? 'conv' : 'inst'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock className="h-3 w-3 flex-shrink-0" />
                              <span>{item.age_days}d old</span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
