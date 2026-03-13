import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';

import { useAIKeywordRecommendations } from '@/hooks/useAIKeywordRecommendations';
import { useCreativeFatigueAnalysis } from '@/hooks/useCreativeFatigueAnalysis';
import { useBudgetRecommendations } from '@/hooks/useBudgetRecommendations';
import { useAdLaunchHistory } from '@/hooks/useAdLaunchHistory';
import { usePendingResponses, PendingResponse } from '@/hooks/usePendingResponses';
import { useDailyAdSpend } from '@/hooks/useDailyAdSpend';
import { useDailyAffiliateSpend } from '@/hooks/useDailyAffiliateSpend';
import { useAffiliates } from '@/hooks/useAffiliates';
import { usePlatformBudgets } from '@/hooks/usePlatformBudgets';
import { useCPAThresholds } from '@/hooks/useCPAThresholds';
import { usePageVisitTracker } from '@/hooks/usePageVisitTracker';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { BarChart, Bar, ResponsiveContainer } from 'recharts';
import { PendingResponseDialog } from '@/components/ratings/PendingResponseDialog';
import { 
  DollarSign,
  Search,
  Film,
  Image,
  MessageSquare,
  ChevronRight
} from 'lucide-react';

// Mini spend chart component - sparkline style stacked bar
function MiniSpendChart({ 
  data, 
  shouldAnimate 
}: { 
  data: Array<{ date: string; meta: number; apple: number; moloco: number; affiliates: number }>;
  shouldAnimate: boolean;
}) {
  if (!data || data.length === 0) return null;
  
  return (
    <div 
      className={cn(
        "h-[60px] transition-opacity duration-500",
        shouldAnimate ? "opacity-100" : "opacity-0"
      )}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Bar dataKey="meta" stackId="1" fill="hsl(var(--chart-1))" fillOpacity={0.8} />
          <Bar dataKey="apple" stackId="1" fill="hsl(var(--chart-2))" fillOpacity={0.8} />
          <Bar dataKey="moloco" stackId="1" fill="hsl(var(--chart-3))" fillOpacity={0.8} />
          <Bar dataKey="affiliates" stackId="1" fill="hsl(var(--chart-4))" fillOpacity={0.8} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getFirstName(fullName?: string | null): string {
  if (!fullName) return 'there';
  return fullName.split(' ')[0] || 'there';
}

// Enhanced animated number hook with trigger and decimal support
function useAnimatedNumber(
  target: number, 
  duration: number = 1200,
  shouldStart: boolean = true,
  decimals: number = 0
): string | number {
  const [current, setCurrent] = useState(0);
  
  useEffect(() => {
    if (!shouldStart) {
      setCurrent(0);
      return;
    }
    
    if (target === 0) {
      setCurrent(0);
      return;
    }
    
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      setCurrent(target * easeOut);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCurrent(target);
      }
    };
    
    requestAnimationFrame(animate);
  }, [target, duration, shouldStart]);
  
  if (decimals > 0) {
    return current.toFixed(decimals);
  }
  return Math.round(current);
}

// Compact Score Gauge for Home page - simplified without tier text
function ScoreGaugeCompact({ score, multiplier, shouldAnimate }: { score: number; multiplier: number; shouldAnimate: boolean }) {
  const displayScore = useAnimatedNumber(score, 1500, shouldAnimate);
  
  const maxScore = 500;
  const targetPercentage = Math.min(100, Math.max(0, (score / maxScore) * 100));
  const currentPercentage = shouldAnimate ? targetPercentage : 0;
  
  const centerX = 100;
  const centerY = 100;
  const radius = 70;
  const startAngle = -180;
  const endAngle = 0;
  const totalAngle = endAngle - startAngle;
  const needleRotation = startAngle + (currentPercentage / 100) * totalAngle;
  const needleLength = radius - 15;

  const ticks = [];
  const numTicks = 20;
  const tickColors = [
    "#ef4444", "#ef4444", "#ef4444", "#ef4444",
    "#f97316", "#f97316", "#f97316", "#f97316",
    "#f59e0b", "#f59e0b", "#f59e0b", "#f59e0b",
    "#84cc16", "#84cc16", "#84cc16", "#84cc16",
    "#22c55e", "#22c55e", "#22c55e", "#22c55e",
  ];

  for (let i = 0; i <= numTicks; i++) {
    const angle = startAngle + (i / numTicks) * totalAngle;
    const innerRadius = radius - 15;
    const outerRadius = radius - 5;
    
    const x1 = centerX + innerRadius * Math.cos((angle * Math.PI) / 180);
    const y1 = centerY + innerRadius * Math.sin((angle * Math.PI) / 180);
    const x2 = centerX + outerRadius * Math.cos((angle * Math.PI) / 180);
    const y2 = centerY + outerRadius * Math.sin((angle * Math.PI) / 180);
    
    ticks.push({ x1, y1, x2, y2, color: tickColors[Math.min(i, tickColors.length - 1)] });
  }

  return (
    <div className="relative w-full bg-slate-900 rounded-xl p-4">
      <svg className="w-full max-w-[180px] mx-auto" viewBox="0 0 200 120" style={{ overflow: 'visible' }}>
        <path
          d={`M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={14}
          strokeLinecap="round"
        />
        
        {ticks.map((tick, i) => (
          <line
            key={i}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke={tick.color}
            strokeWidth={3}
            strokeLinecap="round"
          />
        ))}
        
        <g 
          style={{ 
            transformOrigin: `${centerX}px ${centerY}px`,
            transform: `rotate(${needleRotation}deg)`,
            transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <line
            x1={centerX}
            y1={centerY}
            x2={centerX + needleLength}
            y2={centerY}
            stroke="white"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </g>
        
        <circle cx={centerX} cy={centerY} r={5} fill="white" />
      </svg>
      
      <div className="text-center -mt-2">
        <div className="text-4xl font-bold text-white tracking-tight tabular-nums">
          {displayScore}
        </div>
        <div className="text-sm text-slate-300 font-medium">
          {multiplier.toFixed(1)}× efficiency
        </div>
      </div>
    </div>
  );
}

// CPA Thermometer component - shows yesterday and MTD CPA on a scale
function CPAThermometer({ 
  yesterdayCPA, 
  mtdCPA,
  yesterdayFTDs,
  mtdFTDs,
  isLoading,
  shouldAnimate,
  minCPA,
  maxCPA,
  targetCPA,
  greenThreshold,
  orangeThreshold
}: { 
  yesterdayCPA: number | null; 
  mtdCPA: number | null;
  yesterdayFTDs: number | null;
  mtdFTDs: number | null;
  isLoading: boolean;
  shouldAnimate: boolean;
  minCPA: number;
  maxCPA: number;
  targetCPA: number;
  greenThreshold: number;
  orangeThreshold: number;
}) {
  const [hasAnimated, setHasAnimated] = useState(false);
  const [yesterdayHovered, setYesterdayHovered] = useState(false);
  const [mtdHovered, setMtdHovered] = useState(false);
  
  // Animated values
  const animatedYesterdayCPA = useAnimatedNumber(yesterdayCPA ?? 0, 1200, shouldAnimate, 2);
  const animatedMtdCPA = useAnimatedNumber(mtdCPA ?? 0, 1200, shouldAnimate, 2);
  const animatedYesterdayFTDs = useAnimatedNumber(yesterdayFTDs ?? 0, 1200, shouldAnimate);
  const animatedMtdFTDs = useAnimatedNumber(mtdFTDs ?? 0, 1200, shouldAnimate);
  
  // Trigger pointer animation after mount and shouldAnimate
  useEffect(() => {
    if (shouldAnimate) {
      const timeout = setTimeout(() => {
        setHasAnimated(true);
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [shouldAnimate]);
  
  // Get color class based on CPA value and thresholds
  const getColorClass = (cpa: number | null): string => {
    if (cpa === null) return '';
    if (cpa <= greenThreshold) return 'text-green-500';
    if (cpa <= orangeThreshold) return 'text-orange-500';
    return 'text-red-500';
  };
  
  // Calculate position on the thermometer (0-100%)
  const getPosition = (cpa: number | null): number | null => {
    if (cpa === null) return null;
    const clampedCPA = Math.max(minCPA, Math.min(maxCPA, cpa));
    return ((clampedCPA - minCPA) / (maxCPA - minCPA)) * 100;
  };
  
  const yesterdayPos = getPosition(yesterdayCPA);
  const mtdPos = getPosition(mtdCPA);
  const targetPos = getPosition(targetCPA);
  
  if (isLoading) {
    return (
      <Card className="lg:col-span-2">
        <CardContent className="p-4">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-2">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-muted-foreground">CPA</span>
        </div>
        
        {/* Thermometer scale */}
        <div className="relative h-8 rounded-full bg-gradient-to-r from-green-500 via-orange-500 to-red-500 mb-4">
          {/* Target line */}
          {targetPos !== null && (
            <div 
              className="absolute top-0 h-full w-0.5 bg-white/80"
              style={{ left: `${targetPos}%` }}
            />
          )}
          
          {/* Yesterday marker - label on top, animated from left */}
          {yesterdayPos !== null && (
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-slate-800 shadow-lg z-10 cursor-pointer transition-all duration-1000 ease-out"
              style={{ left: hasAnimated ? `calc(${yesterdayPos}% - 8px)` : '-8px' }}
              onMouseEnter={() => setYesterdayHovered(true)}
              onMouseLeave={() => setYesterdayHovered(false)}
            >
              <div 
                className={cn(
                  "absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-foreground font-medium whitespace-nowrap transition-opacity duration-200",
                  yesterdayHovered ? "opacity-100" : "opacity-0"
                )}
              >
                Yesterday
              </div>
            </div>
          )}
          
          {/* MTD marker - label on bottom, animated from left */}
          {mtdPos !== null && (
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-800 border-2 border-white shadow-lg z-10 cursor-pointer transition-all duration-1000 ease-out"
              style={{ left: hasAnimated ? `calc(${mtdPos}% - 8px)` : '-8px' }}
              onMouseEnter={() => setMtdHovered(true)}
              onMouseLeave={() => setMtdHovered(false)}
            >
              <div 
                className={cn(
                  "absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-foreground font-medium whitespace-nowrap transition-opacity duration-200",
                  mtdHovered ? "opacity-100" : "opacity-0"
                )}
              >
                MTD
              </div>
            </div>
          )}
        </div>
        
        {/* Scale labels */}
        <div className="flex justify-between text-[10px] text-muted-foreground mt-2 mb-2">
          <span>£{minCPA}</span>
          <span>£{maxCPA}</span>
        </div>
        
        {/* Values display */}
        <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t">
          <div>
            <div className="text-xs text-muted-foreground">Yesterday</div>
            <div className={cn("text-xl font-bold tabular-nums", getColorClass(yesterdayCPA))}>
              {yesterdayCPA !== null ? `£${animatedYesterdayCPA}` : '—'}
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {yesterdayFTDs !== null ? `${animatedYesterdayFTDs} FTDs` : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">MTD Blended</div>
            <div className={cn("text-xl font-bold tabular-nums", getColorClass(mtdCPA))}>
              {mtdCPA !== null ? `£${animatedMtdCPA}` : '—'}
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {mtdFTDs !== null ? `${animatedMtdFTDs} FTDs` : '—'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Hook for yesterday's CPA
function useYesterdayCPA() {
  return useQuery({
    queryKey: ['yesterday-cpa'],
    queryFn: async () => {
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      
      const [spendResult, funnelResult] = await Promise.all([
        supabase.from('daily_ad_spend').select('spend').eq('date', yesterday),
        supabase.from('daily_funnel_metrics').select('unique_ftds').eq('date', yesterday)
      ]);

      const totalSpend = spendResult.data?.reduce((sum, r) => sum + Number(r.spend || 0), 0) || 0;
      const totalFTDs = funnelResult.data?.reduce((sum, r) => sum + (r.unique_ftds || 0), 0) || 0;
      
      return {
        spend: totalSpend,
        ftds: totalFTDs,
        cpa: totalFTDs > 0 ? totalSpend / totalFTDs : null
      };
    }
  });
}

// Hook for MTD blended CPA - same as dashboard, requires date range
function useMTDBlendedCPA() {
  const today = new Date();
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
  const todayStr = format(today, 'yyyy-MM-dd');
  
  // Previous month for comparison
  const prevMonthEnd = format(subDays(startOfMonth(today), 1), 'yyyy-MM-dd');
  const prevMonthStart = format(startOfMonth(subDays(startOfMonth(today), 1)), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['mtd-blended-cpa-home', monthStart, todayStr],
    queryFn: async () => {
      // Current period CPA and FTDs
      const [cpaResult, funnelResult, prevCpaResult] = await Promise.all([
        supabase.rpc('get_report_blended_cpa', {
          start_date: monthStart,
          end_date: todayStr
        }),
        supabase.from('daily_funnel_metrics')
          .select('unique_ftds')
          .gte('date', monthStart)
          .lte('date', todayStr),
        supabase.rpc('get_report_blended_cpa', {
          start_date: prevMonthStart,
          end_date: prevMonthEnd
        })
      ]);

      if (cpaResult.error) throw cpaResult.error;

      const currentValue = Array.isArray(cpaResult.data) && cpaResult.data.length > 0 
        ? Number(cpaResult.data[0]?.value || 0) 
        : 0;
      const prevValue = Array.isArray(prevCpaResult.data) && prevCpaResult.data.length > 0 
        ? Number(prevCpaResult.data[0]?.value || 0) 
        : 0;
      const totalFTDs = funnelResult.data?.reduce((sum, r) => sum + (r.unique_ftds || 0), 0) || 0;

      return { value: currentValue, previous_value: prevValue, ftds: totalFTDs };
    }
  });
}


function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCurrencyCompact(value: number | null | undefined): string {
  if (value == null) return '—';
  if (value >= 1000000) return `£${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `£${(value / 1000).toFixed(1)}K`;
  return `£${value.toFixed(0)}`;
}

// Animated currency formatter
function formatAnimatedCurrency(value: number): string {
  if (value >= 1000000) return `£${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `£${(value / 1000).toFixed(1)}K`;
  return `£${value.toFixed(0)}`;
}

function getPlatformLabel(platform: string): string {
  switch (platform) {
    case 'app_store': return 'App Store';
    case 'google_play': return 'Google Play';
    case 'trustpilot': return 'Trustpilot';
    default: return platform;
  }
}

function getStatusLabel(status: string): { label: string; color: string } {
  switch (status) {
    case 'fatigued': return { label: 'Rotate Now', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
    case 'fatiguing': return { label: 'Rotate Soon', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
    case 'early_warning': return { label: 'Monitor', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
    case 'increase_bid': return { label: 'Increase Bid', color: 'bg-green-500/20 text-green-400 border-green-500/30' };
    case 'decrease_bid': return { label: 'Decrease Bid', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
    case 'pause': return { label: 'Pause', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
    default: return { label: status, color: 'bg-muted text-muted-foreground' };
  }
}

// Check if URL is a video
function isVideoUrl(url: string): boolean {
  const videoExtensions = ['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext)) || lowerUrl.includes('video');
}

// Quick Links component for frequently visited pages
function QuickLinks({ animationStage }: { animationStage: number }) {
  const { topPages, isLoading } = usePageVisitTracker();
  const navigate = useNavigate();

  if (isLoading || topPages.length === 0) return null;

  return (
    <div className={cn(
      "flex flex-wrap gap-2 transition-all duration-500",
      animationStage >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
    )}>
      {topPages.map(page => (
        <button
          key={page.path}
          onClick={() => navigate(page.path)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card hover:bg-accent text-sm text-foreground transition-colors"
        >
          <page.icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{page.title}</span>
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const { data: yesterdayCPA, isLoading: cpaSingleLoading } = useYesterdayCPA();
  const { data: blendedCPA, isLoading: blendedLoading } = useMTDBlendedCPA();
  const { data: pendingResponses, isLoading: pendingLoading } = usePendingResponses();
  const { pendingRecommendations: keywordRecs } = useAIKeywordRecommendations();
  const { creativesNeedingAttention: fatigueRecs } = useCreativeFatigueAnalysis();
  const { pendingRecommendations: budgetRecs } = useBudgetRecommendations();
  const { data: launchHistory, isLoading: launchLoading } = useAdLaunchHistory();
  const { thresholds: cpaThresholds } = useCPAThresholds();
  
  // Review response dialog state
  const [selectedPendingResponse, setSelectedPendingResponse] = useState<PendingResponse | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  

  // Animation stage tracking
  const [animationStage, setAnimationStage] = useState(0);
  
  useEffect(() => {
    const timers = [
      setTimeout(() => setAnimationStage(1), 0),      // Greeting
      setTimeout(() => setAnimationStage(2), 800),    // Summary text
      setTimeout(() => setAnimationStage(3), 1300),   // KPI cards
      setTimeout(() => setAnimationStage(4), 1800),   // Module containers
      setTimeout(() => setAnimationStage(5), 2000),   // Module content
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Use same logic as Projections.tsx for projected spend
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const daysInMonth = differenceInDays(monthEnd, monthStart) + 1;
  const daysPassed = differenceInDays(today, monthStart) + 1;
  const daysRemaining = daysInMonth - daysPassed;
  const startDateStr = format(monthStart, 'yyyy-MM-dd');
  const endDateStr = format(today, 'yyyy-MM-dd');

  const { data: dailySpend } = useDailyAdSpend(startDateStr, endDateStr);
  const { data: affiliateSpend } = useDailyAffiliateSpend(startDateStr, endDateStr);
  const { data: affiliates } = useAffiliates();
  const { budgets: platformBudgets } = usePlatformBudgets();

  // Calculate current spend by platform (from Projections.tsx)
  const spendByPlatform = useMemo(() => {
    if (!dailySpend) return [];
    
    const byPlatform = new Map<string, number>();
    for (const day of dailySpend) {
      byPlatform.set(day.platform, (byPlatform.get(day.platform) || 0) + day.spend);
    }
    
    return Array.from(byPlatform.entries()).map(([platform, spend]) => {
      const budgetInfo = platformBudgets.find(b => b.platform === platform);
      return { 
        platform, 
        spend,
        dailyBudget: budgetInfo?.totalDailyBudget || 0,
        lifetimeBudget: budgetInfo?.totalLifetimeBudget || 0,
      };
    });
  }, [dailySpend, platformBudgets]);

  // Calculate affiliate projections
  const affiliateProjections = useMemo(() => {
    if (!affiliates || !affiliateSpend) return [];
    
    const spentByAffiliate = new Map<string, number>();
    for (const day of affiliateSpend) {
      spentByAffiliate.set(day.affiliate_id, (spentByAffiliate.get(day.affiliate_id) || 0) + day.spend);
    }
    
    return affiliates
      .filter(a => a.status === 'active' && a.monthly_cap && a.monthly_cap > 0)
      .map(affiliate => ({
        spent: spentByAffiliate.get(affiliate.id) || 0,
        remaining: Math.max(0, (affiliate.monthly_cap || 0) - (spentByAffiliate.get(affiliate.id) || 0)),
      }));
  }, [affiliates, affiliateSpend]);

  // Calculate yesterday's spend by platform for velocity-based projections
  const yesterdaySpendByPlatform = useMemo(() => {
    if (!dailySpend) return new Map<string, number>();
    
    const yesterday = format(subDays(today, 1), 'yyyy-MM-dd');
    const byPlatform = new Map<string, number>();
    
    for (const day of dailySpend) {
      if (day.date === yesterday) {
        byPlatform.set(day.platform, (byPlatform.get(day.platform) || 0) + day.spend);
      }
    }
    
    return byPlatform;
  }, [dailySpend, today]);

  // Calculate totals
  const totalAdSpend = spendByPlatform.reduce((sum, p) => sum + p.spend, 0);
  const totalAffiliateSpent = affiliateProjections.reduce((sum, a) => sum + a.spent, 0);
  const totalAffiliateRemaining = affiliateProjections.reduce((sum, a) => sum + a.remaining, 0);
  const totalCurrentSpend = totalAdSpend + totalAffiliateSpent;

  // Calculate projected ad spend using yesterday's velocity (from Projections.tsx)
  const projectedAdSpend = useMemo(() => {
    let projected = 0;
    
    for (const platform of spendByPlatform) {
      const yesterdaySpend = yesterdaySpendByPlatform.get(platform.platform) || 0;
      
      if (yesterdaySpend > 0) {
        projected += platform.spend + (yesterdaySpend * daysRemaining);
      } else if (platform.dailyBudget > 0) {
        projected += platform.dailyBudget * daysInMonth;
      } else if (platform.lifetimeBudget > 0) {
        projected += Math.min(platform.lifetimeBudget, platform.spend + (platform.lifetimeBudget - platform.spend));
      } else {
        const dailyAvg = daysPassed > 0 ? platform.spend / daysPassed : 0;
        projected += dailyAvg * daysInMonth;
      }
    }
    
    return projected;
  }, [spendByPlatform, yesterdaySpendByPlatform, daysInMonth, daysRemaining, daysPassed]);

  const projectedTotalSpend = projectedAdSpend + totalAffiliateSpent + totalAffiliateRemaining;

  const greeting = getGreeting();
  const firstName = getFirstName(user?.user_metadata?.full_name);

  // Animated spend values - only start counting when stage >= 3
  const animatedSpend = useAnimatedNumber(totalCurrentSpend, 1200, animationStage >= 3) as number;
  const animatedProgressPercent = useAnimatedNumber(
    projectedTotalSpend > 0 ? (totalCurrentSpend / projectedTotalSpend) * 100 : 0,
    1200, 
    animationStage >= 3
  ) as number;
  const animatedDaysRemaining = useAnimatedNumber(daysRemaining, 1200, animationStage >= 3) as number;

  // Fetch thumbnails for creative fatigue recommendations
  const creativeIds = useMemo(() => {
    return (fatigueRecs || []).map(p => p.creative_id);
  }, [fatigueRecs]);

  const { data: metaThumbnails } = useQuery({
    queryKey: ['meta-thumbnails-home', creativeIds],
    queryFn: async () => {
      if (creativeIds.length === 0) return {};
      const { data } = await supabase
        .from('meta_ads')
        .select('ad_id, thumbnail_url')
        .in('ad_id', creativeIds);
      
      const thumbnailMap: Record<string, string> = {};
      (data || []).forEach(ad => {
        if (ad.thumbnail_url) thumbnailMap[ad.ad_id] = ad.thumbnail_url;
      });
      return thumbnailMap;
    },
    enabled: creativeIds.length > 0,
  });

  const { data: molocoThumbnails } = useQuery({
    queryKey: ['moloco-thumbnails-home', creativeIds],
    queryFn: async () => {
      if (creativeIds.length === 0) return {};
      const { data } = await supabase
        .from('moloco_creatives')
        .select('creative_id, main_asset_url')
        .in('creative_id', creativeIds);
      
      const thumbnailMap: Record<string, string> = {};
      (data || []).forEach(creative => {
        if (creative.main_asset_url) thumbnailMap[creative.creative_id] = creative.main_asset_url;
      });
      return thumbnailMap;
    },
    enabled: creativeIds.length > 0,
  });

  // Transform daily spend data for mini chart
  const miniChartData = useMemo(() => {
    if (!dailySpend) return [];
    
    // Group by date
    const byDate = new Map<string, { date: string; meta: number; apple: number; moloco: number; affiliates: number }>();
    
    for (const day of dailySpend) {
      if (!byDate.has(day.date)) {
        byDate.set(day.date, { date: day.date, meta: 0, apple: 0, moloco: 0, affiliates: 0 });
      }
      const entry = byDate.get(day.date)!;
      const platform = day.platform.toLowerCase();
      if (platform === 'meta') entry.meta += Number(day.spend);
      else if (platform === 'apple') entry.apple += Number(day.spend);
      else if (platform === 'moloco') entry.moloco += Number(day.spend);
    }
    
    // Add affiliate spend by date
    if (affiliateSpend) {
      for (const day of affiliateSpend) {
        if (!byDate.has(day.date)) {
          byDate.set(day.date, { date: day.date, meta: 0, apple: 0, moloco: 0, affiliates: 0 });
        }
        byDate.get(day.date)!.affiliates += Number(day.spend);
      }
    }
    
    // Sort by date and take last 14 days
    return Array.from(byDate.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);
  }, [dailySpend, affiliateSpend]);

  // Combined Actions: up to 3 pending reviews + remainder AI recommendations (max 5 total)
  type ActionItem = {
    id: string;
    actionType: 'pending_review' | 'recommendation';
    title: string;
    subtitle?: string;
    status: string;
    statusLabel: string;
    statusColor: string;
    reasoning?: string;
    thumbnailUrl?: string;
    icon: 'message' | 'search' | 'dollar' | 'film' | 'image';
    platform?: string;
    pendingResponse?: PendingResponse;
  };

  const combinedActions = useMemo((): ActionItem[] => {
    const actions: ActionItem[] = [];
    
    // Add pending reviews (up to 3)
    const pendingReviewItems = (pendingResponses || []).slice(0, 3).map((pr): ActionItem => ({
      id: pr.id,
      actionType: 'pending_review',
      title: pr.review_title || 'Review',
      subtitle: pr.review_text?.slice(0, 80) + (pr.review_text && pr.review_text.length > 80 ? '...' : ''),
      status: 'pending',
      statusLabel: 'Respond',
      statusColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      reasoning: `${pr.review_stars}★ review from ${pr.review_author || 'Anonymous'} on ${getPlatformLabel(pr.platform)}`,
      icon: 'message',
      platform: pr.platform,
      pendingResponse: pr,
    }));
    
    actions.push(...pendingReviewItems);
    
    // Fill remaining slots with AI recommendations
    const remainingSlots = 5 - actions.length;
    
    if (remainingSlots > 0) {
      const aiRecs = [
        ...(fatigueRecs || []).map(r => {
          const thumbnailUrl = r.platform === 'meta' 
            ? metaThumbnails?.[r.creative_id]
            : molocoThumbnails?.[r.creative_id];
          const statusInfo = getStatusLabel(r.fatigue_status);
          return {
            id: r.id,
            actionType: 'recommendation' as const,
            title: r.creative_name,
            status: r.fatigue_status,
            statusLabel: statusInfo.label,
            statusColor: statusInfo.color,
            reasoning: r.reasoning,
            priority: r.fatigue_status === 'fatigued' ? 1 : r.fatigue_status === 'fatiguing' ? 2 : 3,
            thumbnailUrl,
            icon: 'film' as const,
            platform: r.platform,
          };
        }),
        ...(keywordRecs || []).map(r => {
          const statusInfo = getStatusLabel(r.recommendation_type);
          return {
            id: r.id,
            actionType: 'recommendation' as const,
            title: r.keyword_text,
            status: r.recommendation_type,
            statusLabel: statusInfo.label,
            statusColor: statusInfo.color,
            reasoning: r.reasoning,
            priority: r.confidence >= 85 ? 1 : r.confidence >= 70 ? 2 : 3,
            thumbnailUrl: undefined,
            icon: 'search' as const,
            platform: 'apple',
          };
        }),
        ...(budgetRecs || []).slice(0, 2).map(r => {
          const statusInfo = getStatusLabel(r.action_type);
          return {
            id: r.id,
            actionType: 'recommendation' as const,
            title: r.entity_name,
            status: r.action_type,
            statusLabel: statusInfo.label,
            statusColor: statusInfo.color,
            reasoning: r.reasoning,
            priority: r.confidence >= 85 ? 1 : r.confidence >= 70 ? 2 : 3,
            thumbnailUrl: undefined,
            icon: 'dollar' as const,
            platform: r.channel,
          };
        }),
      ].sort((a, b) => a.priority - b.priority);
      
      actions.push(...aiRecs.slice(0, remainingSlots));
    }
    
    return actions;
  }, [pendingResponses, fatigueRecs, keywordRecs, budgetRecs, metaThumbnails, molocoThumbnails]);

  const handleActionClick = (action: ActionItem) => {
    if (action.actionType === 'pending_review' && action.pendingResponse) {
      setSelectedPendingResponse(action.pendingResponse);
      setReviewDialogOpen(true);
    } else if (action.actionType === 'recommendation') {
      navigate(`/recommendations#rec-${action.id}`);
    }
  };


  const recentLaunches = launchHistory?.slice(0, 3) || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Greeting - Stage 1 & 2 */}
      <div className="mb-8">
        <h1 className={cn(
          "text-3xl font-bold text-foreground transition-all duration-500",
          animationStage >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        )}>
          {greeting}, {firstName}
        </h1>
        <p className={cn(
          "text-muted-foreground mt-1 transition-all duration-500",
          animationStage >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        )}>
          Here's your marketing summary
        </p>
      </div>

      {/* Quick Links */}
      <QuickLinks animationStage={animationStage} />

      {/* Quick Stats Grid - Stage 3 */}
      <div className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-500",
        animationStage >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}>
        {/* CPA Thermometer - spans 2 columns */}
        <CPAThermometer
          yesterdayCPA={yesterdayCPA?.cpa ?? null}
          mtdCPA={blendedCPA?.value ?? null}
          yesterdayFTDs={yesterdayCPA?.ftds ?? null}
          mtdFTDs={blendedCPA?.ftds ?? null}
          isLoading={cpaSingleLoading || blendedLoading}
          shouldAnimate={animationStage >= 3}
          minCPA={cpaThresholds.min_cpa}
          maxCPA={cpaThresholds.max_cpa}
          targetCPA={cpaThresholds.target_cpa}
          greenThreshold={cpaThresholds.green_threshold}
          orangeThreshold={cpaThresholds.orange_threshold}
        />

        {/* MTD Spend with progress bar showing projected EOM */}
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Spend</span>
            </div>
            <div className="text-2xl font-bold text-foreground tabular-nums">
              {formatAnimatedCurrency(animatedSpend)}
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Projected: {formatCurrencyCompact(projectedTotalSpend)}
            </p>
            {/* Progress bar */}
            <div className="space-y-1">
              <Progress 
                value={animatedProgressPercent} 
                className="h-2" 
              />
              <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                <span>{Math.round(animatedProgressPercent)}% of projected</span>
                <span>{animatedDaysRemaining} days left</span>
              </div>
            </div>
            
            {/* Mini spend chart */}
            <Separator className="my-3" />
            <MiniSpendChart data={miniChartData} shouldAnimate={animationStage >= 3} />
          </CardContent>
        </Card>

      </div>

      {/* Actions Section - Combined Reviews & Recommendations - Stage 4 & 5 */}
      <Card className={cn(
        "transition-all duration-500",
        animationStage >= 4 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold">
            Actions
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" asChild className="h-6 px-2 text-xs">
              <Link to="/ratings">
                Reviews
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild className="h-6 px-2 text-xs">
              <Link to="/recommendations">
                AI Insights
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingLoading ? (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : animationStage < 5 ? (
            <div className="h-20" />
          ) : combinedActions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No pending actions</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {combinedActions.map((action, index) => (
                <div 
                  key={action.id} 
                  onClick={() => handleActionClick(action)}
                  className="p-3 rounded-lg bg-muted/50 flex gap-3 animate-fade-in cursor-pointer hover:bg-muted/70 transition-colors group"
                  style={{ 
                    animationDelay: `${index * 100}ms`,
                    animationFillMode: 'backwards'
                  }}
                >
                  {/* Icon/Thumbnail */}
                  {action.thumbnailUrl ? (
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                      {isVideoUrl(action.thumbnailUrl) ? (
                        <video 
                          src={action.thumbnailUrl} 
                          className="w-full h-full object-cover"
                          muted
                          preload="metadata"
                        />
                      ) : (
                        <img 
                          src={action.thumbnailUrl} 
                          alt={action.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      {action.icon === 'message' && <MessageSquare className="h-5 w-5 text-muted-foreground" />}
                      {action.icon === 'search' && <Search className="h-5 w-5 text-muted-foreground" />}
                      {action.icon === 'dollar' && <DollarSign className="h-5 w-5 text-muted-foreground" />}
                      {action.icon === 'film' && <Film className="h-5 w-5 text-muted-foreground" />}
                      {action.icon === 'image' && <Image className="h-5 w-5 text-muted-foreground" />}
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0 space-y-1">
                    <Badge variant="outline" className={`text-[9px] ${action.statusColor} w-fit`}>
                      {action.statusLabel}
                    </Badge>
                    <p className="text-sm text-foreground line-clamp-2">{action.reasoning}</p>
                  </div>
                  
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Response Dialog */}
      <PendingResponseDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        pendingResponse={selectedPendingResponse}
      />

      {/* Recent Ad Launches - with thumbnails */}
      <Card className={cn(
        "transition-all duration-500",
        animationStage >= 4 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold">
            Ad Launches
          </CardTitle>
            <Button variant="ghost" size="sm" asChild className="h-6 px-2 text-xs">
              <Link to="/launch-ads">
                Go to Launch Ads
              </Link>
            </Button>
        </CardHeader>
        <CardContent>
          {launchLoading ? (
            <div className="flex gap-4">
              <Skeleton className="h-32 flex-1" />
              <Skeleton className="h-32 flex-1" />
              <Skeleton className="h-32 flex-1" />
            </div>
          ) : animationStage < 5 ? (
            <div className="h-32" />
          ) : recentLaunches.length === 0 ? (
            <p className="text-muted-foreground text-sm">No recent ad launches</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recentLaunches.map((launch, index) => {
                const firstMediaUrl = launch.media_urls?.[0];
                return (
                  <div 
                    key={launch.id} 
                    className="rounded-lg bg-muted/50 overflow-hidden animate-fade-in"
                    style={{ 
                      animationDelay: `${index * 100}ms`,
                      animationFillMode: 'backwards'
                    }}
                  >
                    {/* Creative thumbnail */}
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      {firstMediaUrl ? (
                        isVideoUrl(firstMediaUrl) ? (
                          <video 
                            src={firstMediaUrl} 
                            className="w-full h-full object-cover"
                            muted
                            preload="metadata"
                          />
                        ) : (
                          <img 
                            src={firstMediaUrl} 
                            alt={launch.ad_name}
                            className="w-full h-full object-cover"
                          />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      {/* Media count overlay */}
                      {launch.media_urls && launch.media_urls.length > 1 && (
                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                          +{launch.media_urls.length - 1}
                        </div>
                      )}
                    </div>
                    
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground line-clamp-1">
                          {launch.ad_name}
                        </span>
                        <Badge 
                          variant={launch.status === 'success' ? 'default' : launch.status === 'failed' ? 'destructive' : 'outline'}
                          className={cn(
                            "text-[10px]",
                            launch.status === 'success' && 'bg-green-500/20 text-green-400 border-green-500/30'
                          )}
                        >
                          {launch.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{launch.ads_count} ads</span>
                        <span>•</span>
                        <span>{launch.adsets_count} ad sets</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(launch.created_at), 'MMM d, HH:mm')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
