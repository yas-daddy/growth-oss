import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { startSyncLog, completeSyncLog } from "../_shared/sync-logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MonthlyMetrics {
  month_start: string;
  spend_by_channel: Record<string, number>;
  clicks_by_channel: Record<string, number>;
  ftds_by_channel: Record<string, number>;
  cpa_by_channel: Record<string, number>;
  affiliate_metrics: Record<string, { name: string; spend: number; ftds: number }>;
  total_installs: number;
  total_signups: number;
  total_ftds: number;
  total_stds: number;
  total_ad_spend: number;
  total_affiliate_spend: number;
  total_spend: number;
  blended_cac: number;
  blended_cpa: number;
  cvr_install_to_signup: number;
  cvr_signup_to_ftd: number;
  cvr_ftd_to_std: number;
  cvr_install_to_std: number;
  ftd_cohort_deposits: number;
  avg_deposit_per_ftd: number;
  ad_spend_per_1k_deposit: number;
  net_deposits_new_users: number;
  new_users_net_deposits: number;
  roas: number;
  avg_rating: number;
}

// Mapping from AppsFlyer media_source to normalized channel names
const MEDIA_SOURCE_TO_CHANNEL: Record<string, string> = {
  'Facebook Ads': 'meta',
  'Apple Search Ads': 'apple',
  'moloco_int': 'moloco',
};

// Normalize media source to match daily_ad_spend platform names
function normalizeChannel(mediaSource: string): string {
  return MEDIA_SOURCE_TO_CHANNEL[mediaSource] || mediaSource;
}

// Get first day of month for a given date
function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

// Get last day of month for a given date
function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

// Format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const syncLog = await startSyncLog('calculate-monthly-metrics');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    const dayOfMonth = today.getDate();
    
    // Smart month calculation:
    // - Always calculate current month
    // - Only calculate previous month if we're still in the first 3 days of the new month
    // This prevents unnecessary recalculation of historical months that won't change
    const monthsToCalculate = dayOfMonth <= 3 ? 2 : 1;
    
    console.log(`Day of month: ${dayOfMonth}. Calculating ${monthsToCalculate} month(s)...`);

    // Get channel weights for weighted rating calculation
    const { data: channelWeights } = await supabase
      .from('channel_weights')
      .select('*')
      .limit(1)
      .maybeSingle();

    const weights = {
      app_store: channelWeights?.app_store_weight ?? 1,
      google_play: channelWeights?.google_play_weight ?? 1,
      trustpilot: channelWeights?.trustpilot_weight ?? 1,
    };

    // Get affiliates for name lookup
    const { data: affiliates } = await supabase
      .from('affiliates')
      .select('id, name');
    const affiliateMap = new Map(affiliates?.map(a => [a.id, a.name]) || []);

    // Get locked months to skip
    const { data: lockedMonths } = await supabase
      .from('monthly_metrics')
      .select('month_start')
      .eq('is_locked', true);
    
    const lockedMonthSet = new Set(lockedMonths?.map(m => m.month_start) || []);
    console.log(`Found ${lockedMonthSet.size} locked months that will be skipped`);

    const results: MonthlyMetrics[] = [];

    for (let i = 0; i < monthsToCalculate; i++) {
      const targetDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStart = getMonthStart(targetDate);
      const monthEnd = getMonthEnd(targetDate);
      
      const startStr = formatDate(monthStart);
      const endStr = formatDate(monthEnd);
      
      // Skip locked months
      if (lockedMonthSet.has(startStr)) {
        console.log(`Skipping locked month: ${startStr}`);
        continue;
      }
      
      const startTimestamp = `${startStr}T00:00:00.000Z`;
      const endTimestamp = `${endStr}T23:59:59.999Z`;

      console.log(`Processing month: ${startStr} to ${endStr}`);

      // 1. Get daily ad spend by channel
      const { data: dailySpend } = await supabase
        .from('daily_ad_spend')
        .select('platform, spend, clicks')
        .gte('date', startStr)
        .lte('date', endStr);

      const spendByChannel: Record<string, number> = {};
      const clicksByChannel: Record<string, number> = {};
      let totalAdSpend = 0;

      for (const row of dailySpend || []) {
        const channel = row.platform;
        spendByChannel[channel] = (spendByChannel[channel] || 0) + (row.spend || 0);
        clicksByChannel[channel] = (clicksByChannel[channel] || 0) + (row.clicks || 0);
        totalAdSpend += row.spend || 0;
      }

      // 2. Get FTDs by channel from AppsFlyer events
      const { data: afFtdEvents } = await supabase
        .from('appsflyer_events')
        .select('media_source, event_count')
        .eq('event_name', 'first_time_deposit')
        .gte('event_date', startStr)
        .lte('event_date', endStr);

      const ftdsByChannel: Record<string, number> = {};
      for (const row of afFtdEvents || []) {
        const channel = normalizeChannel(row.media_source);
        ftdsByChannel[channel] = (ftdsByChannel[channel] || 0) + (row.event_count || 0);
      }

      console.log(`FTDs by channel for month ${startStr}:`, JSON.stringify(ftdsByChannel));

      // Calculate CPA by channel
      const cpaByChannel: Record<string, number> = {};
      for (const channel of Object.keys(spendByChannel)) {
        const spend = spendByChannel[channel] || 0;
        const ftds = ftdsByChannel[channel] || 0;
        cpaByChannel[channel] = ftds > 0 ? spend / ftds : 0;
      }

      // 3. Get total installs from AppsFlyer
      const { data: installData } = await supabase
        .from('daily_appsflyer_installs')
        .select('installs')
        .gte('date', startStr)
        .lte('date', endStr);

      const totalInstalls = installData?.reduce((sum, r) => sum + (r.installs || 0), 0) || 0;

      // 4. Get funnel metrics from pre-aggregated daily_funnel_metrics table
      // This sums daily unique counts which is more accurate for monthly tracking
      const { data: funnelData } = await supabase
        .from('daily_funnel_metrics')
        .select('unique_signups, unique_ftds, unique_stds')
        .gte('date', startStr)
        .lte('date', endStr);

      const totalSignups = funnelData?.reduce((sum, r) => sum + (r.unique_signups || 0), 0) || 0;
      const totalFTDs = funnelData?.reduce((sum, r) => sum + (r.unique_ftds || 0), 0) || 0;
      const totalSTDs = funnelData?.reduce((sum, r) => sum + (r.unique_stds || 0), 0) || 0;

      // 5. Get affiliate spend
      const { data: affiliateSpendData } = await supabase
        .from('daily_affiliate_spend')
        .select('affiliate_id, spend, ftds')
        .gte('date', startStr)
        .lte('date', endStr);

      const affiliateMetrics: Record<string, { name: string; spend: number; ftds: number }> = {};
      let totalAffiliateSpend = 0;

      for (const row of affiliateSpendData || []) {
        const id = row.affiliate_id;
        if (!affiliateMetrics[id]) {
          affiliateMetrics[id] = { 
            name: affiliateMap.get(id) || 'Unknown', 
            spend: 0, 
            ftds: 0 
          };
        }
        affiliateMetrics[id].spend += row.spend || 0;
        affiliateMetrics[id].ftds += row.ftds || 0;
        totalAffiliateSpend += row.spend || 0;
      }

      const totalSpend = totalAdSpend + totalAffiliateSpend;

      // 6. Calculate blended metrics
      const blendedCAC = totalSignups > 0 ? totalSpend / totalSignups : 0;
      const blendedCPA = totalFTDs > 0 ? totalSpend / totalFTDs : 0;

      // 7. Conversion rates
      const cvrInstallToSignup = totalInstalls > 0 ? totalSignups / totalInstalls : 0;
      const cvrSignupToFTD = totalSignups > 0 ? totalFTDs / totalSignups : 0;
      const cvrFTDToSTD = totalFTDs > 0 ? totalSTDs / totalFTDs : 0;
      const cvrInstallToSTD = totalInstalls > 0 ? totalSTDs / totalInstalls : 0;

      // 8. FTD cohort deposits (using RPC function)
      const { data: cohortData, error: cohortError } = await supabase.rpc('get_ftd_cohort_deposits', {
        start_date: startTimestamp,
        end_date: endTimestamp,
      });

      if (cohortError) {
        console.error(`Error fetching FTD cohort deposits for ${startStr}:`, cohortError);
      }
      console.log(`FTD cohort data for ${startStr}:`, JSON.stringify(cohortData));

      const ftdCohortDeposits = cohortData?.[0]?.total_deposits || 0;
      // Calculate avg_deposit_per_ftd using total FTD events count (not unique users from RPC)
      // This ensures consistency: total_ftds and avg_deposit_per_ftd both use event counts
      const avgDepositPerFTD = totalFTDs > 0 ? ftdCohortDeposits / totalFTDs : 0;

      // 8b. New Users Net Deposits (deposits - withdrawals for FTD cohort)
      const { data: netDepositsData, error: netDepositsError } = await supabase.rpc('get_ftd_cohort_net_deposits', {
        start_date: startTimestamp,
        end_date: endTimestamp,
      });

      if (netDepositsError) {
        console.error(`Error fetching net deposits for ${startStr}:`, netDepositsError);
      }
      console.log(`Net deposits data for ${startStr}:`, JSON.stringify(netDepositsData));

      const newUsersNetDeposits = netDepositsData?.[0]?.net_deposits || 0;

      // 9. Ad spend per £1k deposit
      const adSpendPer1kDeposit = ftdCohortDeposits > 0 
        ? (totalAdSpend / ftdCohortDeposits) * 1000 
        : 0;

      // 10. Net deposits from AppsFlyer LTV (net_revenue events)
      const { data: netRevenueData } = await supabase
        .from('appsflyer_events')
        .select('event_revenue')
        .eq('event_name', 'net_revenue')
        .gte('event_date', startStr)
        .lte('event_date', endStr);

      const netDepositsNewUsers = netRevenueData?.reduce((sum, r) => sum + (r.event_revenue || 0), 0) || 0;

      // 11. ROAS (using new users net deposits from Mixpanel, total spend includes affiliates)
      const roas = totalSpend > 0 ? newUsersNetDeposits / totalSpend : 0;

      // 12. Average rating (weighted)
      const { data: appStoreReviews } = await supabase
        .from('app_store_reviews')
        .select('stars')
        .gte('created_at', startTimestamp)
        .lte('created_at', endTimestamp);

      const { data: googlePlayReviews } = await supabase
        .from('google_play_reviews')
        .select('stars')
        .gte('review_created_at', startTimestamp)
        .lte('review_created_at', endTimestamp);

      const { data: trustpilotReviews } = await supabase
        .from('trustpilot_reviews')
        .select('stars')
        .gte('created_at', startTimestamp)
        .lte('created_at', endTimestamp);

      const appStoreAvg = appStoreReviews?.length 
        ? appStoreReviews.reduce((sum, r) => sum + r.stars, 0) / appStoreReviews.length 
        : 0;
      const googlePlayAvg = googlePlayReviews?.length 
        ? googlePlayReviews.reduce((sum, r) => sum + r.stars, 0) / googlePlayReviews.length 
        : 0;
      const trustpilotAvg = trustpilotReviews?.length 
        ? trustpilotReviews.reduce((sum, r) => sum + r.stars, 0) / trustpilotReviews.length 
        : 0;

      // Calculate weighted average rating
      let weightedSum = 0;
      let weightTotal = 0;
      if (appStoreReviews?.length) {
        weightedSum += appStoreAvg * weights.app_store;
        weightTotal += weights.app_store;
      }
      if (googlePlayReviews?.length) {
        weightedSum += googlePlayAvg * weights.google_play;
        weightTotal += weights.google_play;
      }
      if (trustpilotReviews?.length) {
        weightedSum += trustpilotAvg * weights.trustpilot;
        weightTotal += weights.trustpilot;
      }
      const avgRating = weightTotal > 0 ? weightedSum / weightTotal : 0;

      results.push({
        month_start: startStr,
        spend_by_channel: spendByChannel,
        clicks_by_channel: clicksByChannel,
        ftds_by_channel: ftdsByChannel,
        cpa_by_channel: cpaByChannel,
        affiliate_metrics: affiliateMetrics,
        total_installs: totalInstalls,
        total_signups: totalSignups,
        total_ftds: totalFTDs,
        total_stds: totalSTDs,
        total_ad_spend: totalAdSpend,
        total_affiliate_spend: totalAffiliateSpend,
        total_spend: totalSpend,
        blended_cac: blendedCAC,
        blended_cpa: blendedCPA,
        cvr_install_to_signup: cvrInstallToSignup,
        cvr_signup_to_ftd: cvrSignupToFTD,
        cvr_ftd_to_std: cvrFTDToSTD,
        cvr_install_to_std: cvrInstallToSTD,
        ftd_cohort_deposits: ftdCohortDeposits,
        avg_deposit_per_ftd: avgDepositPerFTD,
        ad_spend_per_1k_deposit: adSpendPer1kDeposit,
        net_deposits_new_users: netDepositsNewUsers,
        new_users_net_deposits: newUsersNetDeposits,
        roas: roas,
        avg_rating: avgRating,
      });
    }

    // Upsert all monthly metrics
    console.log(`Upserting ${results.length} monthly metrics...`);
    
    const { error: upsertError } = await supabase
      .from('monthly_metrics')
      .upsert(results, { onConflict: 'month_start' });

    if (upsertError) {
      console.error('Upsert error:', upsertError);
      throw upsertError;
    }

    console.log('Monthly metrics calculation complete');

    await completeSyncLog(syncLog?.id || null, true);

    return new Response(
      JSON.stringify({ 
        success: true, 
        monthsProcessed: results.length,
        months: results.map(r => r.month_start),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error calculating monthly metrics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await completeSyncLog(syncLog?.id || null, false, errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
