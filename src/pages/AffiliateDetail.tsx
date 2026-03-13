import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, Users, TrendingUp, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { KPICard } from '@/components/dashboard/KPICard';
import { DateRangeFilter, DateRangeOption, CustomDateRange, getDateRange } from '@/components/DateRangeFilter';
import { AffiliateLinkDialog } from '@/components/affiliates/AffiliateLinkDialog';
import { useAffiliates } from '@/hooks/useAffiliates';
import { useDailyAffiliateSpend } from '@/hooks/useDailyAffiliateSpend';
import { useAppsFlyerEvents } from '@/hooks/useAppsFlyerCampaigns';
import { useDailyAppsFlyerInstalls, useDailyAppsFlyerClicks } from '@/hooks/useDailyAppsFlyerMetrics';
import { useQualityRanking } from '@/hooks/useQualityRanking';
import { QualityBadge } from '@/components/QualityBadge';
import { format, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';

export default function AffiliateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const daysInMonth = differenceInDays(monthEnd, monthStart) + 1;
  const daysPassed = differenceInDays(today, monthStart) + 1;
  
  const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>('mtd');
  const [customRange, setCustomRange] = useState<CustomDateRange>({ from: undefined, to: undefined });

  const dateRange = getDateRange(dateRangeOption, customRange);
  const startDateStr = dateRange.startDate ? format(dateRange.startDate, 'yyyy-MM-dd') : '2020-01-01';
  const endDateStr = format(dateRange.endDate, 'yyyy-MM-dd');

  const { data: affiliates = [], isLoading: affiliatesLoading } = useAffiliates();
  const { data: allAffiliateSpend = [], isLoading: spendLoading } = useDailyAffiliateSpend(
    startDateStr,
    endDateStr
  );
  const { data: ftdEvents = [], isLoading: eventsLoading } = useAppsFlyerEvents('first_time_deposit', startDateStr, endDateStr);
  const { data: signupEvents = [], isLoading: signupsLoading } = useAppsFlyerEvents('signup_completed', startDateStr, endDateStr);
  const { getCampaignRanking, getChannelRanking, isLoading: rankingLoading } = useQualityRanking(startDateStr, endDateStr);

  const affiliate = affiliates.find(a => a.id === id);
  const channelRanking = affiliate?.channel ? getChannelRanking(affiliate.channel) : null;
  
  // Fetch installs and clicks filtered by affiliate's channel
  const { data: dailyInstalls = [], isLoading: installsLoading } = useDailyAppsFlyerInstalls(startDateStr, endDateStr, affiliate?.channel);
  const { data: dailyClicks = [], isLoading: clicksLoading } = useDailyAppsFlyerClicks(startDateStr, endDateStr, affiliate?.channel);

  // Filter spend data for this specific affiliate
  const affiliateSpend = useMemo(() => {
    if (!id) return [];
    return allAffiliateSpend.filter(s => s.affiliate_id === id);
  }, [allAffiliateSpend, id]);

  // Build campaign performance data with FTDs, signups, installs, clicks
  const campaignData = useMemo(() => {
    if (!affiliate?.channel) return [];
    
    // Group FTD events by campaign
    const ftdByCampaign = new Map<string, number>();
    for (const event of ftdEvents.filter(e => e.media_source === affiliate.channel)) {
      const campaign = event.campaign_name || 'Unknown Campaign';
      ftdByCampaign.set(campaign, (ftdByCampaign.get(campaign) || 0) + event.event_count);
    }
    
    // Group signup events by campaign
    const signupByCampaign = new Map<string, number>();
    for (const event of signupEvents.filter(e => e.media_source === affiliate.channel)) {
      const campaign = event.campaign_name || 'Unknown Campaign';
      signupByCampaign.set(campaign, (signupByCampaign.get(campaign) || 0) + event.event_count);
    }
    
    // Group installs by campaign
    const installsByCampaign = new Map<string, number>();
    for (const record of dailyInstalls) {
      const campaign = record.campaign_name || 'Unknown Campaign';
      installsByCampaign.set(campaign, (installsByCampaign.get(campaign) || 0) + record.installs);
    }
    
    // Group clicks by campaign
    const clicksByCampaign = new Map<string, number>();
    for (const record of dailyClicks) {
      const campaign = record.campaign_name || 'Unknown Campaign';
      clicksByCampaign.set(campaign, (clicksByCampaign.get(campaign) || 0) + record.clicks);
    }
    
    // Get all unique campaigns
    const allCampaigns = new Set<string>([
      ...ftdByCampaign.keys(),
      ...signupByCampaign.keys(),
      ...installsByCampaign.keys(),
      ...clicksByCampaign.keys(),
    ]);
    
    return Array.from(allCampaigns)
      .map(campaign => ({
        campaign,
        ftds: ftdByCampaign.get(campaign) || 0,
        signups: signupByCampaign.get(campaign) || 0,
        installs: installsByCampaign.get(campaign) || 0,
        clicks: clicksByCampaign.get(campaign) || 0,
      }))
      .sort((a, b) => b.ftds - a.ftds);
  }, [ftdEvents, signupEvents, dailyInstalls, dailyClicks, affiliate?.channel]);

  // Calculate total FTDs from campaign data (same source as campaign table)
  const totalFTDsFromEvents = useMemo(() => {
    return campaignData.reduce((sum, c) => sum + c.ftds, 0);
  }, [campaignData]);

  // Calculate totals - spend is FTD × CPA for this affiliate
  const affiliateCPA = affiliate?.cpa || 0;
  const totalFTDs = totalFTDsFromEvents; // Use events-based count for consistency with campaign table
  const totalSpend = totalFTDs * affiliateCPA;
  const uniqueDays = new Set(ftdEvents.filter(e => e.media_source === affiliate?.channel).map(e => e.event_date)).size || 1;
  const avgDailySpend = totalSpend / uniqueDays;
  const avgDailyFTDs = totalFTDs / uniqueDays;
  
  // Monthly cap progress (use current month data)
  const monthlyCap = affiliate?.monthly_cap || 0;
  const monthlyCapProgress = monthlyCap > 0 ? (totalSpend / monthlyCap) * 100 : 0;
  const budgetRemaining = Math.max(0, monthlyCap - totalSpend);

  // Calculate selected date range duration
  const selectedRangeDays = dateRange.startDate 
    ? differenceInDays(dateRange.endDate, dateRange.startDate) + 1 
    : Infinity;
  const showMonthlyBudget = selectedRangeDays <= 31;

  // Projected end of month spend
  const projectedMonthSpend = avgDailySpend * daysInMonth;
  const willExceedCap = monthlyCap > 0 && projectedMonthSpend > monthlyCap;

  // Group daily data for the table - combine installs, clicks, signups, FTDs from AppsFlyer, and calculate spend as FTD × CPA
  const dailyData = useMemo(() => {
    const cpa = affiliate?.cpa || 0;
    const byDate = new Map<string, { ftds: number; spend: number; installs: number; clicks: number; signups: number }>();
    
    // Add installs
    for (const record of dailyInstalls) {
      const existing = byDate.get(record.date) || { ftds: 0, spend: 0, installs: 0, clicks: 0, signups: 0 };
      existing.installs += record.installs;
      byDate.set(record.date, existing);
    }
    
    // Add clicks
    for (const record of dailyClicks) {
      const existing = byDate.get(record.date) || { ftds: 0, spend: 0, installs: 0, clicks: 0, signups: 0 };
      existing.clicks += record.clicks;
      byDate.set(record.date, existing);
    }
    
    // Add signups from events (grouped by date)
    for (const event of signupEvents.filter(e => e.media_source === affiliate?.channel)) {
      const existing = byDate.get(event.event_date) || { ftds: 0, spend: 0, installs: 0, clicks: 0, signups: 0 };
      existing.signups += event.event_count;
      byDate.set(event.event_date, existing);
    }
    
    // Add FTDs from AppsFlyer events and calculate spend as FTD × CPA
    for (const event of ftdEvents.filter(e => e.media_source === affiliate?.channel)) {
      const existing = byDate.get(event.event_date) || { ftds: 0, spend: 0, installs: 0, clicks: 0, signups: 0 };
      existing.ftds += event.event_count;
      existing.spend += event.event_count * cpa;
      byDate.set(event.event_date, existing);
    }
    
    return Array.from(byDate.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [dailyInstalls, dailyClicks, signupEvents, ftdEvents, affiliate?.channel, affiliate?.cpa]);

  const isLoading = affiliatesLoading || spendLoading || eventsLoading || signupsLoading || installsLoading || clicksLoading || rankingLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!affiliate) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/settings/affiliates')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Affiliates
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold mb-2">Affiliate not found</h2>
            <p className="text-muted-foreground">The affiliate you're looking for doesn't exist.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-success/10 text-success border-success/30">Active</Badge>;
      case 'paused':
        return <Badge variant="secondary">Paused</Badge>;
      case 'inactive':
        return <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button 
          variant="ghost" 
          className="w-fit -ml-2"
          onClick={() => navigate('/settings/affiliates')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Affiliates
        </Button>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight">{affiliate.name}</h1>
              {getStatusBadge(affiliate.status)}
            </div>
            <p className="text-muted-foreground">
              Channel: <code className="text-xs bg-muted px-2 py-1 rounded">{affiliate.channel}</code>
              {affiliate.contact_email && (
                <span className="ml-4">Contact: {affiliate.contact_email}</span>
              )}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <AffiliateLinkDialog 
              affiliateId={affiliate.id}
              affiliateName={affiliate.name}
              channel={affiliate.channel}
            />
            <DateRangeFilter
              selectedOption={dateRangeOption}
              onChange={setDateRangeOption}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
            />
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total FTDs"
          value={totalFTDs.toLocaleString()}
          icon={<Users className="h-5 w-5" />}
          variant="primary"
        />
        <KPICard
          title="Total Spend"
          value={`£${Math.round(totalSpend).toLocaleString()}`}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <KPICard
          title="Avg Daily FTDs"
          value={avgDailyFTDs.toFixed(1)}
          icon={<TrendingUp className="h-5 w-5" />}
          variant="accent"
        />
        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">User Quality</p>
                <div className="mt-2">
                  <QualityBadge rank={channelRanking} />
                </div>
              </div>
              <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center">
                <Award className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Cap Progress - only show for date ranges ≤31 days */}
      {monthlyCap > 0 && showMonthlyBudget && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Budget Progress</CardTitle>
            <CardDescription>
              {format(monthStart, 'MMMM yyyy')} • Day {daysPassed} of {daysInMonth}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Budget Utilization</span>
                <span className="text-muted-foreground">
                  £{Math.round(totalSpend).toLocaleString()} / £{Math.round(monthlyCap).toLocaleString()}
                </span>
              </div>
              <Progress 
                value={Math.min(monthlyCapProgress, 100)} 
                className={`h-3 ${monthlyCapProgress > 90 ? '[&>div]:bg-destructive' : monthlyCapProgress > 75 ? '[&>div]:bg-yellow-500' : ''}`}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{monthlyCapProgress.toFixed(1)}% used</span>
                <span>£{Math.round(budgetRemaining).toLocaleString()} remaining</span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Avg Daily Spend</div>
                <div className="text-2xl font-bold">£{Math.round(avgDailySpend).toLocaleString()}</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Projected Month End</div>
                <div className={`text-2xl font-bold ${willExceedCap ? 'text-destructive' : ''}`}>
                  £{Math.round(projectedMonthSpend).toLocaleString()}
                </div>
                {willExceedCap && (
                  <div className="text-xs text-destructive mt-1">
                    Exceeds cap by £{Math.round(projectedMonthSpend - monthlyCap).toLocaleString()}
                  </div>
                )}
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Days Until Cap</div>
                <div className="text-2xl font-bold">
                  {avgDailySpend > 0 
                    ? Math.round(budgetRemaining / avgDailySpend)
                    : '—'
                  }
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaign Performance Table */}
      {campaignData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Campaign Performance</CardTitle>
            <CardDescription>
              Campaign metrics from AppsFlyer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Installs</TableHead>
                  <TableHead className="text-right">Signups</TableHead>
                  <TableHead className="text-right">FTDs</TableHead>
                  <TableHead className="text-right">Quality</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaignData.map((row) => {
                  const campaignRank = affiliate?.channel ? getCampaignRanking(affiliate.channel, row.campaign) : null;
                  return (
                    <TableRow key={row.campaign}>
                      <TableCell className="font-medium">{row.campaign}</TableCell>
                      <TableCell className="text-right">{row.clicks.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.installs.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.signups.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.ftds.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <QualityBadge rank={campaignRank} size="sm" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Daily Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Performance</CardTitle>
          <CardDescription>
            Daily metrics breakdown
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dailyData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No data available for the selected date range
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Installs</TableHead>
                  <TableHead className="text-right">Signups</TableHead>
                  <TableHead className="text-right">FTDs</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyData.map((day) => (
                  <TableRow key={day.date}>
                    <TableCell className="font-medium">
                      {format(new Date(day.date), 'EEE, MMM d')}
                    </TableCell>
                    <TableCell className="text-right">{day.clicks.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{day.installs.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{day.signups.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{day.ftds}</TableCell>
                    <TableCell className="text-right font-mono">
                      £{Math.round(day.spend).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Notes Section */}
      {affiliate.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{affiliate.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
