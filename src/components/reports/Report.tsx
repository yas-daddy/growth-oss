import { DollarSign, Users, TrendingUp, Zap, BarChart3, ArrowDownUp, Clock, Apple, Star, Play } from 'lucide-react';
import { KPICard } from '@/components/dashboard/KPICard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useReport, formatReportValue, ChartDataPoint, ReportData } from '@/hooks/useReport';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, Legend, CartesianGrid, Line, ComposedChart, LineChart } from 'recharts';
import { format, parseISO } from 'date-fns';

// Icon mapping
const ICON_MAP: Record<string, React.ReactNode> = {
  DollarSign: <DollarSign className="h-5 w-5" />,
  Users: <Users className="h-5 w-5" />,
  TrendingUp: <TrendingUp className="h-5 w-5" />,
  Zap: <Zap className="h-5 w-5" />,
  BarChart3: <BarChart3 className="h-5 w-5" />,
  ArrowDownUp: <ArrowDownUp className="h-5 w-5" />,
  Clock: <Clock className="h-5 w-5" />,
  Apple: <Apple className="h-5 w-5" />,
  Star: <Star className="h-5 w-5" />,
  Play: <Play className="h-5 w-5" />,
};

// Chart colors
const CHART_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

interface ReportProps {
  slug: string;
  startDate?: string;
  endDate?: string;
  prevStartDate?: string;
  prevEndDate?: string;
}

export function Report({ slug, startDate, endDate, prevStartDate, prevEndDate }: ReportProps) {
  const { definition, data, isLoading } = useReport(slug, {
    startDate,
    endDate,
    prevStartDate,
    prevEndDate,
  });

  if (isLoading || !definition) {
    return (
      <div className="p-6 rounded-xl border border-border bg-card">
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  // Render KPI card
  if (definition.report_type === 'kpi') {
    const config = definition.config;
    const icon = config.icon ? ICON_MAP[config.icon] : undefined;
    const kpiData = data as ReportData | null;
    
    // Special handling for rating format
    const isRating = config.format === 'rating';
    const formattedValue = kpiData 
      ? isRating 
        ? kpiData.value.toFixed(2) 
        : formatReportValue(kpiData.value, config.format) 
      : '—';

    // Render star rating display
    const renderStars = (rating: number) => {
      const fullStars = Math.floor(rating);
      const hasHalfStar = rating - fullStars >= 0.5;
      const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
      
      return (
        <div className="flex items-center gap-0.5 mt-1">
          {[...Array(fullStars)].map((_, i) => (
            <Star key={`full-${i}`} className="h-4 w-4 fill-amber-400 text-amber-400" />
          ))}
          {hasHalfStar && (
            <div className="relative">
              <Star className="h-4 w-4 text-muted-foreground/30" />
              <div className="absolute inset-0 overflow-hidden w-1/2">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              </div>
            </div>
          )}
          {[...Array(emptyStars)].map((_, i) => (
            <Star key={`empty-${i}`} className="h-4 w-4 text-muted-foreground/30" />
          ))}
        </div>
      );
    };

    return (
      <KPICard
        title={definition.name}
        value={formattedValue}
        change={kpiData?.change}
        icon={icon}
        variant={config.variant}
        invertColors={config.invertColors}
        subtitle={config.subtitle}
        customContent={isRating && kpiData ? renderStars(kpiData.value) : undefined}
      />
    );
  }

  // Render chart
  if (definition.report_type === 'chart') {
    const config = definition.config;
    const chartData = data as ChartDataPoint[] | null;

    if (!chartData || chartData.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>{definition.name}</CardTitle>
            <CardDescription>{definition.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-center justify-center border border-dashed border-border rounded-lg bg-muted/30">
              <p className="text-sm text-muted-foreground">No data available</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    const total = chartData.reduce((sum, d) => sum + d.value, 0);
    const maxValue = Math.max(...chartData.map(d => d.value));

    // Stacked bar chart (time series)
    if (config.chartType === 'stacked_bar') {
      // Transform data for stacked bar chart: pivot by date
      const dateMap = new Map<string, Record<string, number>>();
      const channels = new Set<string>();
      
      chartData.forEach(item => {
        if (item.date) {
          if (!dateMap.has(item.date)) {
            dateMap.set(item.date, { date: item.date, dailyCpa: item.dailyCpa } as any);
          }
          const dateEntry = dateMap.get(item.date)!;
          dateEntry[item.channel] = item.value;
          // Use the first dailyCpa value for the date (they should all be the same)
          if (item.dailyCpa != null && dateEntry.dailyCpa == null) {
            dateEntry.dailyCpa = item.dailyCpa;
          }
          channels.add(item.channel);
        }
      });
      
      const stackedData = Array.from(dateMap.values()).sort((a, b) => 
        (a as any).date.localeCompare((b as any).date)
      );
      const channelList = Array.from(channels);
      
      // Check if we have CPA data
      const hasCpaData = stackedData.some((d: any) => d.dailyCpa != null && d.dailyCpa > 0);

      return (
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-base md:text-lg">{definition.name}</CardTitle>
            <CardDescription className="text-xs md:text-sm">{definition.description}</CardDescription>
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
                {hasCpaData && (
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
                    if (name === 'CPA') {
                      return [`£${value.toFixed(2)}`, name];
                    }
                    return [formatReportValue(value, config.valueFormat), name];
                  }}
                  labelFormatter={(label) => format(parseISO(label as string), 'EEE dd MMM yyyy')}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
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
                {hasCpaData && (
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
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      );
    }

    // Multi-line chart (time series with multiple channels)
    if (config.chartType === 'line_multi') {
      // Transform data: pivot by week/date with each channel as a series
      const xKey = config.xAxisKey || 'week_start';
      const yKey = config.yAxisKey || 'cpa';
      const seriesKey = config.seriesKey || 'channel';
      
      const timeMap = new Map<string, Record<string, number | string>>();
      const channels = new Set<string>();
      
      chartData.forEach(item => {
        const timeValue = (item as any)[xKey];
        if (timeValue) {
          if (!timeMap.has(timeValue)) {
            timeMap.set(timeValue, { [xKey]: timeValue });
          }
          const timeEntry = timeMap.get(timeValue)!;
          const channelName = (item as any)[seriesKey];
          const value = (item as any)[yKey];
          if (channelName && value != null) {
            timeEntry[channelName] = value;
            channels.add(channelName);
          }
        }
      });
      
      const lineData = Array.from(timeMap.values()).sort((a, b) => 
        String(a[xKey]).localeCompare(String(b[xKey]))
      );
      const channelList = Array.from(channels);

      return (
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-base md:text-lg">{definition.name}</CardTitle>
            <CardDescription className="text-xs md:text-sm">{definition.description}</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
            <ResponsiveContainer width="100%" height={280} className="md:!h-[350px]">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey={xKey}
                  tickFormatter={(value) => {
                    try {
                      return format(parseISO(value), 'dd MMM');
                    } catch {
                      return value;
                    }
                  }}
                  className="text-[10px] md:text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                />
                <YAxis 
                  tickFormatter={(value) => `£${Math.round(value)}`}
                  className="text-[10px] md:text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  width={50}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [`£${value.toFixed(2)}`, name]}
                  labelFormatter={(label) => {
                    try {
                      return format(parseISO(label as string), 'EEE dd MMM yyyy');
                    } catch {
                      return label;
                    }
                  }}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                {channelList.map((channel, index) => (
                  <Line 
                    key={channel}
                    type="monotone"
                    dataKey={channel}
                    name={channel}
                    stroke={CHART_COLORS[index % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ fill: CHART_COLORS[index % CHART_COLORS.length], strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      );
    }

    // Pie chart
    if (config.chartType === 'pie') {
      return (
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-base md:text-lg">{definition.name}</CardTitle>
            <CardDescription className="text-xs md:text-sm">{definition.description}</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
            <ResponsiveContainer width="100%" height={250} className="md:!h-[300px]">
              <PieChart>
                <Pie
                  data={chartData.map(d => ({ name: d.channel, value: d.value }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => {
                    const formatted = formatReportValue(value, config.valueFormat);
                    if (config.showPercentage && total > 0) {
                      const percent = ((value / total) * 100).toFixed(1);
                      return [`${formatted} (${percent}%)`];
                    }
                    return [formatted];
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      );
    }

    // Bar chart (horizontal progress bars)
    return (
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base md:text-lg">{definition.name}</CardTitle>
          <CardDescription className="text-xs md:text-sm">{definition.description}</CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
          <div className="space-y-3 md:space-y-4">
            {chartData.slice(0, 8).map((item, index) => {
              const percentage = total > 0 ? (item.value / total) * 100 : 0;
              const barWidth = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
              const formattedValue = formatReportValue(item.value, config.valueFormat);

              return (
                <div key={item.channel} className="space-y-1.5 md:space-y-2">
                  <div className="flex items-center justify-between text-xs md:text-sm">
                    <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
                      <span className="font-medium truncate">{item.channel}</span>
                      {item.channelType === 'affiliate' && (
                        <span className="text-[9px] md:text-[10px] px-1 md:px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 flex-shrink-0">
                          Affiliate
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground flex-shrink-0 ml-2">
                      {formattedValue}
                      {config.showPercentage && total > 0 && (
                        <span className="ml-1 text-[10px] md:text-xs">({percentage.toFixed(1)}%)</span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 md:h-2 rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full transition-all duration-500"
                      style={{ 
                        width: `${barWidth}%`,
                        backgroundColor: CHART_COLORS[index % CHART_COLORS.length]
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
