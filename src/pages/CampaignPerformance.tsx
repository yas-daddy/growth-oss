import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Helmet } from 'react-helmet';
import { Columns, ChevronDown, ChevronUp, ChevronsUpDown, DollarSign, Users, Target, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { DateRangeFilter, DateRangeOption, getDateRange, CustomDateRange } from '@/components/DateRangeFilter';
import {
  useCampaignAnalysis,
  CAMPAIGN_COLUMN_DEFINITIONS,
  CAMPAIGN_COST_METRICS,
  CampaignMetrics,
  CampaignColumnDef,
  getCampaignKey,
  KPIData,
} from '@/hooks/useCampaignAnalysis';
import { useUserPreference } from '@/hooks/useUserPreferences';
import { KPICard } from '@/components/dashboard/KPICard';
import { Report } from '@/components/reports';
import { useReport, ChartDataPoint } from '@/hooks/useReport';
import { format, parseISO } from 'date-fns';
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Line, Legend } from 'recharts';
import { CardDescription } from '@/components/ui/card';

type SortDirection = 'asc' | 'desc';

const formatValue = (value: number | string, formatType: CampaignColumnDef['format']): string => {
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

function getPoP(current: number, previous: number | undefined): number | null {
  if (previous === undefined || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function MetricCell({
  value,
  formatted,
  change,
  invertColors = false,
}: {
  value: number;
  formatted: string;
  change: number | null;
  invertColors?: boolean;
}) {
  const hasChange = change !== null && isFinite(change);
  const isPositive = change !== null && change >= 0;
  const colorClass = invertColors
    ? isPositive ? 'text-destructive' : 'text-success'
    : isPositive ? 'text-success' : 'text-destructive';

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

const MEDIA_SOURCE_COLORS: Record<string, string> = {
  'Facebook Ads': 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  'Apple Search Ads': 'bg-gray-500/10 text-gray-600 border-gray-500/30',
  'moloco_int': 'bg-purple-500/10 text-purple-600 border-purple-500/30',
};

const MEDIA_SOURCE_LABELS: Record<string, string> = {
  'moloco_int': 'Moloco',
};

function getMediaSourceLabel(source: string): string {
  return MEDIA_SOURCE_LABELS[source] || source;
}

function MediaSourceBadge({ source }: { source: string }) {
  const colorClass = MEDIA_SOURCE_COLORS[source] || 'bg-muted text-muted-foreground border-border';
  return <Badge variant="outline" className={`text-xs ${colorClass}`}>{getMediaSourceLabel(source)}</Badge>;
}

function getDefaultColumns(): string[] {
  return CAMPAIGN_COLUMN_DEFINITIONS.filter(col => col.defaultVisible).map(col => col.key);
}

const CHART_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

function FilteredDailySpendChart({ chartData, selectedChannel, startDate, endDate }: { chartData: ChartDataPoint[]; selectedChannel: string; startDate?: string; endDate?: string }) {
  const filteredData = selectedChannel === 'all'
    ? chartData
    : chartData.filter(item => item.channel === selectedChannel);

  // Fetch per-channel CPA using AppsFlyer data when a specific channel is selected
  const { data: channelCpaData } = useQuery({
    queryKey: ['daily-channel-cpa', selectedChannel, startDate, endDate],
    queryFn: async () => {
      if (selectedChannel === 'all' || !startDate || !endDate) return null;
      const { data, error } = await (supabase.rpc as any)('get_daily_channel_cpa', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_channel: selectedChannel,
      });
      if (error) throw error;
      return data as { date: string; cpa: number | null }[] | null;
    },
    enabled: selectedChannel !== 'all' && !!startDate && !!endDate,
  });

  if (filteredData.length === 0) {
    return (
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base md:text-lg">Daily Spend by Channel</CardTitle>
          <CardDescription className="text-xs md:text-sm">Daily advertising spend breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center border border-dashed border-border rounded-lg bg-muted/30">
            <p className="text-sm text-muted-foreground">No data available for this channel</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Pivot by date
  const dateMap = new Map<string, Record<string, any>>();
  const channels = new Set<string>();

  filteredData.forEach(item => {
    if (item.date) {
      if (!dateMap.has(item.date)) {
        dateMap.set(item.date, { date: item.date });
      }
      const entry = dateMap.get(item.date)!;
      entry[item.channel] = item.value;
      if (item.dailyCpa != null && entry.dailyCpa == null) {
        entry.dailyCpa = item.dailyCpa;
      }
      channels.add(item.channel);
    }
  });

  // For "all channels", show the blended CPA line (Mixpanel-based)
  // For a specific channel, show per-channel CPA line (AppsFlyer-based)
  const showBlendedCpa = selectedChannel === 'all';
  const showChannelCpa = selectedChannel !== 'all' && channelCpaData && channelCpaData.length > 0;

  // Merge per-channel CPA data into the chart
  if (showChannelCpa) {
    const cpaMap = new Map(channelCpaData!.map(d => [d.date, d.cpa]));
    for (const [date, entry] of dateMap) {
      const cpa = cpaMap.get(date);
      if (cpa != null) {
        entry.channelCpa = cpa;
      }
    }
  }

  const stackedData = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const channelList = Array.from(channels);
  const hasBlendedCpaData = showBlendedCpa && stackedData.some((d: any) => d.dailyCpa != null && d.dailyCpa > 0);
  const hasChannelCpaData = showChannelCpa && stackedData.some((d: any) => d.channelCpa != null && d.channelCpa > 0);
  const showRightAxis = hasBlendedCpaData || hasChannelCpaData;

  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-base md:text-lg">Daily Spend by Channel</CardTitle>
        <CardDescription className="text-xs md:text-sm">Daily advertising spend breakdown</CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
        <ResponsiveContainer width="100%" height={280} className="md:!h-[350px]">
          <ComposedChart data={stackedData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(parseISO(value), 'dd MMM')}
              className="text-[10px] md:text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={(value) => `£${(value / 1000).toFixed(0)}k`}
              className="text-[10px] md:text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              width={45}
            />
            {showRightAxis && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(value) => `£${Math.round(value)}`}
                className="text-[10px] md:text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                width={45}
              />
            )}
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === 'CPA' || name === 'Channel CPA') return [`£${value.toFixed(2)}`, name];
                return [`£${Math.round(value).toLocaleString()}`, name];
              }}
              labelFormatter={(label) => format(parseISO(label as string), 'EEE dd MMM yyyy')}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            {channelList.map((channel, index) => (
              <Bar
                key={channel}
                dataKey={channel}
                stackId="a"
                yAxisId="left"
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
            {hasBlendedCpaData && (
              <Line
                type="monotone"
                dataKey="dailyCpa"
                name="CPA"
                yAxisId="right"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--destructive))', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5 }}
              />
            )}
            {hasChannelCpaData && (
              <Line
                type="monotone"
                dataKey="channelCpa"
                name="Channel CPA"
                yAxisId="right"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--destructive))', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default function CampaignPerformance() {
  const [dateOption, setDateOption] = useState<DateRangeOption>('last_30_days');
  const [customRange, setCustomRange] = useState<CustomDateRange>({ from: undefined, to: undefined });
  const [selectedChannel, setSelectedChannel] = useState<string>('all');

  const dateRange = getDateRange(dateOption, customRange);
  const startDateStr = formatDateString(dateRange.startDate);
  const endDateStr = formatDateString(dateRange.endDate);

  const { data, isLoading } = useCampaignAnalysis(startDateStr, endDateStr);

  const campaigns = data?.current ?? [];
  const previousMap = data?.previous ?? new Map<string, CampaignMetrics>();
  const kpiData: KPIData = data?.kpiData ?? { totalSpend: 0, totalFtds: 0, cpa: 0 };

  // Fetch chart data for filtered rendering
  const { data: chartReportData } = useReport('daily_spend_by_channel', {
    startDate: startDateStr,
    endDate: endDateStr,
  });
  const chartData = (chartReportData as ChartDataPoint[]) ?? [];

  // Extract unique media sources for the dropdown
  const mediaSourceOptions = useMemo(() => {
    const sources = new Set<string>();
    campaigns.forEach(c => sources.add(c.media_source));
    return Array.from(sources).sort();
  }, [campaigns]);

  // Filter campaigns: exclude zero spend + apply channel filter
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      if (c.spend <= 0) return false;
      if (selectedChannel !== 'all' && c.media_source !== selectedChannel) return false;
      return true;
    });
  }, [campaigns, selectedChannel]);

  // Compute KPIs: use aggregate RPCs for "all", sum filtered rows for specific channel
  const displayKpiData = useMemo((): KPIData => {
    if (selectedChannel === 'all') return kpiData;

    const totalSpend = filteredCampaigns.reduce((sum, c) => sum + c.spend, 0);
    const totalFtds = filteredCampaigns.reduce((sum, c) => sum + c.ftds, 0);
    const cpa = totalFtds > 0 ? totalSpend / totalFtds : 0;

    // Compute previous period totals for this channel
    const prevRows = Array.from(previousMap.values()).filter(c => c.media_source === selectedChannel);
    const prevSpend = prevRows.reduce((sum, c) => sum + c.spend, 0);
    const prevFtds = prevRows.reduce((sum, c) => sum + c.ftds, 0);
    const prevCpa = prevFtds > 0 ? prevSpend / prevFtds : 0;

    return {
      totalSpend,
      totalFtds,
      cpa,
      spendChange: prevSpend > 0 ? ((totalSpend - prevSpend) / prevSpend) * 100 : undefined,
      ftdsChange: prevFtds > 0 ? ((totalFtds - prevFtds) / prevFtds) * 100 : undefined,
      cpaChange: prevCpa > 0 ? ((cpa - prevCpa) / prevCpa) * 100 : undefined,
    };
  }, [selectedChannel, kpiData, filteredCampaigns, previousMap]);

  // Map media_source to chart channel name for filtering
  // The chart data uses channel names like "Meta", "Apple", "Moloco", "Affiliates"
  // We need to find which chart channel corresponds to the selected media_source
  const chartChannelForSource = useMemo(() => {
    if (selectedChannel === 'all') return 'all';
    // Try to find the matching chart channel name
    const chartChannels = new Set(chartData.map(d => d.channel));
    // Direct match
    if (chartChannels.has(selectedChannel)) return selectedChannel;
    // Common mappings
    const mappings: Record<string, string[]> = {
      'Facebook Ads': ['Meta Ads', 'Meta', 'Facebook', 'Facebook Ads'],
      'Apple Search Ads': ['Apple Search Ads', 'Apple'],
      'moloco_int': ['Moloco Ads', 'Moloco', 'moloco_int'],
    };
    const candidates = mappings[selectedChannel] || [selectedChannel];
    for (const candidate of candidates) {
      if (chartChannels.has(candidate)) return candidate;
    }
    return selectedChannel;
  }, [selectedChannel, chartData]);

  // Column preferences
  const { value: visibleColumnKeys, setValue: setVisibleColumnKeys } =
    useUserPreference<string[]>('campaign-performance-columns', getDefaultColumns());

  const visibleColumns = useMemo(() => {
    return new Set(visibleColumnKeys.length > 0 ? visibleColumnKeys : getDefaultColumns());
  }, [visibleColumnKeys]);

  const toggleColumn = useCallback((key: string) => {
    if (key === 'campaign_name') return;
    const colsSet = new Set(visibleColumnKeys.length > 0 ? visibleColumnKeys : getDefaultColumns());
    if (colsSet.has(key)) {
      colsSet.delete(key);
    } else {
      colsSet.add(key);
    }
    setVisibleColumnKeys(Array.from(colsSet));
  }, [visibleColumnKeys, setVisibleColumnKeys]);

  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: SortDirection }>({ key: 'spend', direction: 'desc' });

  const handleSort = (key: string) => {
    if (key === 'campaign_name' || key === 'media_source') {
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
    return [...filteredCampaigns].sort((a, b) => {
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
  }, [filteredCampaigns, sortConfig]);

  const visibleColumnDefs = CAMPAIGN_COLUMN_DEFINITIONS.filter(col => visibleColumns.has(col.key));

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) {
      return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortConfig.direction === 'asc'
      ? <ChevronUp className="h-3 w-3 ml-1" />
      : <ChevronDown className="h-3 w-3 ml-1" />;
  };

  const columnsByCategory = useMemo(() => {
    const grouped: Record<string, CampaignColumnDef[]> = {};
    CAMPAIGN_COLUMN_DEFINITIONS.forEach(col => {
      if (!grouped[col.category]) grouped[col.category] = [];
      grouped[col.category].push(col);
    });
    return grouped;
  }, []);

  const categoryLabels: Record<string, string> = {
    core: 'Core Metrics',
    conversions: 'Conversions',
    revenue: 'Revenue',
  };

  const getPreviousMetric = (row: CampaignMetrics, key: string): number | undefined => {
    const prev = previousMap.get(getCampaignKey(row));
    return prev ? (prev as any)[key] : undefined;
  };

  return (
    <>
      <Helmet>
        <title>Campaign Performance | GrowthOS</title>
        <meta name="description" content="Analyze campaign performance with period-over-period comparisons" />
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            Campaign performance across all channels
          </p>
          <div className="flex items-center gap-2">
            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
              <SelectTrigger className="w-[180px] h-9">
                <Filter className="h-4 w-4 mr-2 opacity-50" />
                <SelectValue placeholder="All Channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                {mediaSourceOptions.map(source => (
                  <SelectItem key={source} value={source}>
                    {getMediaSourceLabel(source)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateRangeFilter
              selectedOption={dateOption}
              onChange={setDateOption}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
            />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KPICard
            title="Total Spend"
            value={`£${displayKpiData.totalSpend.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            change={displayKpiData.spendChange}
            icon={<DollarSign className="h-4 w-4" />}
          />
          <KPICard
            title="FTDs"
            value={displayKpiData.totalFtds.toLocaleString('en-GB')}
            change={displayKpiData.ftdsChange}
            icon={<Users className="h-4 w-4" />}
          />
          <KPICard
            title="CPA"
            value={`£${displayKpiData.cpa.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            change={displayKpiData.cpaChange}
            invertColors
            icon={<Target className="h-4 w-4" />}
          />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <CardTitle className="text-lg">
              Campaigns ({sortedData.length})
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
                          key={col.key}
                          className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent rounded-sm"
                          onClick={() => toggleColumn(col.key)}
                        >
                          <Checkbox
                            checked={visibleColumns.has(col.key)}
                            disabled={col.key === 'campaign_name'}
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
                    {visibleColumnDefs.map(col => (
                      <TableHead
                        key={col.key}
                        className={`cursor-pointer hover:bg-muted/50 whitespace-nowrap ${
                          col.key === 'campaign_name' ? 'sticky left-0 bg-background z-10' : ''
                        }`}
                        onClick={() => handleSort(col.key)}
                      >
                        <div className="flex items-center">
                          {col.label}
                          {getSortIcon(col.key)}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}>
                        {visibleColumnDefs.map(col => (
                          <TableCell key={col.key}>
                            <Skeleton className="h-4 w-20" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : sortedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={visibleColumnDefs.length} className="text-center py-8 text-muted-foreground">
                        No campaign data for this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedData.map((row, idx) => (
                      <TableRow key={idx}>
                        {visibleColumnDefs.map(col => {
                          const value = row[col.key];

                          if (col.key === 'campaign_name') {
                            return (
                              <TableCell key={col.key} className="sticky left-0 bg-background z-10 font-medium max-w-[250px] truncate">
                                {String(value)}
                              </TableCell>
                            );
                          }

                          if (col.key === 'media_source') {
                            return (
                              <TableCell key={col.key}>
                                <MediaSourceBadge source={String(value)} />
                              </TableCell>
                            );
                          }

                          const numValue = Number(value) || 0;
                          const prevValue = getPreviousMetric(row, col.key);
                          const change = getPoP(numValue, prevValue);
                          const invertColors = CAMPAIGN_COST_METRICS.has(col.key as keyof CampaignMetrics);

                          return (
                            <TableCell key={col.key} className="text-right">
                              <MetricCell
                                value={numValue}
                                formatted={formatValue(numValue, col.format)}
                                change={change}
                                invertColors={invertColors}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {selectedChannel === 'all' ? (
          <Report
            slug="daily_spend_by_channel"
            startDate={startDateStr}
            endDate={endDateStr}
          />
        ) : (
          <FilteredDailySpendChart chartData={chartData} selectedChannel={chartChannelForSource} startDate={startDateStr} endDate={endDateStr} />
        )}
      </div>
    </>
  );
}
