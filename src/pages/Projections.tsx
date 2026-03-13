import { useMemo } from 'react';
import { DollarSign, TrendingUp, Users, AlertCircle } from 'lucide-react';
import { KPICard } from '@/components/dashboard/KPICard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDailyAdSpend } from '@/hooks/useDailyAdSpend';
import { useDailyAffiliateSpend } from '@/hooks/useDailyAffiliateSpend';
import { useAffiliates } from '@/hooks/useAffiliates';
import { usePlatformBudgets } from '@/hooks/usePlatformBudgets';
import { useMixpanelDeposits } from '@/hooks/useMixpanel';
import { format, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';

const PLATFORM_NAMES: Record<string, string> = {
  meta: 'Meta Ads',
  apple: 'Apple Search Ads',
  moloco: 'Moloco',
};

export default function Projections() {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const daysInMonth = differenceInDays(monthEnd, monthStart) + 1;
  const daysPassed = differenceInDays(today, monthStart) + 1;
  const daysRemaining = daysInMonth - daysPassed;

  // Get current month spend data
  const startDateStr = format(monthStart, 'yyyy-MM-dd');
  const endDateStr = format(today, 'yyyy-MM-dd');
  
  const { data: dailySpend } = useDailyAdSpend(startDateStr, endDateStr);
  const { data: affiliateSpend } = useDailyAffiliateSpend(startDateStr, endDateStr);
  const { data: affiliates } = useAffiliates();
  const { budgets: platformBudgets, totalDailyBudget, isLoading: budgetsLoading } = usePlatformBudgets();
  const { data: depositsData } = useMixpanelDeposits(startDateStr, endDateStr);

  // Calculate current spend by platform
  const spendByPlatform = useMemo(() => {
    if (!dailySpend) return [];
    
    const byPlatform = new Map<string, number>();
    for (const day of dailySpend) {
      const platform = day.platform;
      byPlatform.set(platform, (byPlatform.get(platform) || 0) + day.spend);
    }
    
    return Array.from(byPlatform.entries())
      .map(([platform, spend]) => {
        // Find budget for this platform
        const budgetInfo = platformBudgets.find(b => b.platform === platform);
        const dailyBudget = budgetInfo?.totalDailyBudget || 0;
        const lifetimeBudget = budgetInfo?.totalLifetimeBudget || 0;
        
        return { 
          platform, 
          spend,
          dailyBudget,
          lifetimeBudget,
        };
      })
      .sort((a, b) => b.spend - a.spend);
  }, [dailySpend, platformBudgets]);

  // Calculate affiliate spend and caps
  const affiliateProjections = useMemo(() => {
    if (!affiliates || !affiliateSpend) return [];
    
    const spentByAffiliate = new Map<string, number>();
    for (const day of affiliateSpend) {
      spentByAffiliate.set(day.affiliate_id, (spentByAffiliate.get(day.affiliate_id) || 0) + day.spend);
    }
    
    return affiliates
      .filter(a => a.status === 'active' && a.monthly_cap && a.monthly_cap > 0)
      .map(affiliate => {
        const spent = spentByAffiliate.get(affiliate.id) || 0;
        const remaining = Math.max(0, (affiliate.monthly_cap || 0) - spent);
        const percentUsed = affiliate.monthly_cap ? (spent / affiliate.monthly_cap) * 100 : 0;
        return {
          name: affiliate.name,
          channel: affiliate.channel,
          monthlyCap: affiliate.monthly_cap || 0,
          spent,
          remaining,
          percentUsed,
        };
      })
      .sort((a, b) => b.remaining - a.remaining);
  }, [affiliates, affiliateSpend]);

  // Calculate totals
  const totalAdSpend = spendByPlatform.reduce((sum, p) => sum + p.spend, 0);
  const totalAffiliateSpent = affiliateProjections.reduce((sum, a) => sum + a.spent, 0);
  const totalAffiliateRemaining = affiliateProjections.reduce((sum, a) => sum + a.remaining, 0);
  const totalCurrentSpend = totalAdSpend + totalAffiliateSpent;

  // Calculate current MTD FTDs (from ad installs + affiliate FTDs)
  const mtdAdInstalls = dailySpend?.reduce((sum, d) => sum + d.installs, 0) || 0;
  const mtdAffiliateFTDs = affiliateSpend?.reduce((sum, d) => sum + d.ftds, 0) || 0;
  const currentMTDFTDs = mtdAdInstalls + mtdAffiliateFTDs;

  // Calculate average CPA
  const averageCPA = currentMTDFTDs > 0 ? totalCurrentSpend / currentMTDFTDs : 0;

  // Calculate net deposits per FTD from deposit events (filtered to current month)
  const mtdNetDeposits = depositsData?.totalAmount || 0;

  const netDepositsPerFTD = currentMTDFTDs > 0 ? mtdNetDeposits / currentMTDFTDs : 0;

  // Calculate yesterday's spend by platform for velocity-based projections
  const yesterdaySpendByPlatform = useMemo(() => {
    if (!dailySpend) return new Map<string, number>();
    
    const yesterday = format(new Date(today.getTime() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
    const byPlatform = new Map<string, number>();
    
    for (const day of dailySpend) {
      if (day.date === yesterday) {
        byPlatform.set(day.platform, (byPlatform.get(day.platform) || 0) + day.spend);
      }
    }
    
    return byPlatform;
  }, [dailySpend, today]);

  // Calculate projected spend based on yesterday's velocity (primary method)
  const projectedAdSpend = useMemo(() => {
    let projected = 0;
    
    for (const platform of spendByPlatform) {
      const yesterdaySpend = yesterdaySpendByPlatform.get(platform.platform) || 0;
      
      if (yesterdaySpend > 0) {
        // Primary: Use yesterday's spend as daily velocity
        projected += platform.spend + (yesterdaySpend * daysRemaining);
      } else if (platform.dailyBudget > 0) {
        // Fallback: Use daily budget for projection
        projected += platform.dailyBudget * daysInMonth;
      } else if (platform.lifetimeBudget > 0) {
        // Fallback: Use lifetime budget
        projected += Math.min(platform.lifetimeBudget, platform.spend + (platform.lifetimeBudget - platform.spend));
      } else {
        // Final fallback: Use daily average projection
        const dailyAvg = daysPassed > 0 ? platform.spend / daysPassed : 0;
        projected += dailyAvg * daysInMonth;
      }
    }
    
    return projected;
  }, [spendByPlatform, yesterdaySpendByPlatform, daysInMonth, daysRemaining, daysPassed]);

  const projectedTotalSpend = projectedAdSpend + totalAffiliateSpent + totalAffiliateRemaining;
  const monthlyBudgetCap = totalDailyBudget * daysInMonth;

  // Calculate remaining spend (projected - current)
  const remainingSpend = Math.max(0, projectedTotalSpend - totalCurrentSpend);

  // Projected FTDs by EOM = current MTD FTDs + (remaining spend / Average CPA)
  const additionalFTDs = averageCPA > 0 ? remainingSpend / averageCPA : 0;
  const projectedFTDsByEOM = Math.round(currentMTDFTDs + additionalFTDs);

  // Projected Net Deposits by EOM = total FTDs by EOM × net deposits per FTD × (30 / current days elapsed)
  const projectedNetDeposits = projectedFTDsByEOM * netDepositsPerFTD * (30 / daysPassed);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 cursor-help">
                  WIP
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[250px] text-center">
                <p>This page is still being developed. Data and calculations may change.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <p className="text-muted-foreground">
            {format(today, 'MMMM yyyy')} • Day {daysPassed} of {daysInMonth} ({daysRemaining} days remaining)
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <KPICard
          title="Projected Month End"
          value={`£${Math.round(projectedTotalSpend).toLocaleString()}`}
          icon={<TrendingUp className="h-5 w-5" />}
          variant="accent"
        />
        <KPICard
          title="Projected FTDs by EOM"
          value={projectedFTDsByEOM.toLocaleString()}
          icon={<Users className="h-5 w-5" />}
          subtitle={`Current: ${currentMTDFTDs.toLocaleString()} | Avg CPA: £${Math.round(averageCPA)}`}
        />
        <KPICard
          title="Projected Net Deposits"
          value={`£${Math.round(projectedNetDeposits).toLocaleString()}`}
          icon={<TrendingUp className="h-5 w-5" />}
          subtitle={`£${Math.round(netDepositsPerFTD)} per FTD`}
        />
      </div>

      {/* Month Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Month Progress</CardTitle>
          <CardDescription>Current spend vs projected end of month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Month Progress</span>
                <span className="text-muted-foreground">{daysPassed} / {daysInMonth} days</span>
              </div>
              <Progress value={(daysPassed / daysInMonth) * 100} className="h-3" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Spend Progress</span>
                <span className="text-muted-foreground">
                  £{Math.round(totalCurrentSpend).toLocaleString()} / £{Math.round(projectedTotalSpend).toLocaleString()} projected
                </span>
              </div>
              <Progress value={(totalCurrentSpend / projectedTotalSpend) * 100} className="h-3" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ad Platform Projections */}
      <Card>
        <CardHeader>
          <CardTitle>Ad Platform Spend</CardTitle>
          <CardDescription>Current month spend by platform with budget-based projections</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platform</TableHead>
                <TableHead className="text-right">Spent to Date</TableHead>
                <TableHead className="text-right">Daily Budget</TableHead>
                <TableHead className="text-right">Projected EOM</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {spendByPlatform.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No ad spend data available for this month
                  </TableCell>
                </TableRow>
              ) : (
                spendByPlatform.map((platform) => {
                  let projected: number;
                  let projectionSource: 'budget' | 'lifetime' | 'yesterday' | 'average';
                  const yesterdaySpend = yesterdaySpendByPlatform.get(platform.platform) || 0;
                  
                  if (yesterdaySpend > 0) {
                    // Primary: Use yesterday's spend as daily velocity
                    projected = platform.spend + (yesterdaySpend * daysRemaining);
                    projectionSource = 'yesterday';
                  } else if (platform.dailyBudget > 0) {
                    projected = platform.dailyBudget * daysInMonth;
                    projectionSource = 'budget';
                  } else if (platform.lifetimeBudget > 0) {
                    projected = platform.lifetimeBudget;
                    projectionSource = 'lifetime';
                  } else {
                    const dailyAvg = daysPassed > 0 ? platform.spend / daysPassed : 0;
                    projected = dailyAvg * daysInMonth;
                    projectionSource = 'average';
                  }
                  
                  const pacePercent = projected > 0 ? (platform.spend / (projected * (daysPassed / daysInMonth))) * 100 : 0;
                  const isOverpacing = pacePercent > 110;
                  const isUnderpacing = pacePercent < 90;
                  
                  return (
                    <TableRow key={platform.platform}>
                      <TableCell className="font-medium">
                        {PLATFORM_NAMES[platform.platform] || platform.platform}
                      </TableCell>
                      <TableCell className="text-right">£{Math.round(platform.spend).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        {platform.dailyBudget > 0 
                          ? `£${Math.round(platform.dailyBudget).toLocaleString()}`
                          : <span className="text-muted-foreground">—</span>
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          £{Math.round(projected).toLocaleString()}
                          <Badge variant="outline" className="text-xs">
                            {projectionSource === 'budget' ? 'Budget' : projectionSource === 'lifetime' ? 'Lifetime' : projectionSource === 'yesterday' ? 'Yesterday' : 'Avg'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {platform.dailyBudget > 0 ? (
                          <Badge 
                            variant={isOverpacing ? 'destructive' : 'default'}
                          >
                            {isOverpacing ? 'Overpacing' : isUnderpacing ? 'Underpacing' : 'On Track'}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">No budget set</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Affiliate Budget Tracking */}
      <Card>
        <CardHeader>
          <CardTitle>Affiliate Monthly Caps</CardTitle>
          <CardDescription>Budget utilization and remaining capacity</CardDescription>
        </CardHeader>
        <CardContent>
          {affiliateProjections.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No affiliates with monthly caps configured. Add monthly caps in Affiliate Settings.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {affiliateProjections.map((affiliate) => (
                <div key={affiliate.name} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <div>
                      <span className="font-medium">{affiliate.name}</span>
                      <span className="text-muted-foreground ml-2">({affiliate.channel})</span>
                    </div>
                    <span className="text-muted-foreground">
                      £{Math.round(affiliate.spent).toLocaleString()} / £{Math.round(affiliate.monthlyCap).toLocaleString()}
                      <span className="ml-2 text-xs">
                        (£{Math.round(affiliate.remaining).toLocaleString()} remaining)
                      </span>
                    </span>
                  </div>
                  <Progress 
                    value={affiliate.percentUsed} 
                    className={`h-2 ${affiliate.percentUsed > 90 ? '[&>div]:bg-destructive' : affiliate.percentUsed > 75 ? '[&>div]:bg-yellow-500' : ''}`}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
