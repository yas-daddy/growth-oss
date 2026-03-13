import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface SyncResult {
  function: string;
  success: boolean;
  duration: number;
  error?: string;
}

async function callFunction(functionName: string): Promise<SyncResult> {
  const startTime = Date.now();
  try {
    console.log(`Calling ${functionName}...`);
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({}),
    });

    const duration = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${functionName} failed: ${errorText}`);
      return { function: functionName, success: false, duration, error: errorText };
    }

    console.log(`${functionName} completed in ${duration}ms`);
    return { function: functionName, success: true, duration };
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`${functionName} error:`, error);
    return { function: functionName, success: false, duration, error: errorMessage };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('=== NIGHTLY SYNC STARTED ===');
  console.log(`Start time: ${new Date().toISOString()}`);

  const results: SyncResult[] = [];

  try {
    // Step 1: Sync all APIs (run in sequence to avoid overwhelming the system)
    const apiSyncFunctions = [
      'meta-sync-campaigns',
      'meta-sync-ads',           // Ad-level data for creative analysis
      'moloco-sync-campaigns',   // Includes creative-level data
      'apple-sync-campaigns',
      'apple-sync-keywords',     // Keyword data for keyword analysis
      'appsflyer-sync',
      'appsflyer-keyword-sync',  // Keyword conversion data
      'mixpanel-sync',
      'trustpilot-sync',
      'app-store-sync',
      'google-play-sync',
    ];

    console.log('--- Step 1: Syncing APIs ---');
    for (const fn of apiSyncFunctions) {
      const result = await callFunction(fn);
      results.push(result);
      // Small delay between syncs to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Step 2: Calculate weekly metrics
    console.log('--- Step 2: Calculating weekly metrics ---');
    const weeklyMetricsStart = Date.now();
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/calculate-weekly-metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ weeks: 4 }),
      });

      const duration = Date.now() - weeklyMetricsStart;
      if (!response.ok) {
        const errorText = await response.text();
        results.push({ function: 'calculate-weekly-metrics', success: false, duration, error: errorText });
      } else {
        results.push({ function: 'calculate-weekly-metrics', success: true, duration });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({ function: 'calculate-weekly-metrics', success: false, duration: Date.now() - weeklyMetricsStart, error: errorMessage });
    }

    // Step 3: Calculate monthly metrics
    // Function now auto-determines: current month always, previous month only until 3rd of new month
    console.log('--- Step 3: Calculating monthly metrics ---');
    const monthlyMetricsResult = await callFunction('calculate-monthly-metrics');
    results.push(monthlyMetricsResult);

    // NOTE: populate-funnel-metrics now runs as an independent cron job (3:25 AM UTC)
    // to avoid timing out when called from this orchestrator

    // Step 4: Populate user FTD dates lookup table (for revenue metrics)
    console.log('--- Step 4b: Populating user FTD dates ---');
    const userFtdDatesStart = Date.now();
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/populate-user-ftd-dates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({}),
      });

      const duration = Date.now() - userFtdDatesStart;
      if (!response.ok) {
        const errorText = await response.text();
        results.push({ function: 'populate-user-ftd-dates', success: false, duration, error: errorText });
      } else {
        results.push({ function: 'populate-user-ftd-dates', success: true, duration });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({ function: 'populate-user-ftd-dates', success: false, duration: Date.now() - userFtdDatesStart, error: errorMessage });
    }

    // Step 5: Calculate NPS metrics
    console.log('--- Step 5: Calculating NPS metrics ---');
    const npsMetricsResult = await callFunction('calculate-nps-metrics');
    results.push(npsMetricsResult);

    // Step 6: Sync Google Search Console
    console.log('--- Step 6: Syncing Google Search Console ---');
    const searchConsoleResult = await callFunction('google-search-console-sync');
    results.push(searchConsoleResult);

    // Step 7: Sync App Store Analytics (organic installs)
    console.log('--- Step 7: Syncing App Store Analytics ---');
    const appstoreAnalyticsResult = await callFunction('appstore-analytics-sync');
    results.push(appstoreAnalyticsResult);

    // Step 8: Calculate weekly brand scores
    console.log('--- Step 8: Calculating brand scores ---');
    const brandScoresStart = Date.now();
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/calculate-brand-scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ weeks: 4 }), // Calculate last 4 weeks
      });

      const duration = Date.now() - brandScoresStart;
      if (!response.ok) {
        const errorText = await response.text();
        results.push({ function: 'calculate-brand-scores', success: false, duration, error: errorText });
      } else {
        results.push({ function: 'calculate-brand-scores', success: true, duration });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({ function: 'calculate-brand-scores', success: false, duration: Date.now() - brandScoresStart, error: errorMessage });
    }

    // Step 9: Auto-respond to reviews
    console.log('--- Step 9: Auto-responding to reviews ---');
    const autoRespondResult = await callFunction('auto-respond-reviews');
    results.push(autoRespondResult);

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log('=== NIGHTLY SYNC COMPLETED ===');
    console.log(`Total duration: ${totalDuration}ms`);
    console.log(`Success: ${successCount}, Failed: ${failureCount}`);

    return new Response(JSON.stringify({
      success: failureCount === 0,
      totalDuration,
      successCount,
      failureCount,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Nightly sync fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      results,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
