import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info, ChevronDown, Lock, TrendingUp, TrendingDown, MessageSquare, Search, Download, Users, Star, History, HelpCircle, Share2, Brain, Eye, Radio, Shield, UsersRound } from "lucide-react";
import { useBrandScore } from "@/hooks/useBrandScore";
import { useBrandScoreHistory } from "@/hooks/useBrandScoreHistory";
import { useBrandScoreExplanations } from "@/hooks/useBrandScoreExplanations";
import { useCurrentNPS, useMonthlyNPSMetrics } from "@/hooks/useNPSMetrics";
import { useSearchConsoleSummary, useSearchConsoleMetrics } from "@/hooks/useSearchConsoleMetrics";
import { useOrganicInstallsSummary } from "@/hooks/useOrganicInstalls";
import { useReferralStats } from "@/hooks/useReferralSignups";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend, Area, AreaChart } from "recharts";

import { format, subDays } from "date-fns";

function useAnimatedNumber(target: number, duration: number = 1500) {
  const [current, setCurrent] = useState(0);
  
  useEffect(() => {
    if (target === 0) {
      setCurrent(0);
      return;
    }
    
    const startTime = Date.now();
    const startValue = 0;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(startValue + (target - startValue) * easeOut);
      
      setCurrent(value);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [target, duration]);
  
  return current;
}

function ScoreArcGauge({ score, maxScore = 500, tier, multiplier }: { score: number; maxScore?: number; tier: string; multiplier: number }) {
  const [hasAnimated, setHasAnimated] = useState(false);
  const displayScore = useAnimatedNumber(hasAnimated ? score : 0, 1500);
  
  // Trigger animation after mount
  useEffect(() => {
    const timeout = setTimeout(() => {
      setHasAnimated(true);
    }, 100);
    return () => clearTimeout(timeout);
  }, []);
  
  const targetPercentage = Math.min(100, Math.max(0, (score / maxScore) * 100));
  const currentPercentage = hasAnimated ? targetPercentage : 0;
  
  // Arc parameters
  const centerX = 150;
  const centerY = 150;
  const radius = 110;
  const startAngle = -180;
  const endAngle = 0;
  const totalAngle = endAngle - startAngle;
  
  // Needle rotation angle (starts at -180, ends at 0)
  const needleRotation = startAngle + (currentPercentage / 100) * totalAngle;
  const needleLength = radius - 20;

  // Generate tick marks with colors
  const ticks = [];
  const numTicks = 30;
  const tickColors = [
    "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#ef4444",
    "#f97316", "#f97316", "#f97316", "#f97316", "#f97316",
    "#f59e0b", "#f59e0b", "#f59e0b", "#f59e0b", "#f59e0b",
    "#84cc16", "#84cc16", "#84cc16", "#84cc16", "#84cc16",
    "#22c55e", "#22c55e", "#22c55e", "#22c55e", "#22c55e",
    "#10b981", "#10b981", "#10b981", "#10b981", "#10b981",
  ];

  for (let i = 0; i <= numTicks; i++) {
    const angle = startAngle + (i / numTicks) * totalAngle;
    const innerRadius = radius - 25;
    const outerRadius = radius - 8;
    
    const x1 = centerX + innerRadius * Math.cos((angle * Math.PI) / 180);
    const y1 = centerY + innerRadius * Math.sin((angle * Math.PI) / 180);
    const x2 = centerX + outerRadius * Math.cos((angle * Math.PI) / 180);
    const y2 = centerY + outerRadius * Math.sin((angle * Math.PI) / 180);
    
    ticks.push({
      x1, y1, x2, y2,
      color: tickColors[Math.min(i, tickColors.length - 1)],
    });
  }

  // Get tier badge color
  const getTierColor = (tierName: string) => {
    switch (tierName) {
      case "Nascent": return "bg-red-500";
      case "Emerging": return "bg-orange-500";
      case "Scaling": return "bg-amber-500";
      case "Established": return "bg-green-500";
      case "Leading": return "bg-emerald-500";
      default: return "bg-slate-500";
    }
  };

  return (
    <div className="relative w-full max-w-[340px] mx-auto bg-slate-900 rounded-2xl p-8 pb-6">
      {/* Tier badge above the dial */}
      <div className="flex justify-center mb-4">
        <span className={cn(
          "px-4 py-1.5 rounded-full text-white font-semibold text-sm uppercase tracking-wide",
          getTierColor(tier)
        )}>
          {tier}
        </span>
      </div>
      
      <svg 
        className="w-full" 
        viewBox="0 0 300 180"
        style={{ overflow: 'visible' }}
      >
        {/* Background arc track */}
        <path
          d={`M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={20}
          strokeLinecap="round"
        />
        
        {/* Colored tick marks */}
        {ticks.map((tick, i) => (
          <line
            key={i}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke={tick.color}
            strokeWidth={4}
            strokeLinecap="round"
          />
        ))}
        
        {/* Needle group with rotation transform */}
        <g 
          style={{ 
            transformOrigin: `${centerX}px ${centerY}px`,
            transform: `rotate(${needleRotation}deg)`,
            transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
          }}
        >
          <line
            x1={centerX}
            y1={centerY}
            x2={centerX + needleLength}
            y2={centerY}
            stroke="white"
            strokeWidth={3}
            strokeLinecap="round"
          />
        </g>
        
        {/* Needle center dot */}
        <circle
          cx={centerX}
          cy={centerY}
          r={8}
          fill="white"
          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
        />
      </svg>
      
      {/* Score display */}
      <div className="text-center -mt-4">
        <div className="text-6xl font-bold text-white tracking-tight tabular-nums">
          {displayScore}
        </div>
        {/* Efficiency multiplier below the score */}
        <div className="text-lg text-slate-300 mt-1 font-medium">
          {multiplier.toFixed(1)}× efficiency
        </div>
      </div>
      
      {/* Min/Max labels */}
      <div className="flex justify-between mt-2 px-2">
        <span className="text-slate-400 text-sm font-medium">0</span>
        <span className="text-slate-400 text-sm font-medium">500</span>
      </div>
    </div>
  );
}

interface ComponentPieProps {
  label: string;
  score: number;
  maxScore?: number;
  icon: React.ReactNode;
  isPlaceholder?: boolean;
  details?: string;
  tooltip?: string;
}

function ComponentPie({ label, score, maxScore = 100, icon, isPlaceholder, details, tooltip }: ComponentPieProps) {
  const percentage = (score / maxScore) * 100;
  
  const getColor = (p: number) => {
    if (p >= 70) return "#10b981";
    if (p >= 50) return "#f59e0b";
    if (p >= 30) return "#f97316";
    return "#ef4444";
  };

  const pieData = [
    { name: "Score", value: score },
    { name: "Remaining", value: maxScore - score },
  ];

  return (
    <div className="flex items-center gap-4">
      <div className="w-16 h-16 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={18}
              outerRadius={28}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              strokeWidth={0}
            >
              <Cell fill={getColor(percentage)} />
              <Cell fill="hsl(var(--muted))" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="font-medium">{label}</span>
          {tooltip && (
            <Dialog>
              <DialogTrigger asChild>
                <button className="p-0.5 rounded hover:bg-muted transition-colors">
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {icon}
                    {label}
                  </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">{tooltip}</p>
              </DialogContent>
            </Dialog>
          )}
          {isPlaceholder && (
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="ml-auto font-bold tabular-nums">
            {score}<span className="text-muted-foreground font-normal">/{maxScore}</span>
          </span>
        </div>
        {details && (
          <p className="text-xs text-muted-foreground mt-1">{details}</p>
        )}
      </div>
    </div>
  );
}

function ScoreBreakdownSection({ scoreData, isLoading }: { scoreData: ReturnType<typeof useBrandScore>['data']; isLoading: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: explanations } = useBrandScoreExplanations();

  const getExplanation = (key: string, fallback: string) => {
    return explanations?.[key]?.explanation ?? fallback;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full p-4 hover:bg-muted/50 rounded-lg transition-colors">
        <TrendingUp className="h-4 w-4 text-primary" />
        <span className="font-medium">Score Breakdown</span>
        <ChevronDown className={cn(
          "h-4 w-4 ml-auto transition-transform",
          isOpen && "rotate-180"
        )} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        {isLoading ? (
          <div className="space-y-6 pt-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6 pt-4 border-t">
            <ComponentPie
              label="Trust"
              score={scoreData?.components?.nps?.score ?? 0}
              icon={<Shield className="h-4 w-4" />}
              tooltip={getExplanation("trust", "Trust looks at new positive reviews per month.")}
              details={scoreData?.components?.nps?.currentNPS != null 
                ? `Current NPS: ${scoreData.components.nps.currentNPS > 0 ? '+' : ''}${scoreData.components.nps.currentNPS}${scoreData.components.nps.growthBonus > 0 ? ` (+${scoreData.components.nps.growthBonus} bonus)` : ''}`
                : "No NPS data available"}
            />
            <ComponentPie
              label="Visibility"
              score={scoreData?.components?.searchVisibility?.score ?? 0}
              icon={<Eye className="h-4 w-4" />}
              tooltip={getExplanation("visibility", "Visibility captures monthly branded searches.")}
              details={scoreData?.components?.searchVisibility?.hasValidBaseline 
                ? `${(scoreData?.components?.searchVisibility?.targetAchievementPercent ?? 0).toFixed(0)}% of target`
                : "Baseline unavailable"}
            />
            <ComponentPie
              label="Reach"
              score={scoreData?.components?.rating?.score ?? 0}
              icon={<Radio className="h-4 w-4" />}
              tooltip={getExplanation("reach", "Reach measures your engaged audience.")}
              details={`${(scoreData?.components?.rating?.averageRating ?? 0).toFixed(2)}★ from ${scoreData?.components?.rating?.reviewCount ?? 0} reviews this month`}
            />
            <ComponentPie
              label="Memorability"
              score={scoreData?.components?.organicInstalls?.score ?? 0}
              icon={<Brain className="h-4 w-4" />}
              tooltip={getExplanation("memorability", "Memorability measures your share of category search volume.")}
              details={`${(scoreData?.components?.organicInstalls?.organicPercent ?? 0).toFixed(1)}% of installs are organic`}
            />
            <ComponentPie
              label="Community"
              score={scoreData?.components?.referrals?.score ?? 0}
              icon={<UsersRound className="h-4 w-4" />}
              tooltip={getExplanation("community", "Community counts your owned audience.")}
              isPlaceholder={scoreData?.components?.referrals?.isPlaceholder}
              details={scoreData?.components?.referrals?.referralCount !== undefined
                ? `${scoreData.components.referrals.referralCount} referral signups (${scoreData.components.referrals.referralPercent?.toFixed(1) ?? 0}% of total)`
                : "No referral data yet"}
            />
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function MethodologyDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
          <HelpCircle className="h-4 w-4" />
          <span className="hidden sm:inline">How it's calculated</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            How is Brand Score calculated?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                NPS Score (0-100 pts)
              </h4>
              <p className="text-sm text-muted-foreground">
                Based on your Net Promoter Score from the last 30 days. Negative NPS scores contribute 0 points. 
                Positive NPS contributes up to 80 points, plus up to 20 bonus points for improvement over the previous period.
              </p>
              <div className="text-xs bg-muted/50 p-2 rounded font-mono">
                Base: (NPS ÷ 100) × 80<br/>
                Bonus: min(20, growth × 2)
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                Search Visibility (0-100 pts)
              </h4>
              <p className="text-sm text-muted-foreground">
                Measures your brand's discoverability through search using a target-based system.
                The baseline is set from 12 months ago, with a 20% compound growth target each month.
                Your score is the percentage of that target achieved.
              </p>
              <div className="text-xs bg-muted/50 p-2 rounded font-mono">
                Target = Baseline × 1.2¹²<br/>
                Score = % of target achieved (capped at 100)
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Average Rating (0-100 pts)
              </h4>
              <p className="text-sm text-muted-foreground">
                Combines review quality and volume from App Store, Google Play, and Trustpilot. 
                Quality (average rating) accounts for 70 points, volume (reviews collected vs target) adds up to 30 points.
              </p>
              <div className="text-xs bg-muted/50 p-2 rounded font-mono">
                Quality: (rating ÷ 5) × 70<br/>
                Volume: (count ÷ target) × 30
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" />
                Organic Installs (0-100 pts)
              </h4>
              <p className="text-sm text-muted-foreground">
                Measures brand strength through the percentage of installs that come organically 
                (not from paid advertising). Higher organic percentage indicates stronger brand recognition.
              </p>
              <div className="text-xs bg-muted/50 p-2 rounded font-mono">
                Score = organic % of total installs
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Share2 className="h-4 w-4 text-primary" />
                Referrals (0-100 pts)
              </h4>
              <p className="text-sm text-muted-foreground">
                Measures word-of-mouth strength through referral signups as a percentage of total signups. 
                Higher referral rates indicate stronger organic growth and brand advocacy.
              </p>
              <div className="text-xs bg-muted/50 p-2 rounded font-mono">
                Score = referral signups ÷ total signups × 100
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-semibold mb-2">Efficiency Tiers</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-red-500/10">
                <span className="text-red-600 dark:text-red-400 font-medium">Nascent (0–99)</span>
                <span className="text-muted-foreground">1.0×</span>
              </div>
              <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-orange-500/10">
                <span className="text-orange-600 dark:text-orange-400 font-medium">Emerging (100–199)</span>
                <span className="text-muted-foreground">1.0–1.3×</span>
              </div>
              <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-amber-500/10">
                <span className="text-amber-600 dark:text-amber-400 font-medium">Scaling (200–299)</span>
                <span className="text-muted-foreground">1.3–1.8×</span>
              </div>
              <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-green-500/10">
                <span className="text-green-600 dark:text-green-400 font-medium">Established (300–399)</span>
                <span className="text-muted-foreground">1.8–2.4×</span>
              </div>
              <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-emerald-500/10">
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Leading (400–500)</span>
                <span className="text-muted-foreground">2.4–2.9×</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NPSGauge({ nps }: { nps: number | null }) {
  const displayNps = nps ?? 0;
  const normalizedPosition = ((displayNps + 100) / 200) * 100;

  const getColor = (n: number) => {
    if (n >= 50) return "text-emerald-500";
    if (n >= 0) return "text-amber-500";
    return "text-red-500";
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-full max-w-[200px]">
        <div className="h-3 rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500" />
        <div 
          className="absolute top-0 w-4 h-4 -mt-0.5 bg-white border-2 border-foreground rounded-full shadow"
          style={{ left: `calc(${normalizedPosition}% - 8px)` }}
        />
      </div>
      <div className="flex justify-between w-full max-w-[200px] text-xs text-muted-foreground">
        <span>-100</span>
        <span>0</span>
        <span>+100</span>
      </div>
      <div className={`text-4xl font-bold ${getColor(displayNps)}`}>
        {displayNps > 0 ? `+${displayNps}` : displayNps}
      </div>
      <span className="text-sm text-muted-foreground">Net Promoter Score</span>
    </div>
  );
}

const COLORS = ["#10b981", "#f59e0b", "#ef4444"];

export default function BrandVisibility() {
  const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];
  
  const { data: scoreData, isLoading: scoreLoading } = useBrandScore();
  const { data: historyData, isLoading: historyLoading } = useBrandScoreHistory(52);
  const { data: npsData, isLoading: npsLoading } = useCurrentNPS();
  const { data: monthlyNpsData, isLoading: monthlyNpsLoading } = useMonthlyNPSMetrics(12);
  const { data: searchData, isLoading: searchLoading } = useSearchConsoleSummary();
  const { data: searchMetrics, isLoading: searchMetricsLoading } = useSearchConsoleMetrics(thirtyDaysAgo);
  const { data: organicData, isLoading: organicLoading } = useOrganicInstallsSummary();
  const { data: referralData, isLoading: referralLoading } = useReferralStats(thirtyDaysAgo, today);

  const getScoreLabelColor = (label: string) => {
    switch (label) {
      case "Excellent": return "text-emerald-500";
      case "Strong": return "text-green-500";
      case "Developing": return "text-amber-500";
      case "Building": return "text-orange-500";
      default: return "text-red-500";
    }
  };

  const monthlyNpsChartData = monthlyNpsData?.map(m => ({
    month: m.monthLabel,
    nps: m.nps,
    responses: m.total,
  })) || [];

  const npsPieData = npsData ? [
    { name: "Promoters", value: npsData.promoters, color: COLORS[0] },
    { name: "Passives", value: npsData.passives, color: COLORS[1] },
    { name: "Detractors", value: npsData.detractors, color: COLORS[2] },
  ] : [];

  const searchChartData = searchMetrics?.map(m => ({
    date: format(new Date(m.date), "MMM d"),
    impressions: m.impressions,
    clicks: m.clicks,
  })) || [];

  const organicVsPaidData = organicData ? [
    { name: "Organic", value: organicData.totalOrganic },
    { name: "Paid", value: organicData.paidInstalls },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Main Score Card */}
      <Card className="bg-gradient-to-br from-primary/5 via-transparent to-transparent border-primary/20">
        <CardContent className="pt-8 pb-0 relative">
          {/* Info button in top right */}
          <div className="absolute top-4 right-4">
            <MethodologyDialog />
          </div>
          
          {scoreLoading ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <Skeleton className="w-64 h-32" />
              <Skeleton className="w-32 h-8" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <ScoreArcGauge 
                score={scoreData?.totalScore ?? 0} 
                tier={scoreData?.scoreLabel ?? "Nascent"}
                multiplier={scoreData?.efficiencyMultiplier ?? 1.0}
              />
            </div>
          )}
        </CardContent>
        <div className="border-t border-border/50 mt-6">
          <ScoreBreakdownSection scoreData={scoreData} isLoading={scoreLoading} />
        </div>
      </Card>

      {/* Historical Brand Score Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            Brand Score History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : historyData && historyData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData}>
                  <defs>
                    <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                  <XAxis dataKey="weekLabel" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis domain={[0, 500]} tick={{ fontSize: 10 }} />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
                            <p className="font-semibold mb-2">{label}</p>
                            <p className="text-lg font-bold text-primary mb-2">Score: {data.totalScore}/500</p>
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <p>NPS: {data.nps}/100</p>
                              <p>Search: {data.searchVisibility}/100</p>
                              <p>Rating: {data.rating}/100</p>
                              <p>Organic: {data.organicInstalls}/100</p>
                              <p>Referrals: {data.referrals}/100</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="totalScore" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    fill="url(#scoreGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No historical data available yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* NPS Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              NPS Tracker
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {npsLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <NPSGauge nps={npsData?.nps ?? null} />
            )}

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 rounded-lg bg-emerald-500/10">
                <div className="text-2xl font-bold text-emerald-500">{npsData?.promoters ?? 0}</div>
                <div className="text-xs text-muted-foreground">Promoters (9-10)</div>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10">
                <div className="text-2xl font-bold text-amber-500">{npsData?.passives ?? 0}</div>
                <div className="text-xs text-muted-foreground">Passives (7-8)</div>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10">
                <div className="text-2xl font-bold text-red-500">{npsData?.detractors ?? 0}</div>
                <div className="text-xs text-muted-foreground">Detractors (0-6)</div>
              </div>
            </div>

            {npsPieData.length > 0 && (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={npsPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {npsPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Search Visibility Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Search className="h-5 w-5" />
              Search Visibility
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {searchLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{(searchData?.impressions ?? 0).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Impressions</div>
                  {searchData?.hasValidBaseline && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Target: {(searchData.targetImpressions ?? 0).toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{(searchData?.clicks ?? 0).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Clicks</div>
                  {searchData?.hasValidBaseline && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Target: {(searchData.targetClicks ?? 0).toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {searchData?.hasValidBaseline 
                      ? `${(searchData.targetAchievementPercent ?? 0).toFixed(0)}%`
                      : "N/A"
                    }
                  </div>
                  <div className="text-xs text-muted-foreground">Target Achievement</div>
                  {searchData?.hasValidBaseline && (
                    <div className={`flex items-center justify-center gap-1 text-xs ${(searchData.targetAchievementPercent ?? 0) >= 100 ? 'text-emerald-500' : (searchData.targetAchievementPercent ?? 0) >= 70 ? 'text-amber-500' : 'text-red-500'}`}>
                      {(searchData.targetAchievementPercent ?? 0) >= 100 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {(searchData.targetAchievementPercent ?? 0) >= 100 ? "On target" : "Below target"}
                    </div>
                  )}
                </div>
              </div>
            )}

            {searchChartData.length > 0 && (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={searchChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="impressions" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="clicks" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {searchChartData.length === 0 && !searchMetricsLoading && (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No Search Console data yet</p>
                <p className="text-xs">Data will appear after syncing</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Organic Installs Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Download className="h-5 w-5" />
              Organic Installs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {organicLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                    <div className="text-3xl font-bold">{organicData?.organicPercentage?.toFixed(1) ?? 0}%</div>
                    <div className="text-sm text-muted-foreground">Organic Rate</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-3xl font-bold">{(organicData?.totalInstalls ?? 0).toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Total Installs</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-xl font-semibold">{(organicData?.appStoreSearch ?? 0).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">App Store Search</div>
                  </div>
                  <div>
                    <div className="text-xl font-semibold">{(organicData?.appStoreBrowse ?? 0).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">App Store Browse</div>
                  </div>
                </div>

                {organicVsPaidData.length > 0 && organicData && (organicData.totalOrganic > 0 || organicData.paidInstalls > 0) && (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={organicVsPaidData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          <Cell fill="#10b981" />
                          <Cell fill="#6366f1" />
                        </Pie>
                        <Tooltip formatter={(value: number) => value.toLocaleString()} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Rating Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Star className="h-5 w-5" />
              Rating Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scoreLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-8 w-8 ${
                        star <= Math.round(scoreData?.components?.rating?.averageRating ?? 0)
                          ? "text-amber-400 fill-amber-400"
                          : "text-muted/30"
                      }`}
                    />
                  ))}
                </div>
                <div className="text-4xl font-bold">
                  {(scoreData?.components?.rating?.averageRating ?? 0).toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Average across all platforms
                </div>
                <div className="text-xs text-muted-foreground">
                  {scoreData?.components?.rating?.reviewCount ?? 0} reviews this month (target: {scoreData?.components?.rating?.volumeTarget ?? 10})
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Referrals Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Share2 className="h-5 w-5" />
              Referral Signups
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {referralLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                    <div className="text-3xl font-bold">{referralData?.referralPercent?.toFixed(1) ?? 0}%</div>
                    <div className="text-sm text-muted-foreground">Referral Rate</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-3xl font-bold">{(referralData?.referralCount ?? 0).toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Referral Signups</div>
                  </div>
                </div>

                <div className="text-center p-4 rounded-lg bg-muted/30">
                  <div className="text-xl font-semibold">{(referralData?.totalSignups ?? 0).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Total Signups (Last 30 Days)</div>
                </div>

                {referralData && (referralData.referralCount > 0 || (referralData.totalSignups - referralData.referralCount) > 0) && (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Referral", value: referralData.referralCount },
                            { name: "Other", value: referralData.totalSignups - referralData.referralCount },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          <Cell fill="#10b981" />
                          <Cell fill="#6366f1" />
                        </Pie>
                        <Tooltip formatter={(value: number) => value.toLocaleString()} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly NPS Trend Chart */}
      {monthlyNpsChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">NPS Trend (Last 12 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyNpsChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis domain={[-100, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
                            <p className="font-semibold mb-1">{label}</p>
                            <p className={cn(
                              "text-lg font-bold",
                              data.nps >= 50 ? "text-emerald-500" : data.nps >= 0 ? "text-amber-500" : "text-red-500"
                            )}>
                              NPS: {data.nps > 0 ? '+' : ''}{data.nps}
                            </p>
                            <p className="text-xs text-muted-foreground">{data.responses} responses</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar 
                    dataKey="nps" 
                    name="NPS Score" 
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
