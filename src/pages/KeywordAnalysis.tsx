import { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Columns, ChevronDown, ChevronUp, ChevronsUpDown, TrendingUp, TrendingDown, Pause } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAIKeywordRecommendations } from '@/hooks/useAIKeywordRecommendations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
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
import { useAppleKeywordAnalysis, useAppleKeywords, KEYWORD_COLUMN_DEFINITIONS, KeywordColumnDef, KeywordMetrics, KEYWORD_COST_METRICS } from '@/hooks/useAppleKeywords';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ImpressionShareBar } from '@/components/ui/impression-share-bar';
import { ConnectProvidersAlert } from '@/components/ConnectProvidersAlert';
import { SignalBars } from '@/components/ui/signal-bars';
import { ExpandableKeywordRow } from '@/components/keywords/SearchTermBreakdown';
type SortDirection = 'asc' | 'desc' | null;

const formatValue = (value: number | string, formatType: KeywordColumnDef['format']): string => {
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

const STORAGE_KEY = 'keyword-analysis-visible-columns';

export default function KeywordAnalysis() {
  const [dateOption, setDateOption] = useState<DateRangeOption>('last_30_days');
  const [customRange, setCustomRange] = useState<CustomDateRange>({ from: undefined, to: undefined });
  
  const dateRange = getDateRange(dateOption, customRange);
  const startDateStr = formatDateString(dateRange.startDate);
  const endDateStr = formatDateString(dateRange.endDate);
  
  const { data, isLoading, error } = useAppleKeywordAnalysis(startDateStr, endDateStr);
  const keywords = data?.current ?? [];
  const previousMap = data?.previous ?? new Map<string, KeywordMetrics>();
  
  const { lastSynced } = useAppleKeywords();
  const { pendingRecommendations } = useAIKeywordRecommendations();

  // Build a map of keyword_text -> recommendation type for quick lookup
  const keywordRecommendationMap = useMemo(() => {
    const map = new Map<string, 'increase_bid' | 'decrease_bid' | 'pause'>();
    pendingRecommendations.forEach(rec => {
      // Only show the first/highest confidence recommendation per keyword
      if (!map.has(rec.keyword_text)) {
        map.set(rec.keyword_text, rec.recommendation_type);
      }
    });
    return map;
  }, [pendingRecommendations]);

  const getRecommendationIcon = (keywordText: string) => {
    const recType = keywordRecommendationMap.get(keywordText);
    if (!recType) return null;

    const iconConfig = {
      increase_bid: { icon: TrendingUp, color: 'text-green-500', label: 'Increase bid recommended' },
      decrease_bid: { icon: TrendingDown, color: 'text-red-500', label: 'Decrease bid recommended' },
      pause: { icon: Pause, color: 'text-yellow-500', label: 'Pause recommended' },
    };

    const config = iconConfig[recType];
    const Icon = config.icon;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Icon className={`h-3.5 w-3.5 ml-1.5 ${config.color} inline-block`} />
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{config.label}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return new Set(JSON.parse(stored) as string[]);
      }
    } catch {
      // Fall back to defaults
    }
    const defaults = new Set<string>();
    KEYWORD_COLUMN_DEFINITIONS.forEach(col => {
      if (col.defaultVisible) defaults.add(col.key as string);
    });
    return defaults;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...visibleColumns]));
  }, [visibleColumns]);

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: SortDirection }>({ key: 'spend', direction: 'desc' });

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (key === 'keyword_text') return prev;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSort = (key: string) => {
    if (key === 'keyword_text') {
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
    if (!sortConfig.direction) return keywords;
    
    return [...keywords].sort((a, b) => {
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
  }, [keywords, sortConfig]);

  const visibleColumnDefs = KEYWORD_COLUMN_DEFINITIONS.filter(col => visibleColumns.has(col.key as string));

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) {
      return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="h-3 w-3 ml-1" />
      : <ChevronDown className="h-3 w-3 ml-1" />;
  };

  const columnsByCategory = useMemo(() => {
    const grouped: Record<string, KeywordColumnDef[]> = {};
    KEYWORD_COLUMN_DEFINITIONS.forEach(col => {
      if (!grouped[col.category]) grouped[col.category] = [];
      grouped[col.category].push(col);
    });
    return grouped;
  }, []);

  const categoryLabels: Record<string, string> = {
    core: 'Core Metrics',
    efficiency: 'Efficiency',
    engagement: 'Engagement',
    conversions: 'Conversions (AppsFlyer)',
  };

  const getMatchTypeBadge = (matchType: string) => {
    const variant = matchType === 'EXACT' ? 'default' : 'secondary';
    return <Badge variant={variant} className="text-xs">{matchType}</Badge>;
  };

  // Get previous period metric for a row
  const getPreviousMetric = (row: KeywordMetrics, key: string): number | undefined => {
    const prev = previousMap.get(row.keyword_id);
    return prev ? (prev as any)[key] : undefined;
  };

  // Check if a metric is a cost metric (should have inverted colors)
  const isCostMetric = (key: string): boolean => {
    return KEYWORD_COST_METRICS.has(key as keyof KeywordMetrics);
  };

  return (
    <>
      <Helmet>
        <title>Keyword Analysis | GrowthOS</title>
        <meta name="description" content="Analyze Apple Search Ads keyword performance" />
      </Helmet>

      <div className="space-y-6">
        <ConnectProvidersAlert />
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            Analyze Apple Search Ads keyword performance with AppsFlyer conversion data
          </p>
          
          <div className="flex items-center gap-2">
            <DateRangeFilter
              selectedOption={dateOption}
              onChange={setDateOption}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
            />
          </div>
        </div>
        
        {lastSynced && (
          <p className="text-xs text-muted-foreground">
            Apple keywords last synced: {format(new Date(lastSynced), 'dd MMM yyyy, HH:mm')}
          </p>
        )}

        {/* Table Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <CardTitle className="text-lg">
              Keywords ({sortedData.length})
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
                            disabled={col.key === 'keyword_text'}
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
                    <TableHead className="w-6 px-2"></TableHead>
                    {visibleColumnDefs.map(col => (
                      <TableHead
                        key={col.key as string}
                        className={`cursor-pointer hover:bg-muted/50 whitespace-nowrap ${
                          col.key === 'keyword_text' ? 'sticky left-8 bg-background z-10' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSort(col.key as string);
                        }}
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
                        <TableCell className="w-6 px-2">
                          <Skeleton className="h-4 w-4" />
                        </TableCell>
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
                        No keyword data. Sync Apple campaigns first, then sync keywords.
                      </TableCell>
                    </TableRow>
                  ) : (
                      sortedData.map((row, idx) => (
                      <ExpandableKeywordRow
                        key={row.keyword_id + idx}
                        keywordId={row.keyword_id}
                        startDate={startDateStr || ''}
                        endDate={endDateStr || ''}
                        visibleColumns={visibleColumnDefs}
                      >
                        {visibleColumnDefs.map(col => {
                          const value = row[col.key];
                          
                          if (col.key === 'match_type') {
                            return (
                              <TableCell key={col.key as string}>
                                {getMatchTypeBadge(String(value))}
                              </TableCell>
                            );
                          }
                          
                          // Impression share - display as progress bar
                          if (col.key === 'impression_share_low') {
                            const low = row.impression_share_low;
                            const high = row.impression_share_high;
                            if (low === null || high === null) {
                              return (
                                <TableCell key={col.key as string} className="text-muted-foreground">
                                  —
                                </TableCell>
                              );
                            }
                            return (
                              <TableCell key={col.key as string}>
                                <ImpressionShareBar low={low} high={high} />
                              </TableCell>
                            );
                          }
                          
                          // Rank - color-coded (1 = best/green, 5+ = worst/red)
                          if (col.key === 'impression_rank') {
                            const rank = row.impression_rank;
                            if (rank === null) {
                              return (
                                <TableCell key={col.key as string} className="text-muted-foreground">
                                  —
                                </TableCell>
                              );
                            }
                            const rankDisplay = rank > 5 ? '>5' : String(rank);
                            const rankColorClass = rank === 1 ? 'bg-success/10 text-success border-success/30' 
                              : rank <= 3 ? 'bg-primary/10 text-primary border-primary/30'
                              : rank <= 5 ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30'
                              : 'bg-destructive/10 text-destructive border-destructive/30';
                            return (
                              <TableCell key={col.key as string}>
                                <Badge variant="outline" className={`text-xs font-normal ${rankColorClass}`}>
                                  {rankDisplay}
                                </Badge>
                              </TableCell>
                            );
                          }
                          
                          // Search popularity - signal bars (1-5)
                          if (col.key === 'search_popularity') {
                            const pop = row.search_popularity;
                            if (pop === null) {
                              return (
                                <TableCell key={col.key as string} className="text-muted-foreground">
                                  —
                                </TableCell>
                              );
                            }
                            return (
                              <TableCell key={col.key as string}>
                                <SignalBars level={pop} maxLevel={5} />
                              </TableCell>
                            );
                          }
                          
                          // Keyword text column - special rendering with recommendation icon
                          if (col.key === 'keyword_text') {
                            return (
                              <TableCell
                                key={col.key as string}
                                className="sticky left-8 bg-background z-10 font-medium"
                              >
                                <span className="inline-flex items-center">
                                  {formatValue(value, col.format)}
                                  {getRecommendationIcon(String(value))}
                                </span>
                              </TableCell>
                            );
                          }
                          
                          // String columns - no comparison
                          if (col.format === 'string') {
                            return (
                              <TableCell key={col.key as string}>
                                {formatValue(value, col.format)}
                              </TableCell>
                            );
                          }
                          
                          // Numeric columns - with comparison
                          const numValue = Number(value) || 0;
                          const prevValue = getPreviousMetric(row, col.key as string);
                          const change = getPoP(numValue, prevValue);
                          
                          return (
                            <TableCell key={col.key as string}>
                              <MetricCell
                                value={numValue}
                                formatted={formatValue(numValue, col.format)}
                                change={change}
                                invertColors={isCostMetric(col.key as string)}
                              />
                            </TableCell>
                          );
                        })}
                      </ExpandableKeywordRow>
                    ))
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