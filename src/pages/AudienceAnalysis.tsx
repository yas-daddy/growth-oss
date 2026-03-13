import { useState, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { RefreshCw, Users, Target } from 'lucide-react';
import { useMetaDemographics } from '@/hooks/useMetaDemographics';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRangeFilter, DateRangeOption, CustomDateRange, getDateRange } from '@/components/DateRangeFilter';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const GENDER_COLORS: Record<string, string> = {
  male: 'hsl(200, 70%, 60%)',
  female: 'hsl(350, 70%, 65%)',
  unknown: 'hsl(0, 0%, 70%)',
};

const AGE_COLOR = 'hsl(142, 60%, 55%)';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatGender(gender: string): string {
  return gender.charAt(0).toUpperCase() + gender.slice(1);
}

export default function AudienceAnalysis() {
  const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>('last_7_days');
  const [customRange, setCustomRange] = useState<CustomDateRange>({ from: undefined, to: undefined });
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');

  const dateRange = getDateRange(dateRangeOption, customRange);
  const startDate = dateRange.startDate ? format(dateRange.startDate, 'yyyy-MM-dd') : undefined;
  const endDate = format(dateRange.endDate, 'yyyy-MM-dd');

  const { data, isLoading, refetch, isFetching } = useMetaDemographics(
    startDate,
    endDate,
    selectedCampaign !== 'all' ? selectedCampaign : undefined
  );

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (!data) return null;

    const topGenderPercent = data.topGender && data.totalSpend > 0
      ? (data.topGender.spend / data.totalSpend) * 100
      : 0;

    const topAgePercent = data.topAge && data.totalSpend > 0
      ? (data.topAge.spend / data.totalSpend) * 100
      : 0;

    const topAgeGenderPercent = data.topAgeGender && data.totalSpend > 0
      ? (data.topAgeGender.spend / data.totalSpend) * 100
      : 0;

    return {
      topGender: data.topGender ? formatGender(data.topGender.gender) : 'N/A',
      topGenderSpend: data.topGender?.spend || 0,
      topGenderPercent,
      topAge: data.topAge?.age || 'N/A',
      topAgeSpend: data.topAge?.spend || 0,
      topAgePercent,
      topAgeGender: data.topAgeGender
        ? `${data.topAgeGender.age} ${formatGender(data.topAgeGender.gender).toLowerCase()}`
        : 'N/A',
      topAgeGenderSpend: data.topAgeGender?.spend || 0,
      topAgeGenderPercent,
      topSegmentCpm: data.topAgeGender?.cpm || 0,
    };
  }, [data]);

  // Prepare chart data
  const genderChartData = useMemo(() => {
    if (!data?.genderBreakdown) return [];
    return data.genderBreakdown.map(item => ({
      name: formatGender(item.gender),
      value: item.spend,
      percent: data.totalSpend > 0 ? (item.spend / data.totalSpend) * 100 : 0,
      fill: GENDER_COLORS[item.gender] || GENDER_COLORS.unknown,
    }));
  }, [data]);

  const ageChartData = useMemo(() => {
    if (!data?.ageBreakdown) return [];
    // Sort by age group order
    const ageOrder = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
    return [...data.ageBreakdown].sort((a, b) => {
      const aIndex = ageOrder.indexOf(a.age);
      const bIndex = ageOrder.indexOf(b.age);
      return aIndex - bIndex;
    });
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Audience Analysis</h1>
          <p className="text-sm text-muted-foreground">
            {dateRange.label} • {startDate ? format(new Date(startDate), 'MMM d, yyyy') : 'All time'} to {format(new Date(endDate), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <DateRangeFilter
            selectedOption={dateRangeOption}
            onChange={setDateRangeOption}
            customRange={customRange}
            onCustomRangeChange={setCustomRange}
          />
        </div>
      </div>

      {/* Campaign Filter */}
      <Card>
        <CardContent className="py-3">
          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Campaigns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaigns</SelectItem>
              {data?.campaigns
                ?.filter(c => c.status === 'ACTIVE')
                .map(campaign => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              {data?.campaigns
                ?.filter(c => c.status !== 'ACTIVE')
                .map(campaign => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name} ({campaign.status})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Top Gender */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Top Gender</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <>
                    <p className="text-2xl font-bold">{kpis?.topGender}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(kpis?.topGenderSpend || 0)} ({kpis?.topGenderPercent.toFixed(1)}%)
                    </p>
                  </>
                )}
              </div>
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Top Age Group */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Top Age Group</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <>
                    <p className="text-2xl font-bold">{kpis?.topAge}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(kpis?.topAgeSpend || 0)} ({kpis?.topAgePercent.toFixed(1)}%)
                    </p>
                  </>
                )}
              </div>
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Top Age/Gender */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Top Age/Gender</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                    <p className="text-2xl font-bold">{kpis?.topAgeGender}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(kpis?.topAgeGenderSpend || 0)} ({kpis?.topAgeGenderPercent.toFixed(1)}%)
                    </p>
                  </>
                )}
              </div>
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Top Segment CPM */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Top Segment CPM</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <>
                    <p className="text-2xl font-bold">{formatCurrency(kpis?.topSegmentCpm || 0)}</p>
                    <p className="text-sm text-muted-foreground">
                      {kpis?.topAgeGender} CPM
                    </p>
                  </>
                )}
              </div>
              <Target className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gender Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Gender Distribution</CardTitle>
            <CardDescription>Overall gender distribution across all campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : genderChartData.length > 0 ? (
              <ChartContainer
                config={{
                  male: { label: 'Male', color: GENDER_COLORS.male },
                  female: { label: 'Female', color: GENDER_COLORS.female },
                  unknown: { label: 'Unknown', color: GENDER_COLORS.unknown },
                }}
                className="h-[300px] w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genderChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
                      labelLine={false}
                    >
                      {genderChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => formatCurrency(value as number)}
                        />
                      }
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => (
                        <span className="text-sm text-foreground">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Age Group Distribution Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Age Group Distribution</CardTitle>
            <CardDescription>Spend trends across age groups</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : ageChartData.length > 0 ? (
              <ChartContainer
                config={{
                  spend: { label: 'Spend', color: AGE_COLOR },
                }}
                className="h-[300px] w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageChartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <XAxis
                      dataKey="age"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      tickFormatter={(value) => `£${(value / 1000).toFixed(0)}k`}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-lg border bg-background p-3 shadow-md">
                            <p className="font-medium text-foreground mb-2">{data.age}</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Spend</span>
                                <span className="font-medium">{formatCurrency(data.spend)}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Results</span>
                                <span className="font-medium">{data.results?.toLocaleString() ?? 0}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">CPA</span>
                                <span className="font-medium">
                                  {data.costPerResult != null ? formatCurrency(data.costPerResult) : 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="spend"
                      fill={AGE_COLOR}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
