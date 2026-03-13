import { useState, useEffect, useMemo } from 'react';
import { format, startOfWeek, subWeeks, isAfter, isBefore, addWeeks } from 'date-fns';
import { ExternalLink, Loader2, ChevronsUpDown, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useAdLaunchHistory, useAdLaunchHistoryChart, type AdLaunchHistoryItem } from '@/hooks/useAdLaunchHistory';
import { useMetaAccountId } from '@/hooks/useMetaAccountId';

function formatDuration(ms: number | null): string {
  if (!ms) return '-';
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function ElapsedTimer({ createdAt, status, durationMs }: { createdAt: string; status: string; durationMs: number | null }) {
  const [elapsed, setElapsed] = useState(0);
  
  useEffect(() => {
    if (status !== 'pending') return;
    
    const startTime = new Date(createdAt).getTime();
    
    const updateElapsed = () => {
      setElapsed(Date.now() - startTime);
    };
    
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    
    return () => clearInterval(interval);
  }, [createdAt, status]);
  
  if (status === 'pending') {
    return (
      <span className="text-sm text-amber-600 font-medium flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        {formatElapsed(elapsed)}
      </span>
    );
  }
  
  return (
    <span className="text-sm text-muted-foreground">
      {formatDuration(durationMs)}
    </span>
  );
}

function CreativeThumbnails({ urls }: { urls: string[] }) {
  const displayUrls = urls.slice(0, 3);
  const remaining = urls.length - 3;
  
  const isVideoUrl = (url: string) => {
    const videoExtensions = ['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv'];
    const lowerUrl = url.toLowerCase();
    return videoExtensions.some(ext => lowerUrl.includes(ext)) || lowerUrl.includes('video');
  };
  
  return (
    <div className="flex items-center gap-1">
      {displayUrls.map((url, i) => (
        <div 
          key={i} 
          className="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0"
        >
          {isVideoUrl(url) ? (
            <video 
              src={url} 
              className="w-full h-full object-cover"
              muted
              preload="metadata"
            />
          ) : (
            <img 
              src={url} 
              alt="" 
              className="w-full h-full object-cover"
              loading="lazy"
            />
          )}
        </div>
      ))}
      {remaining > 0 && (
        <span className="text-xs text-muted-foreground">+{remaining}</span>
      )}
    </div>
  );
}

function StatusBadge({ status, onClick }: { status: string; onClick: () => void }) {
  const variant = status === 'success' ? 'default' : status === 'failed' ? 'destructive' : 'secondary';
  const label = status === 'success' ? 'Success' : status === 'failed' ? 'Failed' : 'Pending';
  
  return (
    <Badge 
      variant={variant} 
      className={`cursor-pointer hover:opacity-80 transition-opacity ${status === 'success' ? 'bg-green-500/20 text-green-600 border-green-500/30' : ''}`}
      onClick={onClick}
    >
      {label}
    </Badge>
  );
}

function LaunchSummaryDialog({ item, open, onOpenChange, metaAccountId }: { 
  item: AdLaunchHistoryItem | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  metaAccountId?: string | null;
}) {
  if (!item) return null;

  const campaigns = item.campaign_names?.length ? item.campaign_names : (item.campaign_name ? [item.campaign_name] : []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Launch Summary</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Status & Meta */}
          <div className="flex items-center justify-between">
            <StatusBadge status={item.status} onClick={() => {}} />
            <span className="text-sm text-muted-foreground">
              {format(new Date(item.created_at), 'MMM d, h:mma')}
            </span>
          </div>

          {/* Ad Name */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Ad Name</p>
            <p className="text-sm">{item.ad_name}</p>
          </div>

          {/* Duration */}
          {item.duration_ms && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Duration</p>
              <p className="text-sm">{formatDuration(item.duration_ms)}</p>
            </div>
          )}

          {/* Creatives */}
          {item.media_urls?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Creatives ({item.media_urls.length})</p>
              <CreativeThumbnails urls={item.media_urls} />
            </div>
          )}

          {/* Ad Sets */}
          {item.adset_names?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Ad Sets ({item.adset_names.length})</p>
              <ul className="text-sm space-y-0.5">
                {item.adset_names.map((name, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground flex-shrink-0" />
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Campaigns */}
          {campaigns.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Campaigns ({campaigns.length})</p>
              <ul className="text-sm space-y-0.5">
                {campaigns.map((name, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground flex-shrink-0" />
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Ad Copy */}
          {(item.primary_text || item.headline || item.call_to_action) && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Ad Copy</p>
              <div className="text-sm space-y-1 bg-muted/50 rounded-md p-3">
                {item.primary_text && <p><span className="text-muted-foreground">Primary:</span> {item.primary_text}</p>}
                {item.headline && <p><span className="text-muted-foreground">Headline:</span> {item.headline}</p>}
                {item.call_to_action && <p><span className="text-muted-foreground">CTA:</span> {item.call_to_action}</p>}
              </div>
            </div>
          )}

          {/* Meta Response */}
          {item.meta_ad_ids && item.meta_ad_ids.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Meta Response</p>
              <div className="text-sm space-y-1">
                <p>Created {item.meta_ad_ids.length} ad{item.meta_ad_ids.length !== 1 ? 's' : ''}</p>
                <div className="flex flex-wrap gap-1">
                  {item.meta_ad_ids.map((adId) => (
                    <Button
                      key={adId}
                      variant="outline"
                      size="sm"
                      className="text-xs h-6 px-2"
                      onClick={() => {
                        const accountParam = metaAccountId ? `act=${metaAccountId}&` : '';
                        window.open(`https://www.facebook.com/adsmanager/manage/ads?${accountParam}selected_ad_ids=${adId}`, '_blank');
                      }}
                    >
                      {adId}
                      <ExternalLink className="ml-1 h-2.5 w-2.5" />
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {item.status === 'failed' && item.error_message && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-xs font-medium text-destructive mb-1">Error</p>
              <p className="text-sm text-destructive">{item.error_message}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(220, 70%, 55%)',
  'hsl(160, 60%, 45%)',
  'hsl(30, 80%, 55%)',
  'hsl(280, 60%, 55%)',
  'hsl(350, 65%, 55%)',
  'hsl(190, 70%, 45%)',
  'hsl(50, 75%, 50%)',
  'hsl(120, 50%, 45%)',
  'hsl(0, 0%, 55%)',
];

function useChartData(data: Pick<AdLaunchHistoryItem, 'created_at' | 'adset_names' | 'ads_count'>[] | undefined) {
  return useMemo(() => {
    const now = new Date();
    const weeks: { start: Date; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      weeks.push({
        start: weekStart,
        label: `W/C ${weekStart.getDate()}.${weekStart.getMonth() + 1}`,
      });
    }

    // Count per adset per week
    const adsetCounts = new Map<string, Map<number, number>>();

    if (data) {
      for (const item of data) {
        const createdAt = new Date(item.created_at);
        const weekIdx = weeks.findIndex((w, i) => {
          const nextStart = i < weeks.length - 1 ? weeks[i + 1].start : addWeeks(w.start, 1);
          return !isBefore(createdAt, w.start) && isBefore(createdAt, nextStart);
        });
        if (weekIdx === -1) continue;

        const names = item.adset_names?.length ? item.adset_names : ['Unknown'];
        const adsPerAdset = item.ads_count / names.length;

        for (const name of names) {
          if (!adsetCounts.has(name)) adsetCounts.set(name, new Map());
          const weekMap = adsetCounts.get(name)!;
          weekMap.set(weekIdx, (weekMap.get(weekIdx) || 0) + adsPerAdset);
        }
      }
    }

    // Rank adsets by total count, group excess into "Other"
    const totals = Array.from(adsetCounts.entries()).map(([name, weekMap]) => ({
      name,
      total: Array.from(weekMap.values()).reduce((s, v) => s + v, 0),
    }));
    totals.sort((a, b) => b.total - a.total);

    const topAdsets = totals.slice(0, 8).map(t => t.name);
    const otherAdsets = totals.slice(8).map(t => t.name);
    const allAdsets = otherAdsets.length > 0 ? [...topAdsets, 'Other'] : topAdsets;

    // Build chart data
    const chartData = weeks.map((w, wi) => {
      const row: Record<string, string | number> = { week: w.label };
      for (const name of topAdsets) {
        row[name] = Math.round(adsetCounts.get(name)?.get(wi) || 0);
      }
      if (otherAdsets.length > 0) {
        row['Other'] = Math.round(
          otherAdsets.reduce((s, name) => s + (adsetCounts.get(name)?.get(wi) || 0), 0)
        );
      }
      return row;
    });

    // Build chart config
    const chartConfig: ChartConfig = {};
    allAdsets.forEach((name, i) => {
      chartConfig[name] = {
        label: name,
        color: CHART_COLORS[i % CHART_COLORS.length],
      };
    });

    return { chartData, allAdsets, chartConfig };
  }, [data]);
}

export function AdLaunchHistory() {
  const { data: history, isLoading, error } = useAdLaunchHistory();
  const { data: chartRawData, isLoading: chartLoading } = useAdLaunchHistoryChart();
  const { data: metaAccountId } = useMetaAccountId();
  const { chartData, allAdsets, chartConfig } = useChartData(chartRawData);
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; item: AdLaunchHistoryItem | null }>({
    open: false,
    item: null,
  });
  const [selectedAdsets, setSelectedAdsets] = useState<Set<string>>(new Set());
  const [adsetFilterOpen, setAdsetFilterOpen] = useState(false);

  const displayedAdsets = selectedAdsets.size === 0 ? allAdsets : allAdsets.filter(n => selectedAdsets.has(n));
  const displayedChartData = useMemo(() => {
    if (selectedAdsets.size === 0) return chartData;
    return chartData.map(row => {
      const filtered: Record<string, string | number> = { week: row.week };
      for (const name of displayedAdsets) {
        filtered[name] = row[name] ?? 0;
      }
      return filtered;
    });
  }, [chartData, selectedAdsets, displayedAdsets]);
  const displayedConfig = useMemo(() => {
    if (selectedAdsets.size === 0) return chartConfig;
    const cfg: typeof chartConfig = {};
    for (const name of displayedAdsets) {
      if (chartConfig[name]) cfg[name] = chartConfig[name];
    }
    return cfg;
  }, [chartConfig, selectedAdsets, displayedAdsets]);

  const toggleAdset = (name: string) => {
    setSelectedAdsets(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Launch History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Failed to load history</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Launch History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !history?.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No ads have been published yet
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Creatives</TableHead>
                    <TableHead>Ad Name</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead className="text-center">Ads</TableHead>
                    <TableHead className="text-center">Adsets</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Time</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <CreativeThumbnails urls={item.media_urls} />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm truncate max-w-[150px] block" title={item.ad_name}>
                          {item.ad_name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{item.campaign_name || '-'}</span>
                      </TableCell>
                      <TableCell className="text-center">{item.ads_count}</TableCell>
                      <TableCell className="text-center">{item.adsets_count}</TableCell>
                      <TableCell>
                        <span className="text-sm whitespace-nowrap">
                          {format(new Date(item.created_at), 'MMM d, h:mma')}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <ElapsedTimer 
                          createdAt={item.created_at} 
                          status={item.status} 
                          durationMs={item.duration_ms} 
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge 
                          status={item.status} 
                          onClick={() => setDetailDialog({ open: true, item })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {item.meta_ad_ids && item.meta_ad_ids.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              const adId = item.meta_ad_ids[0];
                              const accountParam = metaAccountId ? `act=${metaAccountId}&` : '';
                              window.open(`https://www.facebook.com/adsmanager/manage/ads?${accountParam}selected_ad_ids=${adId}`, '_blank');
                            }}
                          >
                            See in Meta
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stacked bar chart: launches by ad set per week */}
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg">Launches by Ad Set (Weekly)</CardTitle>
          {allAdsets.length > 0 && (
            <Popover open={adsetFilterOpen} onOpenChange={setAdsetFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                  {selectedAdsets.size === 0 ? 'All Ad Sets' : `${selectedAdsets.size} selected`}
                  <ChevronsUpDown className="h-3 w-3 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0" align="end">
                <Command>
                  <CommandInput placeholder="Search ad sets..." className="h-8 text-xs" />
                  <CommandList>
                    <CommandEmpty>No ad sets found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => setSelectedAdsets(new Set())}
                        className="text-xs"
                      >
                        <Check className={cn("mr-2 h-3 w-3", selectedAdsets.size === 0 ? "opacity-100" : "opacity-0")} />
                        Select All
                      </CommandItem>
                      {allAdsets.map((name) => (
                        <CommandItem
                          key={name}
                          onSelect={() => toggleAdset(name)}
                          className="text-xs"
                        >
                          <Check className={cn("mr-2 h-3 w-3", selectedAdsets.has(name) ? "opacity-100" : "opacity-0")} />
                          <span
                            className="mr-2 h-2.5 w-2.5 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: chartConfig[name]?.color }}
                          />
                          <span className="truncate">{name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </CardHeader>
        <CardContent>
          {chartLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : allAdsets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No launch data for the past 6 weeks
            </p>
          ) : (
            <ChartContainer config={displayedConfig} className="h-[300px] w-full">
              <BarChart data={displayedChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="week" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                {displayedAdsets.map((name) => (
                  <Bar
                    key={name}
                    dataKey={name}
                    stackId="a"
                    fill={`var(--color-${CSS.escape(name)})`}
                    style={{ fill: displayedConfig[name]?.color }}
                    radius={[0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <LaunchSummaryDialog 
        item={detailDialog.item} 
        open={detailDialog.open} 
        onOpenChange={(open) => setDetailDialog(prev => ({ ...prev, open }))}
        metaAccountId={metaAccountId}
      />
    </>
  );
}
