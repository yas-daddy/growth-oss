import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, TrendingUp, TrendingDown, Users, DollarSign, Target, Star, Download } from 'lucide-react';
import { useMonthlyMetrics, useCalculateMonthlyMetrics, formatMonthLabel, MonthlyMetric, MonthlyRange } from '@/hooks/useMonthlyMetrics';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, ComposedChart, Cell } from 'recharts';
import { ChartExportButton } from '@/components/charts/ChartExportButton';
import { MonthlySummaryExportButton } from '@/components/charts/MonthlySummaryExportButton';
import { generateCsv, downloadCsv, MetricRow } from '@/lib/exportCsv';
import { useResolvedTrackerMetrics } from '@/hooks/useTrackerMetricConfig';
import { groupMetricsBySection, formatMetricValue } from '@/lib/trackerMetricDefinitions';
import { ConnectProvidersAlert } from '@/components/ConnectProvidersAlert';

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

// Helper functions for incomplete month display
function isCurrentMonth(monthStart: string): boolean {
  const monthDate = new Date(monthStart);
  const now = new Date();
  return monthDate.getMonth() === now.getMonth() && monthDate.getFullYear() === now.getFullYear();
}

function isPastTwelfthOfMonth(): boolean {
  return new Date().getDate() >= 12;
}

function shouldShowCurrentMonth(): boolean {
  return isPastTwelfthOfMonth();
}

// Get the number of complete months to fetch based on range and current date
// For 3m: always show 3 complete months, plus current month if past 12th
function getCompletedMonthsForRange(range: MonthlyRange): number {
  const baseMonths = range === '3m' ? 3 : range === '6m' ? 6 : range === '12m' ? 12 : 12;
  // If past 12th, current month will be shown too, so we need baseMonths complete months
  // If before 12th, we hide current month but still need baseMonths complete months
  return baseMonths;
}

// Calculate MoM change percentage (comparing to previous month in the metrics array)
function getMoMChange(metrics: MonthlyMetric[], index: number, getValue: (m: MonthlyMetric) => number): number | null {
  if (index >= metrics.length - 1) return null;
  const current = getValue(metrics[index]);
  const previous = getValue(metrics[index + 1]);
  if (!previous || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// Render a cell with MoM comparison
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

// Get all unique channels from monthly data
function getAllChannels(metrics: MonthlyMetric[]): string[] {
  const channels = new Set<string>();
  metrics.forEach(m => {
    Object.keys(m.spend_by_channel || {}).forEach(c => channels.add(c));
  });
  return Array.from(channels).sort();
}

// Get all unique affiliates from monthly data
function getAllAffiliates(metrics: MonthlyMetric[]): { id: string; name: string }[] {
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

const RANGE_OPTIONS: { value: MonthlyRange; label: string }[] = [
  { value: '3m', label: 'Last 3 Months' },
  { value: '6m', label: 'Last 6 Months' },
  { value: '12m', label: 'Last 12 Months' },
  { value: 'ytd', label: 'Year to Date' },
];

export default function MonthlyTracker() {
  const [range, setRange] = useState<MonthlyRange>('3m');
  const { data: metrics = [], isLoading } = useMonthlyMetrics(range);
  const calculateMutation = useCalculateMonthlyMetrics();
  const { metrics: trackerMetrics } = useResolvedTrackerMetrics();
  
  // Chart refs for PNG export
  const ftdsCpaChartRef = useRef<HTMLDivElement>(null);
  const spendRoasChartRef = useRef<HTMLDivElement>(null);
  const funnelChartRef = useRef<HTMLDivElement>(null);
  const depositsChartRef = useRef<HTMLDivElement>(null);

  const handleRecalculate = () => {
    calculateMutation.mutate(12); // Calculate last 12 months
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Get completed months (exclude current incomplete month)
  const completedMonths = metrics.filter(m => !isCurrentMonth(m.month_start));
  
  // Get current incomplete month if it exists
  const currentMonthMetric = metrics.find(m => isCurrentMonth(m.month_start));
  
  // Calculate how many complete months we need based on range
  const neededCompleteMonths = getCompletedMonthsForRange(range);
  
  // For charts: show N complete months, plus current month if past 12th (with dimmed styling)
  const chartCompleteMonths = completedMonths.slice(0, neededCompleteMonths);
  const displayMetrics = shouldShowCurrentMonth() && currentMonthMetric
    ? [currentMonthMetric, ...chartCompleteMonths]
    : chartCompleteMonths;

  // For summary table (only shown for 3m): show 3 complete months + current month if past 12th
  const summaryMetrics = shouldShowCurrentMonth() && currentMonthMetric
    ? [currentMonthMetric, ...completedMonths.slice(0, 3)]
    : completedMonths.slice(0, 3);

  // Reverse for chronological order in charts
  const chronologicalMetrics = [...displayMetrics].reverse();
  const channels = getAllChannels(displayMetrics);
  const affiliates = getAllAffiliates(displayMetrics);

  // Prepare chart data with incomplete month flag
  const chartData = chronologicalMetrics.map(m => ({
    month: formatMonthLabel(m.month_start),
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
    isIncomplete: isCurrentMonth(m.month_start),
  }));

  const spendByChannelData = chronologicalMetrics.map(m => ({
    month: formatMonthLabel(m.month_start),
    ...m.spend_by_channel,
    Affiliates: m.total_affiliate_spend,
    roas: m.roas,
    isIncomplete: isCurrentMonth(m.month_start),
  }));

  // Aggregate KPIs: sum of selected period vs equivalent previous period
  // For 3m view showing Oct,Nov,Dec: compare to Jul,Aug,Sep
  const aggregateMetrics = (metricsToSum: MonthlyMetric[]) => {
    return metricsToSum.reduce((acc, m) => ({
      total_ftds: acc.total_ftds + m.total_ftds,
      total_spend: acc.total_spend + m.total_spend,
      ftd_cohort_deposits: acc.ftd_cohort_deposits + m.ftd_cohort_deposits,
      new_users_net_deposits: acc.new_users_net_deposits + m.new_users_net_deposits,
    }), { total_ftds: 0, total_spend: 0, ftd_cohort_deposits: 0, new_users_net_deposits: 0 });
  };

  // Current period = the displayed complete months (exclude current incomplete month for fair comparison)
  const currentPeriodMonths = completedMonths.slice(0, neededCompleteMonths);
  // Previous period = the N months before the current period
  const previousPeriodMonths = completedMonths.slice(neededCompleteMonths, neededCompleteMonths * 2);
  
  const currentAggregate = aggregateMetrics(currentPeriodMonths);
  const previousAggregate = aggregateMetrics(previousPeriodMonths);
  
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

  const hasComparison = previousPeriodMonths.length === currentPeriodMonths.length && previousPeriodMonths.length > 0;

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <ConnectProvidersAlert />
      <div className="flex flex-col gap-3 md:gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p className="text-sm md:text-base text-muted-foreground">
            Month-over-month performance metrics and trends
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Select value={range} onValueChange={(v) => setRange(v as MonthlyRange)}>
              <SelectTrigger className="w-[140px] md:w-[180px]">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={handleRecalculate} 
              disabled={calculateMutation.isPending}
              variant="outline"
              size="sm"
            >
              {calculateMutation.isPending ? (
                <Loader2 className="h-4 w-4 md:mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 md:mr-2" />
              )}
              <span className="hidden md:inline">Recalculate</span>
            </Button>
          </div>
        </div>
      </div>

      {metrics.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No monthly metrics calculated yet.</p>
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
          {currentPeriodMonths.length > 0 && (
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

          {/* Monthly Summary Table - Only shown for 3 month view */}
          {range === '3m' && summaryMetrics.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-6">
                <div>
                  <CardTitle className="text-sm md:text-base">Monthly Summary</CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    {shouldShowCurrentMonth() ? 'Last 3 complete months + current month (incomplete)' : 'Last 3 complete months'}
                  </CardDescription>
                </div>
                <MonthlySummaryExportButton metrics={summaryMetrics} />
              </CardHeader>
              <CardContent className="p-0 md:p-6 md:pt-0">
                <div className="overflow-x-auto">
                  <div className="min-w-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs md:text-sm">Metric</TableHead>
                          {summaryMetrics.map((m) => {
                            const incomplete = isCurrentMonth(m.month_start);
                            return (
                              <TableHead 
                                key={m.id} 
                                className={`text-center text-xs md:text-sm ${incomplete ? 'opacity-50' : ''}`}
                              >
                                {formatMonthLabel(m.month_start)}
                                {incomplete && <span className="block text-[10px] font-normal">(incomplete)</span>}
                              </TableHead>
                            );
                          })}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium text-xs md:text-sm">Installs</TableCell>
                          {summaryMetrics.map((m, idx) => {
                            const incomplete = isCurrentMonth(m.month_start);
                            const change = idx < summaryMetrics.length - 1 
                              ? ((m.total_installs - summaryMetrics[idx + 1].total_installs) / summaryMetrics[idx + 1].total_installs) * 100 
                              : null;
                            return (
                              <TableCell key={m.id} className={`text-center ${incomplete ? 'opacity-50' : ''}`}>
                                <MetricCell value={m.total_installs} formatted={formatNumber(m.total_installs)} change={incomplete ? null : change} />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-xs md:text-sm">FTDs</TableCell>
                          {summaryMetrics.map((m, idx) => {
                            const incomplete = isCurrentMonth(m.month_start);
                            const change = idx < summaryMetrics.length - 1 
                              ? ((m.total_ftds - summaryMetrics[idx + 1].total_ftds) / summaryMetrics[idx + 1].total_ftds) * 100 
                              : null;
                            return (
                              <TableCell key={m.id} className={`text-center ${incomplete ? 'opacity-50' : ''}`}>
                                <MetricCell value={m.total_ftds} formatted={formatNumber(m.total_ftds)} change={incomplete ? null : change} />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-xs md:text-sm">STDs</TableCell>
                          {summaryMetrics.map((m, idx) => {
                            const incomplete = isCurrentMonth(m.month_start);
                            const change = idx < summaryMetrics.length - 1 
                              ? ((m.total_stds - summaryMetrics[idx + 1].total_stds) / summaryMetrics[idx + 1].total_stds) * 100 
                              : null;
                            return (
                              <TableCell key={m.id} className={`text-center ${incomplete ? 'opacity-50' : ''}`}>
                                <MetricCell value={m.total_stds} formatted={formatNumber(m.total_stds)} change={incomplete ? null : change} />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-xs md:text-sm">Cost per FTD</TableCell>
                          {summaryMetrics.map((m, idx) => {
                            const incomplete = isCurrentMonth(m.month_start);
                            const change = idx < summaryMetrics.length - 1 
                              ? ((m.blended_cpa - summaryMetrics[idx + 1].blended_cpa) / summaryMetrics[idx + 1].blended_cpa) * 100 
                              : null;
                            return (
                              <TableCell key={m.id} className={`text-center ${incomplete ? 'opacity-50' : ''}`}>
                                <MetricCell value={m.blended_cpa} formatted={formatCurrency(m.blended_cpa)} change={incomplete ? null : change} invertColors />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-xs md:text-sm">Net Deposit per New User</TableCell>
                          {summaryMetrics.map((m, idx) => {
                            const incomplete = isCurrentMonth(m.month_start);
                            const avgNetPerFtd = m.total_ftds > 0 ? m.new_users_net_deposits / m.total_ftds : 0;
                            const prevAvgNetPerFtd = idx < summaryMetrics.length - 1 && summaryMetrics[idx + 1].total_ftds > 0
                              ? summaryMetrics[idx + 1].new_users_net_deposits / summaryMetrics[idx + 1].total_ftds
                              : 0;
                            const change = idx < summaryMetrics.length - 1 && prevAvgNetPerFtd > 0
                              ? ((avgNetPerFtd - prevAvgNetPerFtd) / prevAvgNetPerFtd) * 100 
                              : null;
                            return (
                              <TableCell key={m.id} className={`text-center ${incomplete ? 'opacity-50' : ''}`}>
                                <MetricCell value={avgNetPerFtd} formatted={formatCurrencyDecimal(avgNetPerFtd)} change={incomplete ? null : change} />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Charts - horizontally scrollable on mobile */}
          <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
                <CardTitle className="text-sm md:text-base">Spend by Channel & ROAS</CardTitle>
                <ChartExportButton chartRef={spendRoasChartRef} filename="monthly-spend-roas-chart" />
              </CardHeader>
              <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
                <div className="overflow-x-auto -mx-3 md:mx-0 px-3 md:px-0">
                  <div ref={spendRoasChartRef} className="h-[250px] md:h-[300px] bg-background p-2 min-w-[400px] md:min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={spendByChannelData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-[10px] md:text-xs" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="left" className="text-[10px] md:text-xs" tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} width={45} tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="right" orientation="right" className="text-[10px] md:text-xs" tickFormatter={(v) => `${v.toFixed(1)}x`} width={35} tick={{ fontSize: 10 }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            fontSize: '12px'
                          }}
                          formatter={(value: number, name: string) => {
                            if (name === 'ROAS') return [value.toFixed(2) + 'x', name];
                            return [formatCurrency(value), name];
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        {channels.map((channel, idx) => (
                          <Bar 
                            key={channel} 
                            yAxisId="left" 
                            dataKey={channel} 
                            stackId="spend" 
                            fill={`hsl(var(--chart-${(idx % 5) + 1}))`} 
                            name={channel.charAt(0).toUpperCase() + channel.slice(1)} 
                          >
                            {spendByChannelData.map((entry, index) => (
                              <Cell 
                                key={`cell-${channel}-${index}`} 
                                fillOpacity={entry.isIncomplete ? 0.4 : 1} 
                              />
                            ))}
                          </Bar>
                        ))}
                        <Bar yAxisId="left" dataKey="Affiliates" stackId="spend" fill="hsl(30 100% 50%)" name="Affiliates">
                          {spendByChannelData.map((entry, index) => (
                            <Cell 
                              key={`cell-affiliates-${index}`} 
                              fillOpacity={entry.isIncomplete ? 0.4 : 1} 
                            />
                          ))}
                        </Bar>
                        <Line 
                          yAxisId="right" 
                          type="monotone" 
                          dataKey="roas" 
                          stroke="hsl(200 80% 60%)" 
                          strokeWidth={2} 
                          name="ROAS"
                          dot={(props: any) => {
                            const entry = spendByChannelData[props.index];
                            return (
                              <circle
                                cx={props.cx}
                                cy={props.cy}
                                r={4}
                                fill="hsl(200 80% 60%)"
                                fillOpacity={entry?.isIncomplete ? 0.4 : 1}
                              />
                            );
                          }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
                <CardTitle className="text-sm md:text-base">Conversion Funnel Rates</CardTitle>
                <ChartExportButton chartRef={funnelChartRef} filename="monthly-funnel-rates-chart" />
              </CardHeader>
              <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
                <div className="overflow-x-auto -mx-3 md:mx-0 px-3 md:px-0">
                  <div ref={funnelChartRef} className="h-[250px] md:h-[300px] bg-background p-2 min-w-[400px] md:min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chronologicalMetrics.map(m => ({
                        month: formatMonthLabel(m.month_start),
                        'Install → Signup': m.cvr_install_to_signup * 100,
                        'Signup → FTD': m.cvr_signup_to_ftd * 100,
                        'FTD → STD': m.cvr_ftd_to_std * 100,
                        isIncomplete: isCurrentMonth(m.month_start),
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-[10px] md:text-xs" tick={{ fontSize: 10 }} />
                        <YAxis className="text-[10px] md:text-xs" tickFormatter={(v) => `${v}%`} width={35} tick={{ fontSize: 10 }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            fontSize: '12px'
                          }}
                          formatter={(value: number) => [`${value.toFixed(1)}%`]}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line 
                          type="monotone" 
                          dataKey="Install → Signup" 
                          stroke="hsl(var(--chart-1))" 
                          strokeWidth={2}
                          dot={(props: any) => {
                            const data = chronologicalMetrics.map(m => ({
                              isIncomplete: isCurrentMonth(m.month_start)
                            }));
                            const entry = data[props.index];
                            return (
                              <circle
                                cx={props.cx}
                                cy={props.cy}
                                r={4}
                                fill="hsl(var(--chart-1))"
                                fillOpacity={entry?.isIncomplete ? 0.4 : 1}
                              />
                            );
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="Signup → FTD" 
                          stroke="hsl(var(--chart-2))" 
                          strokeWidth={2}
                          dot={(props: any) => {
                            const data = chronologicalMetrics.map(m => ({
                              isIncomplete: isCurrentMonth(m.month_start)
                            }));
                            const entry = data[props.index];
                            return (
                              <circle
                                cx={props.cx}
                                cy={props.cy}
                                r={4}
                                fill="hsl(var(--chart-2))"
                                fillOpacity={entry?.isIncomplete ? 0.4 : 1}
                              />
                            );
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="FTD → STD" 
                          stroke="hsl(var(--chart-3))" 
                          strokeWidth={2}
                          dot={(props: any) => {
                            const data = chronologicalMetrics.map(m => ({
                              isIncomplete: isCurrentMonth(m.month_start)
                            }));
                            const entry = data[props.index];
                            return (
                              <circle
                                cx={props.cx}
                                cy={props.cy}
                                r={4}
                                fill="hsl(var(--chart-3))"
                                fillOpacity={entry?.isIncomplete ? 0.4 : 1}
                              />
                            );
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
                <CardTitle className="text-sm md:text-base">New User Deposits</CardTitle>
                <ChartExportButton chartRef={depositsChartRef} filename="monthly-deposits-chart" />
              </CardHeader>
              <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
                <div className="overflow-x-auto -mx-3 md:mx-0 px-3 md:px-0">
                  <div ref={depositsChartRef} className="h-[250px] md:h-[300px] bg-background p-2 min-w-[400px] md:min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-[10px] md:text-xs" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="left" className="text-[10px] md:text-xs" tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} width={45} tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="right" orientation="right" className="text-[10px] md:text-xs" tickFormatter={(v) => `£${v.toFixed(0)}`} width={45} tick={{ fontSize: 10 }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            fontSize: '12px'
                          }}
                          formatter={(value: number, name: string) => [formatCurrency(value), name]}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar yAxisId="left" dataKey="deposits" fill="hsl(var(--chart-4))" name="New User Deposits">
                          {chartData.map((entry, index) => (
                            <Cell 
                              key={`cell-deposits-${index}`} 
                              fillOpacity={entry.isIncomplete ? 0.4 : 1} 
                            />
                          ))}
                        </Bar>
                        <Line 
                          yAxisId="right" 
                          type="monotone" 
                          dataKey="avgDeposit" 
                          stroke="hsl(var(--chart-2))" 
                          strokeWidth={2} 
                          name="Avg. Deposit per FTD"
                          dot={(props: any) => {
                            const entry = chartData[props.index];
                            return (
                              <circle
                                cx={props.cx}
                                cy={props.cy}
                                r={4}
                                fill="hsl(var(--chart-2))"
                                fillOpacity={entry?.isIncomplete ? 0.4 : 1}
                              />
                            );
                          }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Month-by-Month Metrics</CardTitle>
                <CardDescription>Detailed breakdown of all metrics by month</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const headers = metrics.map(m => formatMonthLabel(m.month_start));
                  const rows: MetricRow[] = trackerMetrics.map(def => ({
                    label: def.label,
                    values: metrics.map(m => {
                      const v = def.getValue(m);
                      return def.format === 'percent' ? (v * 100).toFixed(1) : 
                             def.format === 'currency' || def.format === 'currency_decimal' ? v.toFixed(2) :
                             def.format === 'multiplier' ? v.toFixed(2) : v;
                    }),
                  }));
                  const csv = generateCsv(headers, rows);
                  downloadCsv(csv, `monthly-metrics-${new Date().toISOString().split('T')[0]}`);
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0 md:p-6 md:pt-0">
              <div className="max-h-[70vh] overflow-auto">
                <Table className="min-w-[600px]">
                  <TableHeader className="sticky top-0 z-20 bg-background">
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-30 min-w-[100px] md:min-w-[120px] text-xs md:text-sm">Metric</TableHead>
                      {metrics.map(m => (
                        <TableHead key={m.month_start} className="text-center min-w-[80px] md:min-w-[100px] text-xs md:text-sm bg-background">
                          {formatMonthLabel(m.month_start)}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {/* Dynamic metric rows from tracker config */}
                  {groupMetricsBySection(trackerMetrics).map(({ section, metrics: sectionMetrics }) => (
                    <>
                      <TableRow key={`section-${section}`} className="bg-muted/30">
                        <TableCell className="sticky left-0 bg-muted/30 font-medium" colSpan={metrics.length + 1}>
                          {section}
                        </TableCell>
                      </TableRow>
                      {sectionMetrics.map(def => (
                        <TableRow key={def.key}>
                          <TableCell className={`sticky left-0 bg-background ${def.isBold ? 'font-medium' : ''}`}>
                            {def.format === 'rating' ? (
                              <span className="flex items-center gap-1"><Star className="h-3 w-3 text-warning fill-warning" />{def.label}</span>
                            ) : def.label}
                          </TableCell>
                          {metrics.map((m, idx) => {
                            const value = def.getValue(m);
                            const change = getMoMChange(metrics, idx, x => def.getValue(x));
                            return (
                              <TableCell key={m.month_start} className={`text-center ${def.isBold ? 'font-medium' : ''}`}>
                                <MetricCell
                                  value={value}
                                  formatted={formatMetricValue(value, def.format)}
                                  change={change}
                                  invertColors={def.invertColors}
                                />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </>
                  ))}

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
                          {metrics.map((m, idx) => {
                            const value = m.spend_by_channel?.[channel] || 0;
                            const change = getMoMChange(metrics, idx, x => x.spend_by_channel?.[channel] || 0);
                            return (
                              <TableCell key={m.month_start} className="text-center">
                                <MetricCell value={value} formatted={formatCurrency(value)} change={change} />
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
                        <TableRow key={`cpa-${channel}`}>
                          <TableCell className="sticky left-0 bg-background">{channel}</TableCell>
                          {metrics.map((m, idx) => {
                            const value = m.cpa_by_channel?.[channel] || 0;
                            const change = getMoMChange(metrics, idx, x => x.cpa_by_channel?.[channel] || 0);
                            return (
                              <TableCell key={m.month_start} className="text-center">
                                <MetricCell value={value} formatted={value > 0 ? formatCurrency(value) : '-'} change={change} invertColors />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </>
                  )}

                  {/* Affiliate Breakdown */}
                  {affiliates.length > 0 && (
                    <>
                      <TableRow className="bg-muted/30">
                        <TableCell className="sticky left-0 bg-muted/30 font-medium" colSpan={metrics.length + 1}>
                          Affiliate Spend
                        </TableCell>
                      </TableRow>
                      {affiliates.map(aff => (
                        <TableRow key={aff.id}>
                          <TableCell className="sticky left-0 bg-background">{aff.name}</TableCell>
                          {metrics.map((m, idx) => {
                            const value = m.affiliate_metrics?.[aff.id]?.spend || 0;
                            const change = getMoMChange(metrics, idx, x => x.affiliate_metrics?.[aff.id]?.spend || 0);
                            return (
                              <TableCell key={m.month_start} className="text-center">
                                <MetricCell value={value} formatted={formatCurrency(value)} change={change} />
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
