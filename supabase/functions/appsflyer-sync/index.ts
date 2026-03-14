import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { startSyncLog, completeSyncLog } from "../_shared/sync-logger.ts";
import { getTenantCredentials, updateLastSyncedAt } from "../_shared/tenant-credentials.ts";
import { resolveOrgContext } from "../_shared/org-resolver.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AppsFlyerCampaign {
  platform: string;
  media_source: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  installs: number;
  spend: number;
  revenue: number;
  arpu: number;
  roi: number;
  cpc: number;
  cpi: number;
  date_start: string;
  date_end: string;
}

interface AppsFlyerEvent {
  platform: string;
  media_source: string;
  campaign_name: string;
  event_name: string;
  event_count: number;
  event_revenue: number;
  event_date: string;
}

interface DailyInstall {
  platform: string;
  media_source: string;
  campaign_name: string;
  date: string;
  installs: number;
}

interface DailyClicks {
  platform: string;
  media_source: string;
  campaign_name: string;
  date: string;
  clicks: number;
}

function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }
  
  return rows;
}

function findRevenueColumn(headers: string[]): string | null {
  // AppsFlyer uses columns like "Total revenue (Sales in USD)"
  const revenuePatterns = ['Total revenue', 'Revenue', 'Sales in'];
  for (const header of headers) {
    for (const pattern of revenuePatterns) {
      if (header.includes(pattern)) return header;
    }
  }
  return null;
}

function findEventRevenueColumn(headers: string[], eventName: string): string | null {
  // Pattern: "{event_name} (Sales in USD)"
  const pattern = new RegExp(`${eventName}.*Sales in`, 'i');
  for (const header of headers) {
    if (pattern.test(header)) return header;
  }
  return null;
}

async function fetchAppsFlyerReport(
  apiToken: string,
  appId: string,
  reportType: string,
  fromDate: string,
  toDate: string,
  additionalEvents?: string[]
): Promise<string> {
  // Correct AppsFlyer Pull API V2 aggregate reports URL
  // Format: https://hq1.appsflyer.com/api/agg-data/export/app/{app_id}/{report_type}/v5
  const baseUrl = `https://hq1.appsflyer.com/api/agg-data/export/app/${appId}/${reportType}/v5`;
  const params = new URLSearchParams({
    from: fromDate,
    to: toDate,
    timezone: 'UTC',
  });
  
  // Add additional KPIs for revenue data
  if (reportType === 'partners_report' || reportType === 'partners_by_date_report') {
    params.append('kpis', 'impressions,clicks,installs,sessions,cost,revenue,arpu,roi');
    
    // Add custom events - AppsFlyer requires explicit event names
    if (additionalEvents && additionalEvents.length > 0) {
      params.append('additional_fields', additionalEvents.join(','));
    }
  }
  
  const url = `${baseUrl}?${params.toString()}`;
  console.log(`Fetching AppsFlyer ${reportType} for ${appId}: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Accept': 'text/csv',
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`AppsFlyer API error: ${response.status} - ${errorText.substring(0, 500)}`);
    throw new Error(`AppsFlyer API error: ${response.status}`);
  }
  
  return response.text();
}

// Fetch user-level install data from Raw Data Export API
async function fetchRawInstallData(
  apiToken: string,
  appId: string,
  fromDate: string,
  toDate: string
): Promise<Record<string, string>[]> {
  // AppsFlyer Raw Data Export API for installs
  const baseUrl = `https://hq1.appsflyer.com/api/raw-data/export/app/${appId}/installs_report/v5`;
  const params = new URLSearchParams({
    from: fromDate,
    to: toDate,
    timezone: 'UTC',
  });
  
  const url = `${baseUrl}?${params.toString()}`;
  console.log(`Fetching AppsFlyer raw install data for ${appId}: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Accept': 'text/csv',
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`AppsFlyer Raw Data API error: ${response.status} - ${errorText.substring(0, 500)}`);
    // Don't throw - raw data might not be available for all accounts
    return [];
  }
  
  const csvText = await response.text();
  return parseCSV(csvText);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const syncLog = await startSyncLog('appsflyer-sync');

  try {
    const body = await req.json().catch(() => ({}));
    const { userId, orgId } = await resolveOrgContext(req, body);

    // Resolve credentials from tenant or env fallback
    const { credentials: creds } = await getTenantCredentials('appsflyer', orgId);
    const apiToken = creds.api_token;
    const iosAppId = creds.ios_app_id || creds.app_id;
    const androidAppId = creds.android_app_id;
    
    if (!apiToken) {
      throw new Error('AppsFlyer API token not configured');
    }
    
    if (!iosAppId && !androidAppId) {
      throw new Error('At least one AppsFlyer App ID must be configured');
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log(`Starting AppsFlyer sync for user: ${userId}, org: ${orgId}`);
    
    // Calculate date range (last 7 days - historical data is preserved, only need recent days)
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 7);
    
    const fromDateStr = fromDate.toISOString().split('T')[0];
    const toDateStr = toDate.toISOString().split('T')[0];
    
    const appConfigs = [
      { appId: iosAppId, platform: 'ios' },
      { appId: androidAppId, platform: 'android' },
    ].filter(c => c.appId);
    
    const allEvents: AppsFlyerEvent[] = [];
    const allDailyInstalls: DailyInstall[] = [];
    const allDailyClicks: DailyClicks[] = [];
    const ftdsByMediaSource: Record<string, number> = {};
    
    // Aggregated campaign data from daily records
    const campaignAggregates = new Map<string, AppsFlyerCampaign>();
    
    // Custom events we want to track - including signup_completed
    const customEvents = ['first_time_deposit', 'signup_completed', 'deposit_success', 'withdrawal_success', 'bet_placed'];
    
    for (const { appId, platform } of appConfigs) {
      try {
        // Only fetch daily data (partners_by_date_report)
        const dailyCSV = await fetchAppsFlyerReport(
          apiToken,
          appId!,
          'partners_by_date_report',
          fromDateStr,
          toDateStr,
          customEvents
        );
        
        const dailyData = parseCSV(dailyCSV);
        const headers = dailyCSV.split('\n')[0]?.split(',') || [];
        const revenueCol = findRevenueColumn(headers);
        
        console.log(`Parsed ${dailyData.length} daily rows for ${platform}`);
        console.log(`Revenue column: ${revenueCol}`);
        
        for (const row of dailyData) {
          const mediaSource = row['Media Source (pid)'] || row['Media Source'] || row['media_source'] || 'Unknown';
          const campaignName = row['Campaign (c)'] || row['Campaign'] || row['campaign'] || 'Unknown';
          const eventDate = row['Date'] || row['date'] || toDateStr;
          
          // Parse metrics
          const impressions = parseInt(row['Impressions'] || row['impressions'] || '0') || 0;
          const clicks = parseInt(row['Clicks'] || row['clicks'] || '0') || 0;
          const installs = parseInt(row['Installs'] || row['installs'] || '0') || 0;
          const spend = parseFloat(row['Cost'] || row['Total Cost'] || row['cost'] || '0') || 0;
          const revenue = revenueCol ? (parseFloat(row[revenueCol] || '0') || 0) : 0;
          
          // Aggregate campaign data
          const campaignKey = `${platform}:${mediaSource}:${campaignName}`;
          const existing = campaignAggregates.get(campaignKey);
          
          if (existing) {
            existing.impressions += impressions;
            existing.clicks += clicks;
            existing.installs += installs;
            existing.spend += spend;
            existing.revenue += revenue;
            if (eventDate < existing.date_start) existing.date_start = eventDate;
            if (eventDate > existing.date_end) existing.date_end = eventDate;
          } else {
            campaignAggregates.set(campaignKey, {
              platform,
              media_source: mediaSource,
              campaign_name: campaignName,
              impressions,
              clicks,
              installs,
              spend,
              revenue,
              arpu: 0,
              roi: 0,
              cpc: 0,
              cpi: 0,
              date_start: eventDate,
              date_end: eventDate,
            });
          }
          
          // Collect daily install data for blended funnel metrics
          if (installs > 0) {
            allDailyInstalls.push({
              platform,
              media_source: mediaSource,
              campaign_name: campaignName,
              date: eventDate,
              installs,
            });
          }
          
          // Collect daily clicks data
          if (clicks > 0) {
            allDailyClicks.push({
              platform,
              media_source: mediaSource,
              campaign_name: campaignName,
              date: eventDate,
              clicks,
            });
          }
          // Find FTD count column dynamically
          const ftdCountKey = Object.keys(row).find(k => 
            k.toLowerCase().includes('first_time_deposit') && k.toLowerCase().includes('event counter')
          );
          const ftdCount = ftdCountKey ? (parseInt(row[ftdCountKey] || '0') || 0) : 0;
          
          if (ftdCount > 0) {
            ftdsByMediaSource[mediaSource] = (ftdsByMediaSource[mediaSource] || 0) + ftdCount;
            
            allEvents.push({
              platform,
              media_source: mediaSource,
              campaign_name: campaignName,
              event_name: 'first_time_deposit',
              event_count: ftdCount,
              event_revenue: 0,
              event_date: eventDate,
            });
          }
          
          // Find signup_completed event count column dynamically
          const signupCountKey = Object.keys(row).find(k => 
            k.toLowerCase().includes('signup_completed') && k.toLowerCase().includes('event counter')
          );
          const signupCount = signupCountKey ? (parseInt(row[signupCountKey] || '0') || 0) : 0;
          
          if (signupCount > 0) {
            allEvents.push({
              platform,
              media_source: mediaSource,
              campaign_name: campaignName,
              event_name: 'signup_completed',
              event_count: signupCount,
              event_revenue: 0,
              event_date: eventDate,
            });
          }
          
          // Find bet_placed event count column dynamically
          const betPlacedCountKey = Object.keys(row).find(k =>
            k.toLowerCase().includes('bet_placed') && k.toLowerCase().includes('event counter')
          );
          const betPlacedCount = betPlacedCountKey ? (parseInt(row[betPlacedCountKey] || '0') || 0) : 0;
          
          // Find unique betting users column dynamically
          const bettingUsersKey = Object.keys(row).find(k => 
            k.toLowerCase().includes('bet_placed') && k.toLowerCase().includes('unique users')
          );
          const bettingUsers = bettingUsersKey ? (parseInt(row[bettingUsersKey] || '0') || 0) : 0;
          
          if (betPlacedCount > 0) {
            allEvents.push({
              platform,
              media_source: mediaSource,
              campaign_name: campaignName,
              event_name: 'bet_placed',
              event_count: betPlacedCount,
              event_revenue: 0,
              event_date: eventDate,
            });
          }
          
          if (bettingUsers > 0) {
            allEvents.push({
              platform,
              media_source: mediaSource,
              campaign_name: campaignName,
              event_name: 'betting_users',
              event_count: bettingUsers,
              event_revenue: 0,
              event_date: eventDate,
            });
          }
          
          // Extract deposit/withdrawal revenue
          const depositRevenueKey = Object.keys(row).find(k => 
            k.toLowerCase().includes('deposit_success') && k.toLowerCase().includes('sales in')
          );
          const withdrawalRevenueKey = Object.keys(row).find(k => 
            k.toLowerCase().includes('withdrawal_success') && k.toLowerCase().includes('sales in')
          );
          
          const depositRevenue = depositRevenueKey ? (parseFloat(row[depositRevenueKey] || '0') || 0) : 0;
          const withdrawalRevenue = withdrawalRevenueKey ? (parseFloat(row[withdrawalRevenueKey] || '0') || 0) : 0;
          const netRevenue = depositRevenue + withdrawalRevenue;
          
          if (netRevenue !== 0) {
            allEvents.push({
              platform,
              media_source: mediaSource,
              campaign_name: campaignName,
              event_name: 'net_revenue',
              event_count: 1,
              event_revenue: netRevenue,
              event_date: eventDate,
            });
          }
        }
        
      } catch (error) {
        console.error(`Error fetching AppsFlyer data for ${platform}:`, error);
      }
    }
    
    // Calculate derived metrics for aggregated campaigns
    const allCampaigns: AppsFlyerCampaign[] = [];
    for (const campaign of campaignAggregates.values()) {
      campaign.cpc = campaign.clicks > 0 ? campaign.spend / campaign.clicks : 0;
      campaign.cpi = campaign.installs > 0 ? campaign.spend / campaign.installs : 0;
      campaign.arpu = campaign.installs > 0 ? campaign.revenue / campaign.installs : 0;
      campaign.roi = campaign.spend > 0 ? ((campaign.revenue - campaign.spend) / campaign.spend) * 100 : 0;
      allCampaigns.push(campaign);
    }
    
    console.log(`Total campaigns to upsert: ${allCampaigns.length}`);
    console.log(`Total events to upsert: ${allEvents.length}`);
    console.log('FTDs by media source:', ftdsByMediaSource);
    
    // UPSERT campaigns (incremental - no delete)
    if (allCampaigns.length > 0) {
      const campaignRecords = allCampaigns.map(c => ({
        user_id: userId,
        platform: c.platform,
        media_source: c.media_source,
        campaign_name: c.campaign_name,
        impressions: c.impressions,
        clicks: c.clicks,
        installs: c.installs,
        spend: c.spend,
        revenue: c.revenue,
        arpu: c.arpu,
        roi: c.roi,
        cpc: c.cpc,
        cpi: c.cpi,
        date_start: c.date_start,
        date_end: c.date_end,
        synced_at: new Date().toISOString(),
      }));
      
      const { error: upsertError } = await supabase
        .from('appsflyer_campaigns')
        .upsert(campaignRecords, { 
          onConflict: 'user_id,platform,media_source,campaign_name,date_start',
          ignoreDuplicates: false 
        });
      
      if (upsertError) {
        console.error('Error upserting campaigns:', upsertError);
        throw upsertError;
      }
    }
    
    // UPSERT events (incremental - no delete)
    if (allEvents.length > 0) {
      const eventRecords = allEvents.map(e => ({
        user_id: userId,
        platform: e.platform,
        media_source: e.media_source,
        campaign_name: e.campaign_name,
        event_name: e.event_name,
        event_count: e.event_count,
        event_revenue: e.event_revenue,
        event_date: e.event_date,
        synced_at: new Date().toISOString(),
      }));
      
      const { error: upsertError } = await supabase
        .from('appsflyer_events')
        .upsert(eventRecords, { 
          onConflict: 'event_date,event_name,media_source,campaign_name,platform',
          ignoreDuplicates: false 
        });
      
      if (upsertError) {
        console.error('Error upserting events:', upsertError);
        throw upsertError;
      }
    }
    
    // UPSERT daily installs for blended funnel metrics (includes organic)
    if (allDailyInstalls.length > 0) {
      console.log(`Upserting ${allDailyInstalls.length} daily install records`);
      
      const dailyInstallRecords = allDailyInstalls.map(d => ({
        user_id: userId,
        date: d.date,
        platform: d.platform,
        media_source: d.media_source,
        campaign_name: d.campaign_name,
        installs: d.installs,
        synced_at: new Date().toISOString(),
      }));
      
      const { error: dailyInstallsError } = await supabase
        .from('daily_appsflyer_installs')
        .upsert(dailyInstallRecords, { 
          onConflict: 'date,media_source,campaign_name,platform',
          ignoreDuplicates: false 
        });
      
      if (dailyInstallsError) {
        console.error('Error upserting daily installs:', dailyInstallsError);
        throw dailyInstallsError;
      }
      
      console.log('Daily installs upserted successfully');
    }
    
    // UPSERT daily clicks for campaign performance metrics
    if (allDailyClicks.length > 0) {
      console.log(`Upserting ${allDailyClicks.length} daily clicks records`);
      
      const dailyClickRecords = allDailyClicks.map(d => ({
        user_id: userId,
        date: d.date,
        platform: d.platform,
        media_source: d.media_source,
        campaign_name: d.campaign_name,
        clicks: d.clicks,
        synced_at: new Date().toISOString(),
      }));
      
      const { error: dailyClicksError } = await supabase
        .from('daily_appsflyer_clicks')
        .upsert(dailyClickRecords, { 
          onConflict: 'platform,media_source,campaign_name,date',
          ignoreDuplicates: false 
        });
      
      if (dailyClicksError) {
        console.error('Error upserting daily clicks:', dailyClicksError);
        throw dailyClicksError;
      }
      
      console.log('Daily clicks upserted successfully');
    }
    
    // Calculate and store daily affiliate spend based on FTD events
    // Get all active affiliates (not filtered by user_id since affiliates may be owned by different admin)
    const { data: affiliates } = await supabase
      .from('affiliates')
      .select('id, channel, cpa, user_id')
      .eq('status', 'active');
    
    if (affiliates && affiliates.length > 0) {
      // Build a map of media_source -> affiliate (include user_id for spend records)
      const affiliateByChannel = new Map<string, { id: string; cpa: number; user_id: string }>();
      for (const aff of affiliates) {
        affiliateByChannel.set(aff.channel, { id: aff.id, cpa: Number(aff.cpa) || 0, user_id: aff.user_id });
      }
      
      // Aggregate FTDs by date and media_source from events
      const ftdsByDateAndChannel = new Map<string, { ftds: number; affiliateId: string; cpa: number; userId: string }>();
      
      for (const event of allEvents) {
        if (event.event_name === 'first_time_deposit') {
          const affiliate = affiliateByChannel.get(event.media_source);
          if (affiliate) {
            const key = `${event.event_date}:${affiliate.id}`;
            const existing = ftdsByDateAndChannel.get(key);
            if (existing) {
              existing.ftds += event.event_count;
            } else {
              ftdsByDateAndChannel.set(key, {
                ftds: event.event_count,
                affiliateId: affiliate.id,
                cpa: affiliate.cpa,
                userId: affiliate.user_id,
              });
            }
          }
        }
      }
      
      // UPSERT daily affiliate spend records (incremental - no delete)
      const affiliateSpendRecords = Array.from(ftdsByDateAndChannel.entries()).map(([key, data]) => {
        const [date] = key.split(':');
        return {
          user_id: data.userId,
          affiliate_id: data.affiliateId,
          date,
          ftds: data.ftds,
          spend: data.ftds * data.cpa,
          synced_at: new Date().toISOString(),
        };
      });
      
      if (affiliateSpendRecords.length > 0) {
        const { error: affiliateSpendError } = await supabase
          .from('daily_affiliate_spend')
          .upsert(affiliateSpendRecords, { onConflict: 'affiliate_id,date' });
        
        if (affiliateSpendError) {
          console.error('Error upserting daily affiliate spend:', affiliateSpendError);
        } else {
          console.log(`Upserted ${affiliateSpendRecords.length} daily affiliate spend records`);
        }
      }
      
      // Update affiliates table with total FTD counts
      for (const affiliate of affiliates) {
        const ftds = ftdsByMediaSource[affiliate.channel] || 0;
        await supabase
          .from('affiliates')
          .update({ ftds })
          .eq('id', affiliate.id);
        if (ftds > 0) {
          console.log(`Updated affiliate ${affiliate.channel} with ${ftds} FTDs`);
        }
      }
    }
    
    // NOTE: Attributed users sync has been deprecated due to timeout issues
    // The raw data export takes too long for 90-day windows
    console.log('Skipping attributed users sync (deprecated)');
    
    const totals = {
      campaigns: allCampaigns.length,
      events: allEvents.length,
      totalSpend: allCampaigns.reduce((sum, c) => sum + c.spend, 0),
      totalRevenue: allCampaigns.reduce((sum, c) => sum + c.revenue, 0),
      totalInstalls: allCampaigns.reduce((sum, c) => sum + c.installs, 0),
      totalFTDs: Object.values(ftdsByMediaSource).reduce((sum, v) => sum + v, 0),
    };
    
    console.log('Sync complete. Totals:', totals);
    
    await completeSyncLog(syncLog?.id || null, true);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'AppsFlyer sync completed',
      ...totals,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('AppsFlyer sync error:', error);
    
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