import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganicInstallsSummary } from "./useOrganicInstalls";
import { useSearchConsoleSummary } from "./useSearchConsoleMetrics";

interface NPSComponent {
  score: number;
  baseScore: number;
  growthBonus: number;
  currentNPS: number | null;
  previousNPS: number | null;
}

interface SearchVisibilityComponent {
  score: number;
  currentImpressions: number;
  currentClicks: number;
  targetImpressions: number;
  targetClicks: number;
  targetAchievementPercent: number;
  hasValidBaseline: boolean;
}

interface RatingComponent {
  score: number;
  qualityScore: number;
  volumeScore: number;
  averageRating: number;
  reviewCount: number;
  volumeTarget: number;
}

interface OrganicInstallsComponent {
  score: number;
  organicPercent: number;
}

interface ReferralsComponent {
  score: number;
  isPlaceholder: boolean;
  referralCount?: number;
  totalSignups?: number;
  referralPercent?: number;
}

export interface BrandScoreResult {
  totalScore: number;
  scoreLabel: string;
  efficiencyMultiplier: number;
  efficiencyMultiplierRange: string;
  components: {
    nps: NPSComponent;
    searchVisibility: SearchVisibilityComponent;
    rating: RatingComponent;
    organicInstalls: OrganicInstallsComponent;
    referrals: ReferralsComponent;
  };
}

interface TierInfo {
  label: string;
  multiplierRange: string;
  multiplier: number;
}

function getTierInfo(score: number): TierInfo {
  if (score <= 99) return { label: "Nascent", multiplierRange: "1.0×", multiplier: 1.0 };
  if (score <= 199) return { label: "Emerging", multiplierRange: "1.0–1.3×", multiplier: 1.0 + ((score - 100) / 100) * 0.3 };
  if (score <= 299) return { label: "Scaling", multiplierRange: "1.3–1.8×", multiplier: 1.3 + ((score - 200) / 100) * 0.5 };
  if (score <= 399) return { label: "Established", multiplierRange: "1.8–2.4×", multiplier: 1.8 + ((score - 300) / 100) * 0.6 };
  return { label: "Leading", multiplierRange: "2.4–2.9×", multiplier: 2.4 + ((score - 400) / 100) * 0.5 };
}

function getScoreLabel(score: number): string {
  return getTierInfo(score).label;
}

function calculateNPSFromScores(scores: number[]): number | null {
  if (scores.length === 0) return null;
  
  let promoters = 0;
  let detractors = 0;
  
  for (const score of scores) {
    if (score >= 9) promoters++;
    else if (score <= 6) detractors++;
  }
  
  const total = scores.length;
  return Math.round(((promoters / total) - (detractors / total)) * 100);
}

function calculateSearchVisibilityScore(
  currentImpressions: number,
  currentClicks: number,
  baselineImpressions: number,
  baselineClicks: number,
  hasValidBaseline: boolean
): { score: number; targetAchievementPercent: number; hasValidBaseline: boolean } {
  // Minimum thresholds to avoid division by zero
  const MIN_IMPRESSIONS = 100;
  const MIN_CLICKS = 10;

  // If no valid baseline, return a fallback score based on absolute values
  if (!hasValidBaseline) {
    // Fallback: score based on having any activity (0-50 range)
    const hasActivity = currentImpressions > 0 || currentClicks > 0;
    return { 
      score: hasActivity ? 25 : 0, 
      targetAchievementPercent: 0, 
      hasValidBaseline: false 
    };
  }

  // Calculate targets: baseline × 1.2^12 (12 months of 20% compound growth)
  const compoundMultiplier = Math.pow(1.2, 12); // ≈ 8.916
  const safeBaselineImpressions = Math.max(baselineImpressions, MIN_IMPRESSIONS);
  const safeBaselineClicks = Math.max(baselineClicks, MIN_CLICKS);
  const targetImpressions = safeBaselineImpressions * compoundMultiplier;
  const targetClicks = safeBaselineClicks * compoundMultiplier;

  // Calculate achievement percentages
  const impressionsAchievement = currentImpressions / targetImpressions;
  const clicksAchievement = currentClicks / targetClicks;
  const avgAchievement = (impressionsAchievement + clicksAchievement) / 2;
  const targetAchievementPercent = avgAchievement * 100;

  // Score = % of target achieved, capped at 100
  const score = Math.min(100, Math.round(targetAchievementPercent));

  return { score, targetAchievementPercent, hasValidBaseline: true };
}

export function useBrandScore() {
  const { data: organicData, isLoading: organicLoading } = useOrganicInstallsSummary();
  const { data: searchData, isLoading: searchLoading } = useSearchConsoleSummary();

  return useQuery({
    queryKey: ["brand-score", organicData, searchData],
    queryFn: async (): Promise<BrandScoreResult> => {
      // Account for 4-day data delay in all platforms
      const DATA_DELAY_DAYS = 4;
      const referenceDate = new Date();
      referenceDate.setDate(referenceDate.getDate() - DATA_DELAY_DAYS);

      const thirtyDaysAgo = new Date(referenceDate);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sixtyDaysAgo = new Date(referenceDate);
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const currentEnd = referenceDate.toISOString().split("T")[0];
      const currentStart = thirtyDaysAgo.toISOString().split("T")[0];
      const prevStart = sixtyDaysAgo.toISOString().split("T")[0];

      // ==================== NPS COMPONENT ====================
      // Get current 30 days NPS scores
      const { data: currentNPSData } = await supabase
        .from("typeform_surveys")
        .select("nps_score")
        .not("nps_score", "is", null)
        .gte("submitted_at", currentStart)
        .lte("submitted_at", currentEnd);

      // Get previous 30 days NPS scores
      const { data: prevNPSData } = await supabase
        .from("typeform_surveys")
        .select("nps_score")
        .not("nps_score", "is", null)
        .gte("submitted_at", prevStart)
        .lt("submitted_at", currentStart);

      const currentNPS = calculateNPSFromScores(
        (currentNPSData || []).map(d => d.nps_score as number)
      );
      const previousNPS = calculateNPSFromScores(
        (prevNPSData || []).map(d => d.nps_score as number)
      );

      // NPS Score: If negative, 0 points. If positive, (NPS / 100) * 80 for up to 80 points
      let npsBaseScore = 0;
      if (currentNPS !== null && currentNPS > 0) {
        npsBaseScore = Math.min(80, (currentNPS / 100) * 80);
      }

      // Growth bonus: up to 20 points for improvement
      let npsGrowthBonus = 0;
      if (currentNPS !== null && previousNPS !== null && currentNPS > previousNPS) {
        npsGrowthBonus = Math.min(20, (currentNPS - previousNPS) * 2);
      }

      const npsComponent: NPSComponent = {
        score: Math.round(npsBaseScore + npsGrowthBonus),
        baseScore: Math.round(npsBaseScore),
        growthBonus: Math.round(npsGrowthBonus),
        currentNPS,
        previousNPS,
      };

      // ==================== SEARCH VISIBILITY COMPONENT ====================
      const currentImpressions = searchData?.impressions ?? 0;
      const currentClicks = searchData?.clicks ?? 0;
      const baselineImpressions = searchData?.baselineImpressions ?? 0;
      const baselineClicks = searchData?.baselineClicks ?? 0;
      const hasValidBaseline = searchData?.hasValidBaseline ?? false;

      const { score: searchScore, targetAchievementPercent, hasValidBaseline: validBaseline } = calculateSearchVisibilityScore(
        currentImpressions,
        currentClicks,
        baselineImpressions,
        baselineClicks,
        hasValidBaseline
      );

      // Calculate targets for display
      const compoundMultiplier = Math.pow(1.2, 12);
      const MIN_IMPRESSIONS = 100;
      const MIN_CLICKS = 10;
      const targetImpressions = Math.round(Math.max(baselineImpressions, MIN_IMPRESSIONS) * compoundMultiplier);
      const targetClicks = Math.round(Math.max(baselineClicks, MIN_CLICKS) * compoundMultiplier);

      const searchVisibilityComponent: SearchVisibilityComponent = {
        score: searchScore,
        currentImpressions,
        currentClicks,
        targetImpressions,
        targetClicks,
        targetAchievementPercent,
        hasValidBaseline: validBaseline,
      };

      // ==================== RATING COMPONENT ====================
      // Get reviews from the 30-day period (using reference date with offset)
      const currentMonthStart = currentStart;
      const prevPeriodStart = prevStart;
      const prevPeriodEnd = new Date(thirtyDaysAgo);
      prevPeriodEnd.setDate(prevPeriodEnd.getDate() - 1);
      const prevPeriodEndStr = prevPeriodEnd.toISOString().split("T")[0];

      // Current period reviews from all platforms
      const [appStoreCurrent, googlePlayCurrent, trustpilotCurrent] = await Promise.all([
        supabase
          .from("app_store_reviews")
          .select("stars")
          .gte("created_at", currentMonthStart)
          .lte("created_at", currentEnd),
        supabase
          .from("google_play_reviews")
          .select("stars")
          .gte("review_created_at", currentMonthStart)
          .lte("review_created_at", currentEnd),
        supabase
          .from("trustpilot_reviews")
          .select("stars")
          .gte("created_at", currentMonthStart)
          .lte("created_at", currentEnd),
      ]);

      // Previous period reviews count for volume target
      const [appStorePrev, googlePlayPrev, trustpilotPrev] = await Promise.all([
        supabase
          .from("app_store_reviews")
          .select("id", { count: "exact", head: true })
          .gte("created_at", prevPeriodStart)
          .lte("created_at", prevPeriodEndStr),
        supabase
          .from("google_play_reviews")
          .select("id", { count: "exact", head: true })
          .gte("review_created_at", prevPeriodStart)
          .lte("review_created_at", prevPeriodEndStr),
        supabase
          .from("trustpilot_reviews")
          .select("id", { count: "exact", head: true })
          .gte("created_at", prevPeriodStart)
          .lte("created_at", prevPeriodEndStr),
      ]);

      const currentReviews = [
        ...(appStoreCurrent.data || []).map(r => r.stars),
        ...(googlePlayCurrent.data || []).map(r => r.stars),
        ...(trustpilotCurrent.data || []).map(r => r.stars),
      ];

      const lastMonthReviewCount = 
        (appStorePrev.count || 0) + 
        (googlePlayPrev.count || 0) + 
        (trustpilotPrev.count || 0);

      const reviewCount = currentReviews.length;
      const averageRating = reviewCount > 0
        ? currentReviews.reduce((a, b) => a + b, 0) / reviewCount
        : 0;

      // Volume target = last month + 20%, minimum 10
      const volumeTarget = Math.max(10, Math.round(lastMonthReviewCount * 1.2));

      // Quality score: (avg_rating / 5) * 70
      const qualityScore = Math.round((averageRating / 5) * 70);

      // Volume score: min(30, (reviewCount / target) * 30)
      const volumeScore = Math.min(30, Math.round((reviewCount / volumeTarget) * 30));

      const ratingComponent: RatingComponent = {
        score: qualityScore + volumeScore,
        qualityScore,
        volumeScore,
        averageRating,
        reviewCount,
        volumeTarget,
      };

      // ==================== ORGANIC INSTALLS COMPONENT ====================
      const organicPercent = organicData?.organicPercentage ?? 0;
      const organicScore = Math.round(organicPercent);

      const organicInstallsComponent: OrganicInstallsComponent = {
        score: Math.min(100, organicScore),
        organicPercent,
      };

      // ==================== REFERRALS COMPONENT ====================
      const [referralSignups, totalSignupsResult] = await Promise.all([
        supabase
          .from("mixpanel_events")
          .select("*", { count: "exact", head: true })
          .eq("event_name", "signup_completed_referral")
          .gte("event_time", `${currentStart}T00:00:00Z`)
          .lte("event_time", `${currentEnd}T23:59:59Z`),
        supabase
          .from("mixpanel_events")
          .select("*", { count: "exact", head: true })
          .eq("event_name", "signup_completed")
          .gte("event_time", `${currentStart}T00:00:00Z`)
          .lte("event_time", `${currentEnd}T23:59:59Z`),
      ]);

      const referralCount = referralSignups.count || 0;
      const signupCount = totalSignupsResult.count || 0;
      const referralPercent = signupCount > 0 ? (referralCount / signupCount) * 100 : 0;

      const referralsComponent: ReferralsComponent = {
        score: Math.min(100, Math.round(referralPercent)),
        isPlaceholder: false,
        referralCount,
        totalSignups: signupCount,
        referralPercent,
      };

      // ==================== TOTAL SCORE ====================
      const totalScore = 
        npsComponent.score +
        searchVisibilityComponent.score +
        ratingComponent.score +
        organicInstallsComponent.score +
        referralsComponent.score;

      const tierInfo = getTierInfo(totalScore);

      return {
        totalScore,
        scoreLabel: tierInfo.label,
        efficiencyMultiplier: tierInfo.multiplier,
        efficiencyMultiplierRange: tierInfo.multiplierRange,
        components: {
          nps: npsComponent,
          searchVisibility: searchVisibilityComponent,
          rating: ratingComponent,
          organicInstalls: organicInstallsComponent,
          referrals: referralsComponent,
        },
      };
    },
    enabled: !organicLoading && !searchLoading,
  });
}
