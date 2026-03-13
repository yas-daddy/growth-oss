import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Account for 4-day data delay in all platforms
const DATA_DELAY_DAYS = 4;

interface WeekScore {
  weekStart: string;
  totalScore: number;
  npsScore: number;
  searchVisibilityScore: number;
  ratingScore: number;
  organicInstallsScore: number;
  referralsScore: number;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
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
): number {
  // Minimum thresholds to avoid division by zero
  const MIN_IMPRESSIONS = 100;
  const MIN_CLICKS = 10;

  // If no valid baseline, return a fallback score
  if (!hasValidBaseline) {
    const hasActivity = currentImpressions > 0 || currentClicks > 0;
    return hasActivity ? 25 : 0;
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
  return Math.min(100, Math.round(targetAchievementPercent));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for weeks parameter
    let weeks = 52;
    try {
      const body = await req.json();
      if (body.weeks && typeof body.weeks === "number") {
        weeks = Math.min(104, Math.max(1, body.weeks)); // Cap at 2 years
      }
    } catch {
      // Use default
    }

    console.log(`Calculating brand scores for last ${weeks} weeks...`);

    // Get current reference date (today minus data delay)
    const referenceDate = new Date();
    referenceDate.setDate(referenceDate.getDate() - DATA_DELAY_DAYS);
    
    // Get the Monday of the current week (based on reference date)
    const currentMonday = getMonday(referenceDate);

    // Check which weeks are already locked
    const { data: existingScores } = await supabase
      .from("weekly_brand_scores")
      .select("week_start, is_locked")
      .eq("is_locked", true);

    const lockedWeeks = new Set(existingScores?.map(s => s.week_start) || []);

    const scoresToUpsert: WeekScore[] = [];

    // Calculate scores for each week
    for (let i = 0; i < weeks; i++) {
      const weekStart = new Date(currentMonday);
      weekStart.setDate(weekStart.getDate() - (i * 7));
      const weekStartStr = formatDate(weekStart);

      // Skip locked weeks
      if (lockedWeeks.has(weekStartStr)) {
        console.log(`Skipping locked week: ${weekStartStr}`);
        continue;
      }

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      // For calculations, use 30 days ending at weekEnd (shifted by data delay)
      const currentEnd = formatDate(weekEnd);
      const currentStart = new Date(weekEnd);
      currentStart.setDate(currentStart.getDate() - 30);
      const currentStartStr = formatDate(currentStart);

      // Previous 30 days for comparison
      const prevEnd = new Date(currentStart);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - 30);
      const prevStartStr = formatDate(prevStart);
      const prevEndStr = formatDate(prevEnd);

      // ==================== NPS COMPONENT ====================
      const [currentNPSData, prevNPSData] = await Promise.all([
        supabase
          .from("typeform_surveys")
          .select("nps_score")
          .not("nps_score", "is", null)
          .gte("submitted_at", currentStartStr)
          .lte("submitted_at", currentEnd),
        supabase
          .from("typeform_surveys")
          .select("nps_score")
          .not("nps_score", "is", null)
          .gte("submitted_at", prevStartStr)
          .lte("submitted_at", prevEndStr),
      ]);

      const currentNPS = calculateNPSFromScores(
        (currentNPSData.data || []).map(d => d.nps_score as number)
      );
      const previousNPS = calculateNPSFromScores(
        (prevNPSData.data || []).map(d => d.nps_score as number)
      );

      let npsBaseScore = 0;
      if (currentNPS !== null && currentNPS > 0) {
        npsBaseScore = Math.min(80, (currentNPS / 100) * 80);
      }

      let npsGrowthBonus = 0;
      if (currentNPS !== null && previousNPS !== null && currentNPS > previousNPS) {
        npsGrowthBonus = Math.min(20, (currentNPS - previousNPS) * 2);
      }

      const npsScore = Math.round(npsBaseScore + npsGrowthBonus);

      // ==================== SEARCH VISIBILITY COMPONENT ====================
      // Get baseline from 12 months ago (30-day window)
      const baselineEnd = new Date(weekEnd);
      baselineEnd.setFullYear(baselineEnd.getFullYear() - 1);
      const baselineEndStr = formatDate(baselineEnd);
      const baselineStart = new Date(baselineEnd);
      baselineStart.setDate(baselineStart.getDate() - 30);
      const baselineStartStr = formatDate(baselineStart);

      const [currentGSC, baselineGSC] = await Promise.all([
        supabase
          .from("google_search_console_metrics")
          .select("impressions, clicks")
          .gte("date", currentStartStr)
          .lte("date", currentEnd),
        supabase
          .from("google_search_console_metrics")
          .select("impressions, clicks")
          .gte("date", baselineStartStr)
          .lte("date", baselineEndStr),
      ]);

      const currentImpressions = (currentGSC.data || []).reduce((sum, d) => sum + (d.impressions || 0), 0);
      const currentClicks = (currentGSC.data || []).reduce((sum, d) => sum + (d.clicks || 0), 0);
      const baselineImpressions = (baselineGSC.data || []).reduce((sum, d) => sum + (d.impressions || 0), 0);
      const baselineClicks = (baselineGSC.data || []).reduce((sum, d) => sum + (d.clicks || 0), 0);

      // Check if baseline has valid data
      const hasValidBaseline = (baselineGSC.data || []).length > 0 && 
        (baselineImpressions > 0 || baselineClicks > 0);

      const searchVisibilityScore = calculateSearchVisibilityScore(
        currentImpressions,
        currentClicks,
        baselineImpressions,
        baselineClicks,
        hasValidBaseline
      );

      // ==================== RATING COMPONENT ====================
      // For rating, use reviews from the 30-day period
      const [appStoreCurrent, googlePlayCurrent, trustpilotCurrent] = await Promise.all([
        supabase
          .from("app_store_reviews")
          .select("stars")
          .gte("created_at", currentStartStr)
          .lte("created_at", currentEnd),
        supabase
          .from("google_play_reviews")
          .select("stars")
          .gte("review_created_at", currentStartStr)
          .lte("review_created_at", currentEnd),
        supabase
          .from("trustpilot_reviews")
          .select("stars")
          .gte("created_at", currentStartStr)
          .lte("created_at", currentEnd),
      ]);

      const [appStorePrev, googlePlayPrev, trustpilotPrev] = await Promise.all([
        supabase
          .from("app_store_reviews")
          .select("id", { count: "exact", head: true })
          .gte("created_at", prevStartStr)
          .lte("created_at", prevEndStr),
        supabase
          .from("google_play_reviews")
          .select("id", { count: "exact", head: true })
          .gte("review_created_at", prevStartStr)
          .lte("review_created_at", prevEndStr),
        supabase
          .from("trustpilot_reviews")
          .select("id", { count: "exact", head: true })
          .gte("created_at", prevStartStr)
          .lte("created_at", prevEndStr),
      ]);

      const currentReviews = [
        ...(appStoreCurrent.data || []).map(r => r.stars),
        ...(googlePlayCurrent.data || []).map(r => r.stars),
        ...(trustpilotCurrent.data || []).map(r => r.stars),
      ];

      const prevReviewCount = 
        (appStorePrev.count || 0) + 
        (googlePlayPrev.count || 0) + 
        (trustpilotPrev.count || 0);

      const reviewCount = currentReviews.length;
      const averageRating = reviewCount > 0
        ? currentReviews.reduce((a, b) => a + b, 0) / reviewCount
        : 0;

      const volumeTarget = Math.max(10, Math.round(prevReviewCount * 1.2));
      const qualityScore = Math.round((averageRating / 5) * 70);
      const volumeScore = Math.min(30, Math.round((reviewCount / volumeTarget) * 30));
      const ratingScore = qualityScore + volumeScore;

      // ==================== ORGANIC INSTALLS COMPONENT ====================
      const [organicData, paidData] = await Promise.all([
        supabase
          .from("appstore_organic_metrics")
          .select("downloads")
          .gte("date", currentStartStr)
          .lte("date", currentEnd),
        supabase
          .from("daily_appsflyer_installs")
          .select("installs")
          .gte("date", currentStartStr)
          .lte("date", currentEnd),
      ]);

      const totalOrganic = (organicData.data || []).reduce((sum, d) => sum + (d.downloads || 0), 0);
      const paidInstalls = (paidData.data || []).reduce((sum, d) => sum + (d.installs || 0), 0);
      const totalInstalls = totalOrganic + paidInstalls;
      const organicPercent = totalInstalls > 0 ? (totalOrganic / totalInstalls) * 100 : 0;
      const organicInstallsScore = Math.min(100, Math.round(organicPercent));

      // ==================== REFERRALS COMPONENT ====================
      const [referralSignups, totalSignups] = await Promise.all([
        supabase
          .from("mixpanel_events")
          .select("*", { count: "exact", head: true })
          .eq("event_name", "signup_completed_referral")
          .gte("event_time", `${currentStartStr}T00:00:00Z`)
          .lte("event_time", `${currentEnd}T23:59:59Z`),
        supabase
          .from("mixpanel_events")
          .select("*", { count: "exact", head: true })
          .eq("event_name", "signup_completed")
          .gte("event_time", `${currentStartStr}T00:00:00Z`)
          .lte("event_time", `${currentEnd}T23:59:59Z`),
      ]);

      const referralCount = referralSignups.count || 0;
      const signupCount = totalSignups.count || 0;
      const referralPercent = signupCount > 0 ? (referralCount / signupCount) * 100 : 0;
      const referralsScore = Math.min(100, Math.round(referralPercent));

      // ==================== TOTAL SCORE ====================
      const totalScore = npsScore + searchVisibilityScore + ratingScore + organicInstallsScore + referralsScore;

      scoresToUpsert.push({
        weekStart: weekStartStr,
        totalScore,
        npsScore,
        searchVisibilityScore,
        ratingScore,
        organicInstallsScore,
        referralsScore,
      });

      console.log(`Week ${weekStartStr}: total=${totalScore}, nps=${npsScore}, search=${searchVisibilityScore}, rating=${ratingScore}, organic=${organicInstallsScore}`);
    }

    // Upsert all scores
    if (scoresToUpsert.length > 0) {
      const records = scoresToUpsert.map(s => ({
        week_start: s.weekStart,
        total_score: s.totalScore,
        nps_score: s.npsScore,
        search_visibility_score: s.searchVisibilityScore,
        rating_score: s.ratingScore,
        organic_installs_score: s.organicInstallsScore,
        referrals_score: s.referralsScore,
        updated_at: new Date().toISOString(),
      }));

      const { error: upsertError } = await supabase
        .from("weekly_brand_scores")
        .upsert(records, { onConflict: "week_start" });

      if (upsertError) {
        console.error("Upsert error:", upsertError);
        throw upsertError;
      }
    }

    console.log(`Successfully calculated ${scoresToUpsert.length} weekly brand scores`);

    return new Response(
      JSON.stringify({
        success: true,
        weeksCalculated: scoresToUpsert.length,
        weeksSkipped: weeks - scoresToUpsert.length,
        message: `Calculated ${scoresToUpsert.length} weekly brand scores`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error calculating brand scores:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
