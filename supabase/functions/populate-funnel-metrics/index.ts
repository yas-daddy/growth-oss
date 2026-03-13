import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startSyncLog, completeSyncLog } from "../_shared/sync-logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sleep helper for exponential backoff
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Generate array of dates between start and end (inclusive)
function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  
  return dates;
}

interface DayResult {
  date: string;
  success: boolean;
  result?: unknown;
  error?: string;
  attempts: number;
}

// Process a single day with retry logic
async function processSingleDay(
  supabase: SupabaseClient,
  targetDate: string,
  maxRetries: number = 3
): Promise<DayResult> {
  let attempts = 0;
  
  while (attempts < maxRetries) {
    attempts++;
    try {
      console.log(`Processing ${targetDate} (attempt ${attempts}/${maxRetries})`);
      
      // deno-lint-ignore no-explicit-any
      const { data, error } = await (supabase.rpc as any)('populate_daily_funnel_metrics_single_day', {
        target_date: targetDate,
      });
      
      if (error) {
        console.error(`Error for ${targetDate}:`, error.message);
        
        // If it's a timeout or transient error, retry
        if (attempts < maxRetries) {
          const backoffMs = 1000 * Math.pow(2, attempts); // 2s, 4s, 8s
          console.log(`Retrying ${targetDate} in ${backoffMs}ms...`);
          await sleep(backoffMs);
          continue;
        }
        
        return {
          date: targetDate,
          success: false,
          error: error.message,
          attempts,
        };
      }
      
      console.log(`✓ ${targetDate} completed:`, JSON.stringify(data));
      return {
        date: targetDate,
        success: true,
        result: data,
        attempts,
      };
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`Exception for ${targetDate}:`, errorMessage);
      
      if (attempts < maxRetries) {
        const backoffMs = 1000 * Math.pow(2, attempts);
        console.log(`Retrying ${targetDate} in ${backoffMs}ms...`);
        await sleep(backoffMs);
        continue;
      }
      
      return {
        date: targetDate,
        success: false,
        error: errorMessage,
        attempts,
      };
    }
  }
  
  // Should not reach here, but just in case
  return {
    date: targetDate,
    success: false,
    error: 'Max retries exceeded',
    attempts,
  };
}

// Log alert if a day failed
async function logAlert(
  supabase: SupabaseClient,
  alertDate: string,
  errorMessage: string
): Promise<void> {
  try {
    // deno-lint-ignore no-explicit-any
    await (supabase.from as any)('funnel_metric_alerts').insert({
      alert_date: alertDate,
      error_message: errorMessage,
      auto_fixed: false,
    });
  } catch (err) {
    console.error('Failed to log alert:', err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('=== POPULATE FUNNEL METRICS STARTED ===');
  
  let logId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Start sync log
    const syncLog = await startSyncLog('populate-funnel-metrics');
    logId = syncLog?.id ?? null;

    // Parse request body for custom date range or days
    let startDate: string;
    let endDate: string;
    
    try {
      const body = await req.json();
      if (body.start_date && body.end_date) {
        startDate = body.start_date;
        endDate = body.end_date;
      } else if (body.days) {
        // Calculate date range from days
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - body.days);
        startDate = start.toISOString().split('T')[0];
        endDate = end.toISOString().split('T')[0];
      } else {
        // Default: last 2 days
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 2);
        startDate = start.toISOString().split('T')[0];
        endDate = end.toISOString().split('T')[0];
      }
    } catch {
      // No body or invalid JSON, use defaults (last 2 days)
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 2);
      startDate = start.toISOString().split('T')[0];
      endDate = end.toISOString().split('T')[0];
    }

    console.log(`Processing funnel metrics from ${startDate} to ${endDate}`);
    
    // Get all dates in range
    const dates = getDateRange(startDate, endDate);
    console.log(`Processing ${dates.length} days: ${dates.join(', ')}`);
    
    // Process each day independently with retry logic
    const results: DayResult[] = [];
    
    for (const date of dates) {
      const result = await processSingleDay(supabase, date, 3);
      results.push(result);
      
      // If a day failed after all retries, log an alert
      if (!result.success) {
        await logAlert(supabase, date, result.error || 'Unknown error');
      }
    }
    
    // Summarize results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    const duration = Date.now() - startTime;
    console.log(`=== POPULATE FUNNEL METRICS COMPLETED in ${duration}ms ===`);
    console.log(`Results: ${successful.length} succeeded, ${failed.length} failed`);
    
    if (failed.length > 0) {
      console.log('Failed dates:', failed.map(f => `${f.date}: ${f.error}`).join('; '));
    }

    // Complete sync log (mark as success only if all days succeeded)
    const allSucceeded = failed.length === 0;
    await completeSyncLog(
      logId, 
      allSucceeded,
      allSucceeded ? undefined : `${failed.length} days failed: ${failed.map(f => f.date).join(', ')}`
    );

    return new Response(JSON.stringify({
      success: allSucceeded,
      partial_success: successful.length > 0,
      duration,
      dates_processed: dates.length,
      successful: successful.length,
      failed: failed.length,
      results: results.map(r => ({
        date: r.date,
        success: r.success,
        attempts: r.attempts,
        result: r.result,
        error: r.error,
      })),
    }), {
      status: allSucceeded ? 200 : 207, // 207 Multi-Status for partial success
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Fatal error:', error);
    
    // Complete sync log with error
    await completeSyncLog(logId, false, errorMessage);
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      duration: Date.now() - startTime,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
