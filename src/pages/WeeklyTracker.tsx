import { useState, useRef, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, TrendingUp, TrendingDown, Users, DollarSign, Target, Star, Download } from 'lucide-react';
import { useWeeklyMetrics, useCalculateWeeklyMetrics, formatWeekLabel, WeeklyMetric } from '@/hooks/useWeeklyMetrics';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, ComposedChart, Cell } from 'recharts';
import { ChartExportButton } from '@/components/charts/ChartExportButton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { generateCsv, downloadCsv, MetricRow } from '@/lib/exportCsv';
import { useResolvedTrackerMetrics } from '@/hooks/useTrackerMetricConfig';
import { groupMetricsBySection, formatMetricValue } from '@/lib/trackerMetricDefinitions';

type WeekRange = '3w' | '5w' | '8w';
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
}

function formatCurrencyDecimal(value: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-GB').format(Math.round(value));
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatRating(value: number): string {
  return value > 0 ? value.toFixed(2) : '-';
}

// Check if a week is the current week
function isCurrentWeek(weekStart: string): boolean {
  const weekDate = new Date(weekStart);
  const now = new Date();
  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(now.getDate() - now.getDay() + 1); // Monday of current week
  currentWeekStart.setHours(0, 0, 0, 0);
  weekDate.setHours(0, 0, 0, 0);
  return weekDate.getTime() === currentWeekStart.getTime();
}

// Check if today is Thursday or later in the week (Thu=4, Fri=5, Sat=6, Sun=0)
function isThursdayOrLater(): boolean {
  const day = new Date().getDay();
  return day === 0 || day >= 4; // Sunday (0) or Thursday-Saturday (4-6)
}

// Check if a week should be shown in charts (hide current week until Thursday)
function shouldShowInChart(weekStart: string): boolean {
  if (!isCurrentWeek(weekStart)) return true;
  return isThursdayOrLater();
}

// Check if a week is incomplete (current week shown after Thursday)
function isIncompleteWeek(weekStart: string): boolean {
  return isCurrentWeek(weekStart) && isThursdayOrLater();
}

// Calculate WoW change percentage (comparing to previous week in the metrics array)
function getWoWChange(metrics: WeeklyMetric[], index: number, getValue: (m: WeeklyMetric) => number): number | null {
  if (index >= metrics.length - 1) return null;
  const current = getValue(metrics[index]);
  const previous = getValue(metrics[index + 1]);
  if (!previous || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// Render a cell with WoW comparison
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
    <div className="flex flex-col items-center">
      <span>{formatted}</span>
      {hasChange && (
        <span className={`text-[10px] ${colorClass}`}>
          {isPositive ? '+' : ''}{Math.round(change)}%
        </span>
      )}
    </div>
  );
}

// Get all unique channels from weekly data
function getAllChannels(metrics: WeeklyMetric[]): string[] {
  const channels = new Set<string>();
  metrics.forEach(m => {
    Object.keys(m.spend_by_channel || {}).forEach(c => channels.add(c));
  });
  return Array.from(channels).sort();
}

// Get all unique affiliates from weekly data
function getAllAffiliates(metrics: WeeklyMetric[]): { id: string; name: string }[] {
  const affiliates = new Map<string, string>();
  metrics.forEach(m => {
    Object.entries(m.affiliate_metrics || {}).forEach(([id, data]) => {
      if (!affiliates.has(id)) {
        affiliates.set(id, data.name);
      }
    });
  });
  return Array.from(affiliates.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export default function WeeklyTracker() {
  const { data: allMetrics = [], isLoading } = useWeeklyMetrics();
  const calculateMutation = useCalculateWeeklyMetrics();
  const { metrics: trackerMetrics } = useResolvedTrackerMetrics();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview', 'charts']));
  const [weekRange, setWeekRange] = useState<WeekRange>('3w');
  
  // Filter metrics based on selected week range
  const metrics = useMemo(() => {
    const weekCounts: Record<WeekRange, number> = { '3w': 3, '5w': 5, '8w': 8 };
    return allMetrics.slice(0, weekCounts[weekRange]);
  }, [allMetrics, weekRange]);
  
  // Chart refs for PNG export
  const ftdsCpaChartRef = useRef<HTMLDivElement>(null);
  const spendRoasChartRef = useRef<HTMLDivElement>(null);
  const funnelChartRef = useRef<HTMLDivElement>(null);
  const depositsChartRef = useRef<HTMLDivElement>(null);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleRecalculate = () => {
    calculateMutation.mutate(8); // Calculate last 8 weeks
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Reverse for chronological order in charts, filter out current week if before Thursday
  const chronologicalMetrics = [...metrics].reverse().filter(m => shouldShowInChart(m.week_start));
  const channels = getAllChannels(metrics);
  const affiliates = getAllAffiliates(metrics);

  // Prepare chart data with incomplete week flag
  const chartData = chronologicalMetrics.map(m => ({
    week: formatWeekLabel(m.week_start),
    weekStart: m.week_start,
    isIncomplete: isIncompleteWeek(m.week_start),
    ftds: m.total_ftds,
    signups: m.total_signups,
    installs: m.total_installs,
    spend: m.total_spend,
    adSpend: m.total_ad_spend,
    affiliateSpend: m.total_affiliate_spend,
    blendedCPA: m.blended_cpa,
    deposits: m.ftd_cohort_deposits,
    avgDeposit: m.avg_deposit_per_ftd,
    roas: m.roas,
    rating: m.avg_rating,
  }));

  const spendByChannelData = chronologicalMetrics.map(m => ({
    week: formatWeekLabel(m.week_start),
    weekStart: m.week_start,
    isIncomplete: isIncompleteWeek(m.week_start),
    ...m.spend_by_channel,
    Affiliates: m.total_affiliate_spend,
    roas: m.roas,
  }));

  // Funnel chart data with incomplete flag
  const funnelChartData = chronologicalMetrics.map(m => ({
    week: formatWeekLabel(m.week_start),
    weekStart: m.week_start,
    isIncomplete: isIncompleteWeek(m.week_start),
    'Install → Signup': m.cvr_install_to_signup * 100,
    'Signup → FTD': m.cvr_signup_to_ftd * 100,
    'FTD → STD': m.cvr_ftd_to_std * 100,
  }));

  // Aggregate KPIs: sum of selected period vs equivalent previous period
  const aggregateMetrics = (metricsToSum: WeeklyMetric[]) => {
    return metricsToSum.reduce((acc, m) => ({
      total_ftds: acc.total_ftds + m.total_ftds,
      total_spend: acc.total_spend + m.total_spend,
      ftd_cohort_deposits: acc.ftd_cohort_deposits + m.ftd_cohort_deposits,
      new_users_net_deposits: acc.new_users_net_deposits + m.new_users_net_deposits,
    }), { total_ftds: 0, total_spend: 0, ftd_cohort_deposits: 0, new_users_net_deposits: 0 });
  };

  // Get number of weeks for current range
  const weekCounts: Record<WeekRange, number> = { '3w': 3, '5w': 5, '8w': 8 };
  const neededWeeks = weekCounts[weekRange];
  
  // Current period = the displayed weeks (exclude current incomplete week for fair comparison)
  const completeWeeks = metrics.filter(m => !isIncompleteWeek(m.week_start));
  const currentPeriodWeeks = completeWeeks.slice(0, neededWeeks);
  // Previous period = the N weeks before the current period
  const previousPeriodWeeks = completeWeeks.slice(neededWeeks, neededWeeks * 2);
  
  const currentAggregate = aggregateMetrics(currentPeriodWeeks);
  const previousAggregate = aggregateMetrics(previousPeriodWeeks);
  
  // Calculate blended CPA for aggregates
  const currentBlendedCPA = currentAggregate.total_ftds > 0 ? currentAggregate.total_spend / currentAggregate.total_ftds : 0;
  const previousBlendedCPA = previousAggregate.total_ftds > 0 ? previousAggregate.total_spend / previousAggregate.total_ftds : 0;
  
  // Calculate ROAS for aggregates
  const currentROAS = currentAggregate.total_spend > 0 ? currentAggregate.new_users_net_deposits / currentAggregate.total_spend : 0;
  const previousROAS = previousAggregate.total_spend > 0 ? previousAggregate.new_users_net_deposits / previousAggregate.total_spend : 0;

  const getChange = (current: number, prev: number): { value: number; positive: boolean } => {
    if (!prev || prev === 0) return { value: 0, positive: true };
    const change = ((current - prev) / prev) * 100;
    return { value: Math.abs(change), positive: change >= 0 };
  };

  const hasComparison = previousPeriodWeeks.length === currentPeriodWeeks.length && previousPeriodWeeks.length > 0;

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 md:gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p className="text-sm md:text-base text-muted-foreground">
            Week-over-week performance metrics and trends
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Select value={weekRange} onValueChange={(value: WeekRange) => setWeekRange(value)}>
              <SelectTrigger className="w-[130px] md:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3w">Last 3 weeks</SelectItem>
                <SelectItem value="5w">Last 5 weeks</SelectItem>
                <SelectItem value="8w">Last 8 weeks</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              onClick={handleRecalculate} 
              disabled={calculateMutation.isPending}
              variant="outline"
              size="sm"
              className="md:size-default"
            >
              {calculateMutation.isPending ? (
                <Loader2 className="h-4 w-4 md:mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 md:mr-2" />
              )}
              <span className="hidden md:inline">Recalculate Metrics</span>
            </Button>
          </div>
        </div>
      </div>

      {metrics.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No weekly metrics calculated yet.</p>
            <Button onClick={handleRecalculate} disabled={calculateMutation.isPending}>
              {calculateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Calculate Historical Metrics
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Overview KPIs - Aggregate sums for selected period vs previous period */}
          {currentPeriodWeeks.length > 0 && (
            <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium">Total FTDs</CardTitle>
                  <Users className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                  <div className="text-lg md:text-2xl font-bold">{formatNumber(currentAggregate.total_ftds)}</div>
                  {hasComparison && (
                    <p className={`text-[10px] md:text-xs ${getChange(currentAggregate.total_ftds, previousAggregate.total_ftds).positive ? 'text-success' : 'text-destructive'}`}>
                      {getChange(currentAggregate.total_ftds, previousAggregate.total_ftds).positive ? '+' : '-'}
                      {getChange(currentAggregate.total_ftds, previousAggregate.total_ftds).value.toFixed(1)}% vs prev period
                    </p>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium">Total Spend</CardTitle>
                  <DollarSign className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                  <div className="text-lg md:text-2xl font-bold">{formatCurrency(currentAggregate.total_spend)}</div>
                  {hasComparison && (
                    <p className={`text-[10px] md:text-xs ${!getChange(currentAggregate.total_spend, previousAggregate.total_spend).positive ? 'text-success' : 'text-destructive'}`}>
                      {getChange(currentAggregate.total_spend, previousAggregate.total_spend).positive ? '+' : '-'}
                      {getChange(currentAggregate.total_spend, previousAggregate.total_spend).value.toFixed(1)}% vs prev period
                    </p>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium">Blended CPA</CardTitle>
                  <Target className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                  <div className="text-lg md:text-2xl font-bold">{formatCurrency(currentBlendedCPA)}</div>
                  {hasComparison && (
                    <p className={`text-[10px] md:text-xs ${!getChange(currentBlendedCPA, previousBlendedCPA).positive ? 'text-success' : 'text-destructive'}`}>
                      {getChange(currentBlendedCPA, previousBlendedCPA).positive ? '+' : '-'}
                      {getChange(currentBlendedCPA, previousBlendedCPA).value.toFixed(1)}% vs prev period
                    </p>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium">ROAS</CardTitle>
                  <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                  <div className="text-lg md:text-2xl font-bold">{currentROAS.toFixed(2)}x</div>
                  {hasComparison && (
                    <p className={`text-[10px] md:text-xs ${getChange(currentROAS, previousROAS).positive ? 'text-success' : 'text-destructive'}`}>
                      {getChange(currentROAS, previousROAS).positive ? '+' : '-'}
                      {getChange(currentROAS, previousROAS).value.toFixed(1)}% vs prev period
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>FTDs & Blended CPA</CardTitle>
                <ChartExportButton chartRef={ftdsCpaChartRef} filename="ftds-cpa-chart" />
              </CardHeader>
              <CardContent>
                <div ref={ftdsCpaChartRef} className="h-[300px] bg-background p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="week" className="text-xs" />
                      <YAxis yAxisId="left" className="text-xs" tickFormatter={(v) => v.toLocaleString('en-GB')} />
                      <YAxis yAxisId="right" orientation="right" className="text-xs" tickFormatter={(v) => `£${v.toLocaleString('en-GB')}`} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))' 
                        }}
                        formatter={(value: number, name: string) => {
                          if (name === 'Blended CPA') return [formatCurrency(value), name];
                          return [formatNumber(value), name];
                        }}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="ftds" name="FTDs">
                        {chartData.map((entry, index) => (
                          <Cell 
                            key={`ftds-cell-${index}`} 
                            fill="hsl(var(--primary))" 
                            fillOpacity={entry.isIncomplete ? 0.4 : 1}
                          />
                        ))}
                      </Bar>
                      <Line 
                        yAxisId="right" 
                        type="monotone" 
                        dataKey="blendedCPA" 
                        stroke="hsl(var(--destructive))" 
                        strokeWidth={2} 
                        strokeDasharray={chartData.some(d => d.isIncomplete) ? undefined : undefined}
                        name="Blended CPA" 
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Spend by Channel & ROAS</CardTitle>
                <ChartExportButton chartRef={spendRoasChartRef} filename="spend-roas-chart" />
              </CardHeader>
              <CardContent>
                <div ref={spendRoasChartRef} className="h-[300px] bg-background p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={spendByChannelData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="week" className="text-xs" />
                      <YAxis yAxisId="left" className="text-xs" tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                      <YAxis yAxisId="right" orientation="right" className="text-xs" tickFormatter={(v) => `${v.toFixed(1)}x`} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))' 
                        }}
                        formatter={(value: number, name: string) => {
                          if (name === 'ROAS') return [value.toFixed(2) + 'x', name];
                          return [formatCurrency(value), name];
                        }}
                      />
                      <Legend />
                      {channels.map((channel, idx) => (
                        <Bar 
                          key={channel} 
                          yAxisId="left" 
                          dataKey={channel} 
                          stackId="spend" 
                          name={channel.charAt(0).toUpperCase() + channel.slice(1)} 
                        >
                          {spendByChannelData.map((entry, index) => (
                            <Cell 
                              key={`${channel}-cell-${index}`} 
                              fill={`hsl(var(--chart-${(idx % 5) + 1}))`}
                              fillOpacity={entry.isIncomplete ? 0.4 : 1}
                            />
                          ))}
                        </Bar>
                      ))}
                      <Bar yAxisId="left" dataKey="Affiliates" stackId="spend" name="Affiliates">
                        {spendByChannelData.map((entry, index) => (
                          <Cell 
                            key={`affiliates-cell-${index}`} 
                            fill="hsl(30 100% 50%)"
                            fillOpacity={entry.isIncomplete ? 0.4 : 1}
                          />
                        ))}
                      </Bar>
                      <Line yAxisId="right" type="monotone" dataKey="roas" stroke="hsl(200 80% 60%)" strokeWidth={2} name="ROAS" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Conversion Funnel Rates</CardTitle>
                <ChartExportButton chartRef={funnelChartRef} filename="funnel-rates-chart" />
              </CardHeader>
              <CardContent>
                <div ref={funnelChartRef} className="h-[300px] bg-background p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={funnelChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="week" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(v) => `${v}%`} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))' 
                        }}
                        formatter={(value: number) => [`${value.toFixed(1)}%`]}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="Install → Signup" 
                        stroke="hsl(var(--chart-1))" 
                        strokeWidth={2}
                        strokeOpacity={funnelChartData[funnelChartData.length - 1]?.isIncomplete ? 0.4 : 1}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Signup → FTD" 
                        stroke="hsl(var(--chart-2))" 
                        strokeWidth={2}
                        strokeOpacity={funnelChartData[funnelChartData.length - 1]?.isIncomplete ? 0.4 : 1}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="FTD → STD" 
                        stroke="hsl(var(--chart-3))" 
                        strokeWidth={2}
                        strokeOpacity={funnelChartData[funnelChartData.length - 1]?.isIncomplete ? 0.4 : 1}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>New User Deposits</CardTitle>
                <ChartExportButton chartRef={depositsChartRef} filename="deposits-chart" />
              </CardHeader>
              <CardContent>
                <div ref={depositsChartRef} className="h-[300px] bg-background p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="week" className="text-xs" />
                      <YAxis 
                        yAxisId="left" 
                        className="text-xs" 
                        tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
                      />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right" 
                        className="text-xs" 
                        tickFormatter={(v) => `£${v.toFixed(0)}`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))' 
                        }}
                        formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="deposits" name="New User Deposits">
                        {chartData.map((entry, index) => (
                          <Cell 
                            key={`deposits-cell-${index}`} 
                            fill="hsl(var(--chart-4))"
                            fillOpacity={entry.isIncomplete ? 0.4 : 1}
                          />
                        ))}
                      </Bar>
                      <Line yAxisId="right" type="monotone" dataKey="avgDeposit" stroke="hsl(var(--chart-2))" strokeWidth={2} name="Avg. Deposit per FTD" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Table */}
          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between space-y-2 md:space-y-0 p-3 md:p-6">
              <div>
                <CardTitle className="text-sm md:text-base">Week-by-Week Metrics</CardTitle>
                <CardDescription className="text-xs md:text-sm">Detailed breakdown of all metrics by week</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const headers = metrics.slice(0, 8).map(m => formatWeekLabel(m.week_start));
                  const rows: MetricRow[] = [
                    { label: 'Total Installs', values: metrics.slice(0, 8).map(m => m.total_installs) },
                    { label: 'Total Signups', values: metrics.slice(0, 8).map(m => m.total_signups) },
                    { label: 'Total FTDs', values: metrics.slice(0, 8).map(m => m.total_ftds) },
                    { label: 'Total STDs', values: metrics.slice(0, 8).map(m => m.total_stds) },
                    { label: 'Install → Signup %', values: metrics.slice(0, 8).map(m => (m.cvr_install_to_signup * 100).toFixed(1)) },
                    { label: 'Signup → FTD %', values: metrics.slice(0, 8).map(m => (m.cvr_signup_to_ftd * 100).toFixed(1)) },
                    { label: 'FTD → STD %', values: metrics.slice(0, 8).map(m => (m.cvr_ftd_to_std * 100).toFixed(1)) },
                    { label: 'Install → STD %', values: metrics.slice(0, 8).map(m => (m.cvr_install_to_std * 100).toFixed(1)) },
                    { label: 'Total Ad Spend', values: metrics.slice(0, 8).map(m => m.total_ad_spend.toFixed(2)) },
                    { label: 'Total Affiliate Spend', values: metrics.slice(0, 8).map(m => m.total_affiliate_spend.toFixed(2)) },
                    { label: 'Total Spend', values: metrics.slice(0, 8).map(m => m.total_spend.toFixed(2)) },
                    { label: 'Blended CAC', values: metrics.slice(0, 8).map(m => m.blended_cac.toFixed(2)) },
                    { label: 'Blended CPA', values: metrics.slice(0, 8).map(m => m.blended_cpa.toFixed(2)) },
                    { label: 'FTD Cohort Deposits', values: metrics.slice(0, 8).map(m => m.ftd_cohort_deposits.toFixed(2)) },
                    { label: 'Avg Deposit / FTD', values: metrics.slice(0, 8).map(m => m.avg_deposit_per_ftd.toFixed(2)) },
                    { label: 'Ad Spend / £1k Deposit', values: metrics.slice(0, 8).map(m => m.ad_spend_per_1k_deposit.toFixed(2)) },
                    { label: 'Net Deposits New Users', values: metrics.slice(0, 8).map(m => m.net_deposits_new_users.toFixed(2)) },
                    { label: 'New Users Net Deposits', values: metrics.slice(0, 8).map(m => m.new_users_net_deposits.toFixed(2)) },
                    { label: 'ROAS', values: metrics.slice(0, 8).map(m => m.roas.toFixed(2)) },
                    { label: 'Avg Rating', values: metrics.slice(0, 8).map(m => m.avg_rating.toFixed(2)) },
                  ];
                  const csv = generateCsv(headers, rows);
                  downloadCsv(csv, `weekly-metrics-${new Date().toISOString().split('T')[0]}`);
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                <span className="hidden md:inline">Download CSV</span>
                <span className="md:hidden">CSV</span>
              </Button>
            </CardHeader>
            <CardContent className="p-0 md:p-6 md:pt-0">
              <div className="max-h-[70vh] overflow-auto">
                  <Table className="min-w-[600px]">
                    <TableHeader className="sticky top-0 z-20 bg-background">
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background z-30 min-w-[100px] md:min-w-[120px] text-xs md:text-sm">Metric</TableHead>
                        {metrics.slice(0, 8).map(m => (
                          <TableHead key={m.week_start} className="text-center min-w-[80px] md:min-w-[100px] text-xs md:text-sm bg-background">
                            {formatWeekLabel(m.week_start)}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                <TableBody>
                  {/* Funnel Metrics */}
                  <TableRow className="bg-muted/30">
                    <TableCell className="sticky left-0 bg-muted/30 font-medium" colSpan={metrics.length + 1}>
                      Funnel Metrics
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background">Total Installs</TableCell>
                    {metrics.slice(0, 8).map((m, idx) => (
                      <TableCell key={m.week_start} className="text-center">
                        <MetricCell 
                          value={m.total_installs} 
                          formatted={formatNumber(m.total_installs)} 
                          change={getWoWChange(metrics, idx, x => x.total_installs)} 
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background">Total Signups</TableCell>
                    {metrics.slice(0, 8).map((m, idx) => (
                      <TableCell key={m.week_start} className="text-center">
                        <MetricCell 
                          value={m.total_signups} 
                          formatted={formatNumber(m.total_signups)} 
                          change={getWoWChange(metrics, idx, x => x.total_signups)} 
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background">Total FTDs</TableCell>
                    {metrics.slice(0, 8).map((m, idx) => (
                      <TableCell key={m.week_start} className="text-center">
                        <MetricCell 
                          value={m.total_ftds} 
                          formatted={formatNumber(m.total_ftds)} 
                          change={getWoWChange(metrics, idx, x => x.total_ftds)} 
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background">Total STDs</TableCell>
                    {metrics.slice(0, 8).map((m, idx) => (
                      <TableCell key={m.week_start} className="text-center">
                        <MetricCell 
                          value={m.total_stds} 
                          formatted={formatNumber(m.total_stds)} 
                          change={getWoWChange(metrics, idx, x => x.total_stds)} 
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background">Total HVPs</TableCell>
                    {metrics.slice(0, 8).map((m, idx) => (
                      <TableCell key={m.week_start} className="text-center">
                        <MetricCell 
                          value={m.total_hvps} 
                          formatted={formatNumber(m.total_hvps)} 
                          change={getWoWChange(metrics, idx, x => x.total_hvps)} 
                        />
                      </TableCell>
                    ))}
                  </TableRow>

                  {/* Conversion Rates */}
                  <TableRow className="bg-muted/30">
                    <TableCell className="sticky left-0 bg-muted/30 font-medium" colSpan={metrics.length + 1}>
                      Conversion Rates
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background">Install → Signup</TableCell>
                    {metrics.slice(0, 8).map((m, idx) => (
                      <TableCell key={m.week_start} className="text-center">
                        <MetricCell 
                          value={m.cvr_install_to_signup} 
                          formatted={formatPercent(m.cvr_install_to_signup)} 
                          change={getWoWChange(metrics, idx, x => x.cvr_install_to_signup)} 
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background">Signup → FTD</TableCell>
                    {metrics.slice(0, 8).map((m, idx) => (
                      <TableCell key={m.week_start} className="text-center">
                        <MetricCell 
                          value={m.cvr_signup_to_ftd} 
                          formatted={formatPercent(m.cvr_signup_to_ftd)} 
                          change={getWoWChange(metrics, idx, x => x.cvr_signup_to_ftd)} 
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background">FTD → STD</TableCell>
                    {metrics.slice(0, 8).map((m, idx) => (
                      <TableCell key={m.week_start} className="text-center">
                        <MetricCell 
                          value={m.cvr_ftd_to_std} 
                          formatted={formatPercent(m.cvr_ftd_to_std)} 
                          change={getWoWChange(metrics, idx, x => x.cvr_ftd_to_std)} 
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background">Install → STD</TableCell>
                    {metrics.slice(0, 8).map((m, idx) => (
                      <TableCell key={m.week_start} className="text-center">
                        <MetricCell 
                          value={m.cvr_install_to_std} 
                          formatted={formatPercent(m.cvr_install_to_std)} 
                          change={getWoWChange(metrics, idx, x => x.cvr_install_to_std)} 
                        />
                      </TableCell>
                    ))}
                  </TableRow>

                  {/* Spend Metrics */}
                  <TableRow className="bg-muted/30">
                    <TableCell className="sticky left-0 bg-muted/30 font-medium" colSpan={metrics.length + 1}>
                      Spend
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background">Total Ad Spend</TableCell>
                    {metrics.slice(0, 8).map((m, idx) => (
                      <TableCell key={m.week_start} className="text-center">
                        <MetricCell 
                          value={m.total_ad_spend} 
                          formatted={formatCurrency(m.total_ad_spend)} 
                          change={getWoWChange(metrics, idx, x => x.total_ad_spend)} 
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background">Total Affiliate Spend</TableCell>
                    {metrics.slice(0, 8).map((m, idx) => (
                      <TableCell key={m.week_start} className="text-center">
                        <MetricCell 
                          value={m.total_affiliate_spend} 
                          formatted={formatCurrency(m.total_affiliate_spend)} 
                          change={getWoWChange(metrics, idx, x => x.total_affiliate_spend)} 
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background font-medium">Total Spend</TableCell>
                    {metrics.slice(0, 8).map((m, idx) => (
                      <TableCell key={m.week_start} className="text-center font-medium">
                        <MetricCell 
                          value={m.total_spend} 
                          formatted={formatCurrency(m.total_spend)} 
                          change={getWoWChange(metrics, idx, x => x.total_spend)} 
                        />
                      </TableCell>
                    ))}
                  </TableRow>

                  {/* Cost Metrics */}
                  <TableRow className="bg-muted/30">
                    <TableCell className="sticky left-0 bg-muted/30 font-medium" colSpan={metrics.length + 1}>
                      Cost Metrics
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background">Blended CAC</TableCell>
                    {metrics.slice(0, 8).map((m, idx) => (
                      <TableCell key={m.week_start} className="text-center">
                        <MetricCell 
                          value={m.blended_cac} 
                          formatted={formatCurrencyDecimal(m.blended_cac)} 
                          change={getWoWChange(metrics, idx, x => x.blended_cac)} 
                          invertColors 
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background">Blended CPA</TableCell>
                    {metrics.slice(0, 8).map((m, idx) => (
                      <TableCell key={m.week_start} className="text-center">
                        <MetricCell 
                          value={m.blended_cpa} 
                          formatted={formatCurrencyDecimal(m.blended_cpa)} 
                          change={getWoWChange(metrics, idx, x => x.blended_cpa)} 
                          invertColors 
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background">Blended Cost / HVP</TableCell>
                    {metrics.slice(0, 8).map((m, idx) => (
                      <TableCell key={m.week_start} className="text-center">
                        <MetricCell 
                          value={m.cost_per_hvp} 
                          formatted={formatCurrencyDecimal(m.cost_per_hvp)} 
                          change={getWoWChange(metrics, idx, x => x.cost_per_hvp)} 
                          invertColors 
                        />
                      </TableCell>
                    ))}
                  </TableRow>

                  {/* Revenue Metrics */}
                  <TableRow className="bg-muted/30">
                    <TableCell className="sticky left-0 bg-muted/30 font-medium" colSpan={metrics.length + 1}>
                      Revenue
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background">FTD Cohort Deposits</TableCell>
                    {metrics.slice(0, 8).map((m, idx) => (
                      <TableCell key={m.week_start} className="text-center">
                        <MetricCell 
                          value={m.ftd_cohort_deposits} 
                          formatted={formatCurrency(m.ftd_cohort_deposits)} 
                          change={getWoWChange(metrics, idx, x => x.ftd_cohort_deposits)} 
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background">Avg Deposit / FTD</TableCell>
                    {metrics.slice(0, 8).map((m, idx) => (
                      <TableCell key={m.week_start} className="text-center">
                        <MetricCell 
                          value={m.avg_deposit_per_ftd} 
                          formatted={formatCurrency(m.avg_deposit_per_ftd)} 
                          change={getWoWChange(metrics, idx, x => x.avg_deposit_per_ftd)} 
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background">Ad Spend / £1k Deposit</TableCell>
                    {metrics.slice(0, 8).map((m, idx) => (
                      <TableCell key={m.week_start} className="text-center">
                        <MetricCell 
                          value={m.ad_spend_per_1k_deposit} 
                          formatted={formatCurrency(m.ad_spend_per_1k_deposit)} 
                          change={getWoWChange(metrics, idx, x => x.ad_spend_per_1k_deposit)} 
                          invertColors 
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background">Net Deposits (AF LTV)</TableCell>
                    {metrics.slice(0, 8).map((m, idx) => (
                      <TableCell key={m.week_start} className="text-center">
                        <MetricCell 
                          value={m.net_deposits_new_users} 
                          formatted={formatCurrency(m.net_deposits_new_users)} 
                          change={getWoWChange(metrics, idx, x => x.net_deposits_new_users)} 
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background font-medium">New Users Net Deposits</TableCell>
                    {metrics.slice(0, 8).map((m, idx) => (
                      <TableCell key={m.week_start} className="text-center font-medium">
                        <MetricCell 
                          value={m.new_users_net_deposits} 
                          formatted={formatCurrency(m.new_users_net_deposits)} 
                          change={getWoWChange(metrics, idx, x => x.new_users_net_deposits)} 
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background">ROAS</TableCell>
                    {metrics.slice(0, 8).map((m, idx) => (
                      <TableCell key={m.week_start} className="text-center">
                        <MetricCell 
                          value={m.roas} 
                          formatted={`${m.roas.toFixed(2)}x`} 
                          change={getWoWChange(metrics, idx, x => x.roas)} 
                        />
                      </TableCell>
                    ))}
                  </TableRow>

                  {/* Ratings */}
                  <TableRow className="bg-muted/30">
                    <TableCell className="sticky left-0 bg-muted/30 font-medium" colSpan={metrics.length + 1}>
                      Ratings
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-background">Avg Rating (Weighted)</TableCell>
                    {metrics.slice(0, 8).map((m, idx) => (
                      <TableCell key={m.week_start} className="text-center">
                        <div className="flex flex-col items-center">
                          <span className="flex items-center justify-center gap-1">
                            <Star className="h-3 w-3 text-warning fill-warning" />
                            {formatRating(m.avg_rating)}
                          </span>
                          {(() => {
                            const change = getWoWChange(metrics, idx, x => x.avg_rating);
                            if (change === null || !isFinite(change)) return null;
                            const isPositive = change >= 0;
                            return (
                              <span className={`text-[10px] ${isPositive ? 'text-success' : 'text-destructive'}`}>
                                {isPositive ? '+' : ''}{Math.round(change)}%
                              </span>
                            );
                          })()}
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>

                  {/* Channel Spend Breakdown */}
                  {channels.length > 0 && (
                    <>
                      <TableRow className="bg-muted/30">
                        <TableCell className="sticky left-0 bg-muted/30 font-medium" colSpan={metrics.length + 1}>
                          Spend by Channel
                        </TableCell>
                      </TableRow>
                      {channels.map(channel => (
                        <TableRow key={channel}>
                          <TableCell className="sticky left-0 bg-background">{channel}</TableCell>
                          {metrics.slice(0, 8).map((m, idx) => {
                            const value = m.spend_by_channel?.[channel] || 0;
                            const change = getWoWChange(metrics, idx, x => x.spend_by_channel?.[channel] || 0);
                            return (
                              <TableCell key={m.week_start} className="text-center">
                                <MetricCell 
                                  value={value} 
                                  formatted={formatCurrency(value)} 
                                  change={change} 
                                />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </>
                  )}

                  {/* Channel FTDs Breakdown */}
                  {channels.length > 0 && (
                    <>
                      <TableRow className="bg-muted/30">
                        <TableCell className="sticky left-0 bg-muted/30 font-medium" colSpan={metrics.length + 1}>
                          FTDs by Channel
                        </TableCell>
                      </TableRow>
                      {channels.map(channel => (
                        <TableRow key={channel}>
                          <TableCell className="sticky left-0 bg-background">{channel}</TableCell>
                          {metrics.slice(0, 8).map((m, idx) => {
                            const value = m.ftds_by_channel?.[channel] || 0;
                            const change = getWoWChange(metrics, idx, x => x.ftds_by_channel?.[channel] || 0);
                            return (
                              <TableCell key={m.week_start} className="text-center">
                                <MetricCell 
                                  value={value} 
                                  formatted={formatNumber(value)} 
                                  change={change} 
                                />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </>
                  )}

                  {/* Channel CPA Breakdown */}
                  {channels.length > 0 && (
                    <>
                      <TableRow className="bg-muted/30">
                        <TableCell className="sticky left-0 bg-muted/30 font-medium" colSpan={metrics.length + 1}>
                          CPA by Channel
                        </TableCell>
                      </TableRow>
                      {channels.map(channel => (
                        <TableRow key={channel}>
                          <TableCell className="sticky left-0 bg-background">{channel}</TableCell>
                          {metrics.slice(0, 8).map((m, idx) => {
                            const value = m.cpa_by_channel?.[channel] || 0;
                            const change = getWoWChange(metrics, idx, x => x.cpa_by_channel?.[channel] || 0);
                            return (
                              <TableCell key={m.week_start} className="text-center">
                                <MetricCell 
                                  value={value} 
                                  formatted={value ? formatCurrency(value) : '-'} 
                                  change={value ? change : null} 
                                  invertColors 
                                />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </>
                  )}

                  {/* Affiliate Spend Breakdown */}
                  {affiliates.length > 0 && (
                    <>
                      <TableRow className="bg-muted/30">
                        <TableCell className="sticky left-0 bg-muted/30 font-medium" colSpan={metrics.length + 1}>
                          Affiliate Spend
                        </TableCell>
                      </TableRow>
                      {affiliates.map(({ id, name }) => (
                        <TableRow key={id}>
                          <TableCell className="sticky left-0 bg-background">{name}</TableCell>
                          {metrics.slice(0, 8).map((m, idx) => {
                            const value = m.affiliate_metrics?.[id]?.spend || 0;
                            const change = getWoWChange(metrics, idx, x => x.affiliate_metrics?.[id]?.spend || 0);
                            return (
                              <TableCell key={m.week_start} className="text-center">
                                <MetricCell 
                                  value={value} 
                                  formatted={formatCurrency(value)} 
                                  change={change} 
                                />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </>
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
