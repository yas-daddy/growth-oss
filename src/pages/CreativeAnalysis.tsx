import { useState, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Columns, ChevronDown, ChevronUp, ChevronsUpDown, ExternalLink, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { useCreativeFatigueAnalysis } from '@/hooks/useCreativeFatigueAnalysis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRangeFilter, DateRangeOption, getDateRange, CustomDateRange } from '@/components/DateRangeFilter';
import { useCreativeAnalysis, COLUMN_DEFINITIONS, ColumnDef, CreativeMetrics, COST_METRICS } from '@/hooks/useCreativeAnalysis';
import { useMolocoCreativeAnalysis, MOLOCO_COLUMN_DEFINITIONS, MolocoColumnDef, MolocoCreativeMetrics, MOLOCO_COST_METRICS } from '@/hooks/useMolocoCreativeAnalysis';
import { useMetaAdsSyncStatus } from '@/hooks/useMetaAds';
import { useMolocoCreativesSyncStatus } from '@/hooks/useMolocoCreatives';
import { ConnectProvidersAlert } from '@/components/ConnectProvidersAlert';
import { useUserPreference } from '@/hooks/useUserPreferences';
import { useMetaAccountId } from '@/hooks/useMetaAccountId';

import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

type Channel = 'meta' | 'moloco';

interface ColumnPreferences {
  meta: string[];
  moloco: string[];
}

// Get default visible columns for a channel
function getDefaultColumns(channel: Channel): string[] {
  const defs = channel === 'meta' ? COLUMN_DEFINITIONS : MOLOCO_COLUMN_DEFINITIONS;
  return defs.filter(col => col.defaultVisible).map(col => col.key as string);
}
type SortDirection = 'asc' | 'desc' | null;

const formatValue = (value: number | string, formatType: ColumnDef['format'] | MolocoColumnDef['format']): string => {
  if (typeof value === 'string') return value;
  
  switch (formatType) {
    case 'currency':
      return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'number':
      return value.toLocaleString('en-GB', { maximumFractionDigits: 0 });
    case 'percentage':
      return `${value.toFixed(2)}%`;
    case 'decimal':
      return value.toFixed(2);
    default:
      return String(value);
  }
};

const formatDateString = (date: Date | null): string | undefined => {
  if (!date) return undefined;
  return format(date, 'yyyy-MM-dd');
};

// Calculate period-over-period change percentage
function getPoP(current: number, previous: number | undefined): number | null {
  if (previous === undefined || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// Metric cell with comparison
function MetricCell({ 
  value, 
  formatted, 
  change, 
  invertColors = false 
}: { 
  value: number; 
  formatted: string; 
  change: number | null; 
  invertColors?: boolean;
}) {
  const hasChange = change !== null && isFinite(change);
  const isPositive = change !== null && change >= 0;
  // For inverted metrics (costs), negative is good (green), positive is bad (red)
  const colorClass = invertColors 
    ? (isPositive ? 'text-destructive' : 'text-success')
    : (isPositive ? 'text-success' : 'text-destructive');
  
  return (
    <div className="flex flex-col items-end">
      <span>{formatted}</span>
      {hasChange && (
        <span className={`text-[10px] ${colorClass}`}>
          {isPositive ? '+' : ''}{Math.round(change)}%
        </span>
      )}
    </div>
  );
}

export default function CreativeAnalysis() {
  const [dateOption, setDateOption] = useState<DateRangeOption>('last_30_days');
  const [customRange, setCustomRange] = useState<CustomDateRange>({ from: undefined, to: undefined });
  
  const dateRange = getDateRange(dateOption, customRange);
  const startDateStr = formatDateString(dateRange.startDate);
  const endDateStr = formatDateString(dateRange.endDate);
  
  // Meta data
  const { data: metaData, isLoading: metaLoading, error: metaError } = useCreativeAnalysis(startDateStr, endDateStr);
  const { lastSyncedAt: metaLastSynced } = useMetaAdsSyncStatus();
  const { data: metaAccountId } = useMetaAccountId();
  
  // Moloco data
  const { data: molocoData, isLoading: molocoLoading, error: molocoError } = useMolocoCreativeAnalysis(startDateStr, endDateStr);
  const { lastSyncedAt: molocoLastSynced, isConnected: molocoConnected } = useMolocoCreativesSyncStatus();
  
  // Extract current arrays
  const metaCreatives = metaData?.current ?? [];
  const metaPrevious = metaData?.previous ?? new Map<string, CreativeMetrics>();
  const molocoCreatives = molocoData?.current ?? [];
  const molocoPrevious = molocoData?.previous ?? new Map<string, MolocoCreativeMetrics>();
  
  // Creative fatigue predictions
  const { predictions: fatiguePredictions = [] } = useCreativeFatigueAnalysis();

  // Build a map of creative_name -> fatigue_status for quick lookup
  const creativeFatigueMap = useMemo(() => {
    const map = new Map<string, 'healthy' | 'early_warning' | 'fatiguing' | 'fatigued'>();
    fatiguePredictions.forEach(pred => {
      // Only show the first prediction per creative name
      if (!map.has(pred.creative_name)) {
        map.set(pred.creative_name, pred.fatigue_status);
      }
    });
    return map;
  }, [fatiguePredictions]);

  const getFatigueIcon = (creativeName: string) => {
    const status = creativeFatigueMap.get(creativeName);
    if (!status) return null;

    const iconConfig = {
      healthy: { icon: CheckCircle, color: 'text-green-500', label: 'Healthy performance' },
      early_warning: { icon: AlertTriangle, color: 'text-yellow-500', label: 'Early warning - at risk of fatigue' },
      fatiguing: { icon: AlertTriangle, color: 'text-orange-500', label: 'Fatiguing - consider rotating' },
      fatigued: { icon: AlertCircle, color: 'text-red-500', label: 'Fatigued - rotate or pause' },
    };

    const config = iconConfig[status];
    const Icon = config.icon;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Icon className={`h-3.5 w-3.5 ml-1.5 ${config.color} inline-block flex-shrink-0`} />
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{config.label}</p>
        </TooltipContent>
      </Tooltip>
    );
  };
  
  // Determine available channels - wait for data to load before filtering
  const dataLoaded = !metaLoading && !molocoLoading;
  
  const availableChannels = useMemo(() => {
    const channels: Channel[] = [];
    
    // Always include meta as default
    if (metaCreatives.length > 0 || metaLastSynced || !dataLoaded) {
      channels.push('meta');
    }
    
    // Include moloco if we have any data or connection
    if (molocoCreatives.length > 0 || molocoConnected) {
      channels.push('moloco');
    }
    
    // Fallback to meta if nothing else
    if (channels.length === 0) {
      channels.push('meta');
    }
    
    return channels;
  }, [metaCreatives.length, molocoCreatives.length, metaLastSynced, molocoConnected, dataLoaded]);
  
  const [selectedChannel, setSelectedChannel] = useState<Channel>(availableChannels[0] || 'meta');
  
  // Current channel data
  const isLoading = selectedChannel === 'meta' ? metaLoading : molocoLoading;
  const error = selectedChannel === 'meta' ? metaError : molocoError;
  const lastSyncedAt = selectedChannel === 'meta' ? metaLastSynced : molocoLastSynced;
  
  const columnDefs = selectedChannel === 'meta' ? COLUMN_DEFINITIONS : MOLOCO_COLUMN_DEFINITIONS;
  
  // Server-side column preferences
  const defaultPreferences: ColumnPreferences = {
    meta: getDefaultColumns('meta'),
    moloco: getDefaultColumns('moloco'),
  };
  
  const { value: columnPreferences, setValue: setColumnPreferences, isLoading: prefsLoading } = 
    useUserPreference<ColumnPreferences>('creative-analysis-columns', defaultPreferences);
  
  // Get visible columns for current channel
  const visibleColumns = useMemo(() => {
    const cols = selectedChannel === 'meta' 
      ? columnPreferences.meta 
      : columnPreferences.moloco;
    return new Set(cols.length > 0 ? cols : getDefaultColumns(selectedChannel));
  }, [columnPreferences, selectedChannel]);
  
  // Toggle column visibility
  const toggleColumn = useCallback((key: string) => {
    const nameKey = selectedChannel === 'meta' ? 'ad_name' : 'creative_name';
    if (key === nameKey) return; // Can't toggle name column
    
    const currentCols = selectedChannel === 'meta' 
      ? columnPreferences.meta 
      : columnPreferences.moloco;
    
    const colsSet = new Set(currentCols.length > 0 ? currentCols : getDefaultColumns(selectedChannel));
    
    if (colsSet.has(key)) {
      colsSet.delete(key);
    } else {
      colsSet.add(key);
    }
    
    const newCols = Array.from(colsSet);
    
    setColumnPreferences({
      ...columnPreferences,
      [selectedChannel]: newCols,
    });
  }, [selectedChannel, columnPreferences, setColumnPreferences]);
  
  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: SortDirection }>({ key: 'spend', direction: 'desc' });
  
  const handleSort = (key: string) => {
    const nameKey = selectedChannel === 'meta' ? 'ad_name' : 'creative_name';
    if (key === nameKey) {
      setSortConfig(prev => ({
        key,
        direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
      }));
    } else {
      setSortConfig(prev => ({
        key,
        direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
      }));
    }
  };
  
  const sortedData = useMemo(() => {
    const data = selectedChannel === 'meta' ? metaCreatives : molocoCreatives;
    if (!sortConfig.direction) return data;
    
    return [...data].sort((a, b) => {
      const aVal = (a as any)[sortConfig.key];
      const bVal = (b as any)[sortConfig.key];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      const aNum = Number(aVal) || 0;
      const bNum = Number(bVal) || 0;
      
      return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
    });
  }, [metaCreatives, molocoCreatives, selectedChannel, sortConfig]);
  
  const visibleColumnDefs = columnDefs.filter(col => visibleColumns.has(col.key as string));
  
  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) {
      return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="h-3 w-3 ml-1" />
      : <ChevronDown className="h-3 w-3 ml-1" />;
  };
  
  const columnsByCategory = useMemo(() => {
    const grouped: Record<string, typeof columnDefs> = {};
    columnDefs.forEach(col => {
      if (!grouped[col.category]) grouped[col.category] = [];
      grouped[col.category].push(col);
    });
    return grouped;
  }, [columnDefs]);
  
  const categoryLabels: Record<string, string> = {
    core: 'Core Metrics',
    efficiency: 'Efficiency',
    conversions: 'Conversions',
    engagement: 'Engagement',
    video: 'Video Metrics',
  };

  const channelLabel = selectedChannel === 'meta' ? 'Meta' : 'Moloco';
  const nameKey = selectedChannel === 'meta' ? 'ad_name' : 'creative_name';
  
  // Get previous period data for current row
  const getPreviousMetric = (row: CreativeMetrics | MolocoCreativeMetrics, key: string): number | undefined => {
    if (selectedChannel === 'meta') {
      const prev = metaPrevious.get((row as CreativeMetrics).ad_name);
      return prev ? (prev as any)[key] : undefined;
    } else {
      const prev = molocoPrevious.get((row as MolocoCreativeMetrics).creative_name);
      return prev ? (prev as any)[key] : undefined;
    }
  };
  
  // Check if a metric is a cost metric (should have inverted colors)
  const isCostMetric = (key: string): boolean => {
    if (selectedChannel === 'meta') {
      return COST_METRICS.has(key as keyof CreativeMetrics);
    } else {
      return MOLOCO_COST_METRICS.has(key as keyof MolocoCreativeMetrics);
    }
  };

  return (
    <>
      <Helmet>
        <title>Creative Analysis | GrowthOS</title>
        <meta name="description" content="Analyze ad creative performance with detailed metrics" />
      </Helmet>

      <div className="space-y-6">
        <ConnectProvidersAlert />
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            Analyze {channelLabel.toLowerCase()} creative performance grouped by name
          </p>
          
          <div className="flex items-center gap-2">
            {/* Channel selector */}
            {availableChannels.length > 1 && (
              <Select value={selectedChannel} onValueChange={(v) => setSelectedChannel(v as Channel)}>
                <SelectTrigger className="w-[130px]">
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
            
            <DateRangeFilter
              selectedOption={dateOption}
              onChange={setDateOption}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
            />
          </div>
        </div>
        
        {lastSyncedAt && (
          <p className="text-xs text-muted-foreground">
            Last synced: {format(new Date(lastSyncedAt), 'dd MMM yyyy, HH:mm')}
          </p>
        )}

        {/* Table Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <CardTitle className="text-lg">
              Creatives ({sortedData.length})
            </CardTitle>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns className="h-4 w-4 mr-2" />
                  Edit Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <ScrollArea className="h-80">
                  {Object.entries(columnsByCategory).map(([category, columns]) => (
                    <div key={category}>
                      <DropdownMenuLabel className="text-xs uppercase text-muted-foreground">
                        {categoryLabels[category] || category}
                      </DropdownMenuLabel>
                      {columns.map(col => (
                        <div
                          key={col.key as string}
                          className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent rounded-sm"
                          onClick={() => toggleColumn(col.key as string)}
                        >
                          <Checkbox
                            checked={visibleColumns.has(col.key as string)}
                            disabled={col.key === nameKey}
                            className="pointer-events-none"
                          />
                          <span className="text-sm">{col.label}</span>
                        </div>
                      ))}
                      <DropdownMenuSeparator />
                    </div>
                  ))}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Thumbnail header */}
                    <TableHead className="sticky left-0 bg-background z-10 w-16">
                      Thumb
                    </TableHead>
                    {visibleColumnDefs.map(col => (
                      <TableHead
                        key={col.key as string}
                        className={`cursor-pointer hover:bg-muted/50 whitespace-nowrap ${
                          col.key === nameKey ? 'sticky left-16 bg-background z-10' : ''
                        }`}
                        onClick={() => handleSort(col.key as string)}
                      >
                        <div className="flex items-center">
                          {col.label}
                          {getSortIcon(col.key as string)}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-12 w-12 rounded" /></TableCell>
                        {visibleColumnDefs.map(col => (
                          <TableCell key={col.key as string}>
                            <Skeleton className="h-4 w-20" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : error ? (
                    <TableRow>
                      <TableCell colSpan={visibleColumnDefs.length + 1} className="text-center py-8 text-destructive">
                        Error loading data: {error.message}
                      </TableCell>
                    </TableRow>
                  ) : sortedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={visibleColumnDefs.length + 1} className="text-center py-8 text-muted-foreground">
                        No data for selected date range. Try syncing or adjusting the date filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedData.map((row, idx) => {
                      const name = (row as any)[nameKey];
                      const thumbnailUrl = (row as any).thumbnail_url;
                      const adId = selectedChannel === 'meta' ? (row as any).ad_id : null;
                      // Build Meta Ads Manager URL with account ID to ensure correct account is used
                      const adsManagerUrl = adId && metaAccountId 
                        ? `https://www.facebook.com/adsmanager/manage/ads?act=${metaAccountId}&selected_ad_ids=${adId}` 
                        : null;
                      
                      return (
                        <TableRow key={name + idx}>
                          {/* Thumbnail column */}
                          <TableCell className="sticky left-0 bg-background z-10 w-16 p-2">
                            {thumbnailUrl ? (
                              adsManagerUrl ? (
                                <a 
                                  href={adsManagerUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="relative group block"
                                  title="Open in Meta Ads Manager"
                                >
                                  <img 
                                    src={thumbnailUrl} 
                                    alt={name}
                                    className="w-12 h-12 object-cover rounded transition-opacity group-hover:opacity-75"
                                    loading="lazy"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ExternalLink className="h-4 w-4 text-white drop-shadow-lg" />
                                  </div>
                                </a>
                              ) : (
                                <img 
                                  src={thumbnailUrl} 
                                  alt={name}
                                  className="w-12 h-12 object-cover rounded"
                                  loading="lazy"
                                />
                              )
                            ) : (
                              <div className="w-12 h-12 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">
                                No img
                              </div>
                            )}
                          </TableCell>
                          {visibleColumnDefs.map(col => {
                            const currentValue = (row as any)[col.key];
                            const previousValue = getPreviousMetric(row, col.key as string);
                            const change = typeof currentValue === 'number' ? getPoP(currentValue, previousValue) : null;
                            const invertColors = isCostMetric(col.key as string);
                            
                            return (
                              <TableCell 
                                key={col.key as string}
                                className={`whitespace-nowrap ${
                                  col.key === nameKey 
                                    ? 'sticky left-16 bg-background z-10 font-medium max-w-[250px]' 
                                    : 'text-right'
                                }`}
                                title={col.key === nameKey ? String(currentValue) : undefined}
                              >
                                {col.key === nameKey 
                                  ? (
                                    <span className="inline-flex items-center">
                                      <span className="truncate">{currentValue}</span>
                                      {getFatigueIcon(String(currentValue))}
                                    </span>
                                  )
                                  : (
                                    <MetricCell
                                      value={currentValue as number}
                                      formatted={formatValue(currentValue as number, col.format)}
                                      change={change}
                                      invertColors={invertColors}
                                    />
                                  )
                                }
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
