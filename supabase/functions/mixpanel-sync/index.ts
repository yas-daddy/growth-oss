import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { startSyncLog, completeSyncLog } from "../_shared/sync-logger.ts";

// Declare EdgeRuntime for Supabase Edge Functions
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MixpanelEvent {
  event: string;
  properties: {
    time: number;
    distinct_id: string;
    user_id?: string;
    appsflyerId?: string;
    deviceType?: string;
    amount?: number;
    $insert_id?: string;
    [key: string]: unknown;
  };
}

// Stream and process Mixpanel events - processes line by line to avoid memory issues
async function streamMixpanelEvents(
  supabase: SupabaseClient,
  apiSecret: string,
  fromDate: string,
  toDate: string,
  eventNames: string[]
): Promise<{ successCount: number; errorCount: number }> {
  const baseUrl = 'https://data.mixpanel.com/api/2.0/export';
  
  const params = new URLSearchParams({
    from_date: fromDate,
    to_date: toDate,
  });
  
  if (eventNames.length > 0) {
    params.append('event', JSON.stringify(eventNames));
  }
  
  const url = `${baseUrl}?${params.toString()}`;
  console.log(`Streaming Mixpanel events: ${fromDate} to ${toDate}`);
  
  const authHeader = btoa(`${apiSecret}:`);
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Accept': 'text/plain',
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Mixpanel API error: ${response.status} - ${errorText.substring(0, 500)}`);
    throw new Error(`Mixpanel API error: ${response.status}`);
  }

  if (!response.body) {
    console.log('Empty response body');
    return { successCount: 0, errorCount: 0 };
  }

  // Process stream line by line
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventBatch: any[] = [];
  let successCount = 0;
  let errorCount = 0;
  const batchSize = 200;
  const seenInsertIds = new Set<string>();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        // Process remaining buffer
        if (buffer.trim()) {
          const event = processLine(buffer, seenInsertIds);
          if (event) eventBatch.push(event);
        }
        break;
      }
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        const event = processLine(line, seenInsertIds);
        if (event) {
          eventBatch.push(event);
          
          // Upsert when batch is full
          if (eventBatch.length >= batchSize) {
            const result = await upsertBatch(supabase, eventBatch);
            successCount += result.success;
            errorCount += result.errors;
            eventBatch = [];
          }
        }
      }
    }
    
    // Upsert remaining events
    if (eventBatch.length > 0) {
      const result = await upsertBatch(supabase, eventBatch);
      successCount += result.success;
      errorCount += result.errors;
    }
    
  } finally {
    reader.releaseLock();
  }
  
  console.log(`Processed ${successCount} events, ${errorCount} errors`);
  return { successCount, errorCount };
}

function processLine(line: string, seenInsertIds: Set<string>): any | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  
  try {
    const event: MixpanelEvent = JSON.parse(trimmed);
    const props = event.properties;
    const insertId = props.$insert_id;
    
    // Skip duplicates
    if (!insertId || seenInsertIds.has(insertId)) return null;
    seenInsertIds.add(insertId);
    
    // Extract amount for deposit/withdrawal events
    // Check deposit_amount, withdrawal_amount, and amount fields (Mixpanel uses different property names)
    let amount: number | null = null;
    if (event.event === 'deposit_success') {
      const depositAmount = (props as any).deposit_amount ?? (props as any).af_revenue ?? props.amount;
      amount = typeof depositAmount === 'number' ? depositAmount : (typeof depositAmount === 'string' ? parseFloat(depositAmount) : null);
    } else if (event.event === 'withdrawal_success') {
      const withdrawalAmount = (props as any).withdrawal_amount ?? (props as any).amount;
      amount = typeof withdrawalAmount === 'number' ? withdrawalAmount : (typeof withdrawalAmount === 'string' ? parseFloat(withdrawalAmount) : null);
    }
    
    return {
      insert_id: insertId,
      event_name: event.event,
      event_time: new Date(props.time * 1000).toISOString(),
      distinct_id: props.distinct_id,
      mixpanel_user_id: props.user_id || null,
      appsflyer_id: props.appsflyerId || null,
      amount: amount,
      properties: props,
      revenue: 0,
      platform: props.deviceType?.toLowerCase() || null,
      synced_at: new Date().toISOString(),
    };
  } catch (e) {
    return null;
  }
}

async function upsertBatch(supabase: SupabaseClient, batch: any[]): Promise<{ success: number; errors: number }> {
  const { error } = await supabase
    .from('mixpanel_events')
    .upsert(batch, { 
      onConflict: 'insert_id',
      ignoreDuplicates: false 
    });
  
  if (error) {
    console.error(`Upsert error:`, JSON.stringify(error));
    return { success: 0, errors: batch.length };
  }
  return { success: batch.length, errors: 0 };
}

// Background sync function - supports date range or incremental sync
async function performMixpanelSync(
  supabase: SupabaseClient,
  projectId: string,
  apiSecret: string,
  options: { days?: number; startDate?: string; endDate?: string; eventFilter?: string[] }
) {
  // Start sync log
  const syncLog = await startSyncLog('mixpanel-sync');
  const logId = syncLog?.id ?? null;
  
  try {
    console.log(`[Background] Starting Mixpanel sync`, options);
    
    // Use eventFilter if provided, otherwise sync all events
    const eventNames = options.eventFilter && options.eventFilter.length > 0
      ? options.eventFilter
      : [
          'first_time_deposit',
          'second_time_deposit',
          'signup_completed',
          'signup_completed_referral',
          'deposit_success',
          'withdrawal_success'
        ];
    
    console.log(`[Background] Syncing events:`, eventNames);
    
    let startDate: Date;
    let endDate: Date;
    
    if (options.startDate && options.endDate) {
      // Specific date range requested
      startDate = new Date(options.startDate);
      endDate = new Date(options.endDate);
      console.log(`[Background] Date range sync: ${options.startDate} to ${options.endDate}`);
    } else if (options.days) {
      // Manual override - sync specified number of days
      startDate = new Date();
      startDate.setDate(startDate.getDate() - options.days);
      endDate = new Date();
      console.log(`[Background] Manual sync: last ${options.days} days`);
    } else {
      // Incremental sync - find last event date
      const { data: lastEvent } = await supabase
        .from('mixpanel_events')
        .select('event_time')
        .order('event_time', { ascending: false })
        .limit(1);
      
      if (lastEvent && lastEvent.length > 0) {
        // Start from 2 days before last event (overlap for safety)
        startDate = new Date(lastEvent[0].event_time);
        startDate.setDate(startDate.getDate() - 2);
        console.log(`[Background] Incremental sync from: ${startDate.toISOString().split('T')[0]}`);
      } else {
        // No existing data - sync last 30 days
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        console.log(`[Background] First sync: last 30 days`);
      }
      endDate = new Date();
    }
    
    let totalSuccess = 0;
    let totalErrors = 0;
    
    // Process 1 day at a time from startDate to endDate
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      console.log(`[Background] Processing day: ${dateStr}`);
      
      try {
        const { successCount, errorCount } = await streamMixpanelEvents(
          supabase,
          apiSecret,
          dateStr,
          dateStr,
          eventNames
        );
        
        totalSuccess += successCount;
        totalErrors += errorCount;
        console.log(`[Background] Day ${dateStr}: ${successCount} success, ${errorCount} errors`);
        
      } catch (dayError) {
        console.error(`[Background] Error processing ${dateStr}:`, dayError);
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log(`[Background] Mixpanel sync completed: ${totalSuccess} total, ${totalErrors} errors`);
    
    // Complete sync log
    await completeSyncLog(logId, true);
    
  } catch (error) {
    console.error('[Background] Mixpanel sync error:', error);
    if (error instanceof Error) {
      console.error('[Background] Error details:', error.message, error.stack);
    }
    
    // Complete sync log with error
    const errorMessage = error instanceof Error ? error.message : String(error);
    await completeSyncLog(logId, false, errorMessage);
  }
}

// Handle shutdown
addEventListener('beforeunload', (ev) => {
  console.log('[Shutdown] Function shutting down:', (ev as any).detail?.reason);
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const projectId = Deno.env.get('MIXPANEL_PROJECT_ID');
    const apiSecret = Deno.env.get('MIXPANEL_API_SECRET');
    
    if (!projectId || !apiSecret) {
      throw new Error('MIXPANEL_PROJECT_ID and MIXPANEL_API_SECRET must be configured');
    }
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Try to get user from auth header, or fall back to admin user for service role calls
    let userId: string;
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user } } = await userClient.auth.getUser();
    if (user) {
      // Verify user has admin role
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!userRole) {
        throw new Error('Admin access required to sync data');
      }
      userId = user.id;
    } else {
      // Service role call - get first admin user
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle();
      
      if (!adminRole) {
        throw new Error('No admin user found for service role sync');
      }
      userId = adminRole.user_id;
      console.log(`Service role sync using admin user: ${userId}`);
    }
    
    console.log(`Received sync request for user: ${userId}`);
    
    const body = await req.json().catch(() => ({}));
    const options = {
      days: body.days || undefined,
      startDate: body.startDate || undefined,
      endDate: body.endDate || undefined,
      eventFilter: body.eventFilter || undefined,
    };
    
    EdgeRuntime.waitUntil(
      performMixpanelSync(supabase, projectId, apiSecret, options)
    );
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Mixpanel sync started in background. Data will be available shortly.',
      status: 'processing',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Mixpanel sync error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
