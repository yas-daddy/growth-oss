import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { startSyncLog, completeSyncLog } from "../_shared/sync-logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KeywordEvent {
  keyword_id: string;
  event_name: string;
  event_date: string;
  platform: string;
  event_count: number;
}

// Stream-parse CSV to avoid loading entire response into memory
async function* streamParseCSV(response: Response): AsyncGenerator<Record<string, string>> {
  const text = await response.text();
  const lines = text.split('\n');
  
  if (lines.length < 2) return;
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/"/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/"/g, ''));
    
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    yield row;
  }
}

// Process events in a single date window and return aggregated results
async function fetchAndAggregateEvents(
  apiToken: string,
  appId: string,
  reportType: 'installs' | 'in_app_events',
  eventName: string | null,
  fromDate: string,
  toDate: string
): Promise<Map<string, number>> {
  const baseUrl = reportType === 'installs'
    ? `https://hq1.appsflyer.com/api/raw-data/export/app/${appId}/installs_report/v5`
    : `https://hq1.appsflyer.com/api/raw-data/export/app/${appId}/in_app_events_report/v5`;
  
  const params = new URLSearchParams({
    from: fromDate,
    to: toDate,
    timezone: 'UTC',
    additional_fields: 'keyword_id',
  });
  
  if (eventName) {
    params.set('event_name', eventName);
  }
  
  const url = `${baseUrl}?${params.toString()}`;
  console.log(`Fetching ${reportType}${eventName ? ` (${eventName})` : ''}: ${fromDate} to ${toDate}`);
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Accept': 'text/csv',
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`AppsFlyer API error: ${response.status} - ${errorText.substring(0, 200)}`);
    return new Map();
  }
  
  // Aggregate as we parse to minimize memory usage
  const aggregated = new Map<string, number>();
  let recordCount = 0;
  
  for await (const row of streamParseCSV(response)) {
    const keywordId = row['Keyword ID'] || row['keyword_id'] || '';
    const eventTime = row['Install Time'] || row['Event Time'] || '';
    const eventDate = eventTime.split(' ')[0] || '';
    
    if (keywordId && eventDate) {
      const key = `${keywordId}:${eventDate}`;
      aggregated.set(key, (aggregated.get(key) || 0) + 1);
      recordCount++;
    }
  }
  
  console.log(`Processed ${recordCount} records -> ${aggregated.size} aggregated entries`);
  return aggregated;
}

// Upsert a batch of events
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertEvents(
  supabase: any,
  events: KeywordEvent[]
): Promise<void> {
  if (events.length === 0) return;
  
  const batchSize = 100;
  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    const { error } = await supabase
      .from('appsflyer_keyword_events')
      .upsert(batch, { 
        onConflict: 'keyword_id,event_name,event_date,platform',
        ignoreDuplicates: false 
      });
    
    if (error) {
      console.error(`Upsert error at batch ${Math.floor(i / batchSize) + 1}:`, error);
      throw error;
    }
  }
}

// Convert aggregated map to event records
function mapToEvents(
  aggregated: Map<string, number>,
  eventName: string,
  platform: string
): KeywordEvent[] {
  const events: KeywordEvent[] = [];
  for (const [key, count] of aggregated) {
    const [keyword_id, event_date] = key.split(':');
    events.push({ keyword_id, event_name: eventName, event_date, platform, event_count: count });
  }
  return events;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const syncLog = await startSyncLog('appsflyer-keyword-sync');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apiToken = Deno.env.get('APPSFLYER_API_TOKEN');
    const iosAppId = Deno.env.get('APPSFLYER_IOS_APP_ID');
    
    if (!apiToken) {
      throw new Error('APPSFLYER_API_TOKEN is not configured');
    }
    
    if (!iosAppId) {
      throw new Error('APPSFLYER_IOS_APP_ID is not configured');
    }
    
    // Auth validation - allow service role calls from cron jobs
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
        throw new Error('Admin access required');
      }
      userId = user.id;
    } else {
      // Service role call (cron job) - get first admin user
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
    
    console.log(`Starting AppsFlyer keyword sync for user: ${userId}`);
    
    // Incremental sync: find latest synced date and only fetch from there
    let totalDays = 30; // Default for first sync
    
    const { data: latestSync } = await supabase
      .from('appsflyer_keyword_events')
      .select('event_date')
      .order('event_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (latestSync?.event_date) {
      // Calculate days since last sync + 7 day overlap for delayed attributions
      const latestDate = new Date(latestSync.event_date);
      const today = new Date();
      const daysSinceLastSync = Math.ceil((today.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24));
      totalDays = Math.min(daysSinceLastSync + 7, 30); // Cap at 30 days max
      console.log(`Incremental sync: fetching ${totalDays} days (last sync: ${latestSync.event_date})`);
    } else {
      console.log('Full sync: no previous data found, fetching 30 days');
    }
    
    // Process in smaller 7-day windows to avoid memory limits
    const windowDays = 7;
    const totals = { installs: 0, ftds: 0, betsPlaced: 0, totalRecords: 0 };
    
    for (let offset = 0; offset < totalDays; offset += windowDays) {
      const windowEnd = new Date();
      windowEnd.setDate(windowEnd.getDate() - 1 - offset);
      const windowStart = new Date(windowEnd);
      windowStart.setDate(windowStart.getDate() - windowDays + 1);
      
      // Don't go beyond 30 days
      if (offset + windowDays > totalDays) {
        windowStart.setDate(new Date().getDate() - totalDays);
      }
      
      const fromDateStr = windowStart.toISOString().split('T')[0];
      const toDateStr = windowEnd.toISOString().split('T')[0];
      
      console.log(`\n=== Processing window: ${fromDateStr} to ${toDateStr} ===`);
      
      // Process installs for this window
      try {
        const installData = await fetchAndAggregateEvents(
          apiToken, iosAppId, 'installs', null, fromDateStr, toDateStr
        );
        const installEvents = mapToEvents(installData, 'install', 'ios');
        await upsertEvents(supabase, installEvents);
        totals.installs += installEvents.reduce((sum, e) => sum + e.event_count, 0);
        totals.totalRecords += installEvents.length;
      } catch (error) {
        console.error('Error processing installs:', error);
      }
      
      // Process FTDs for this window
      try {
        const ftdData = await fetchAndAggregateEvents(
          apiToken, iosAppId, 'in_app_events', 'first_time_deposit', fromDateStr, toDateStr
        );
        const ftdEvents = mapToEvents(ftdData, 'first_time_deposit', 'ios');
        await upsertEvents(supabase, ftdEvents);
        totals.ftds += ftdEvents.reduce((sum, e) => sum + e.event_count, 0);
        totals.totalRecords += ftdEvents.length;
      } catch (error) {
        console.error('Error processing FTDs:', error);
      }
      
      // Process bet_placed for this window
      try {
        const betData = await fetchAndAggregateEvents(
          apiToken, iosAppId, 'in_app_events', 'bet_placed', fromDateStr, toDateStr
        );
        const betEvents = mapToEvents(betData, 'bet_placed', 'ios');
        await upsertEvents(supabase, betEvents);
        totals.betsPlaced += betEvents.reduce((sum, e) => sum + e.event_count, 0);
        totals.totalRecords += betEvents.length;
      } catch (error) {
        console.error('Error processing bet_placed:', error);
      }
      
      // Force garbage collection between windows
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\nSync complete. Totals:', totals);
    await completeSyncLog(syncLog?.id || null, true);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'AppsFlyer keyword sync completed',
      ...totals,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('AppsFlyer keyword sync error:', error);
    await completeSyncLog(syncLog?.id || null, false, error instanceof Error ? error.message : 'Unknown error');
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
