import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { startSyncLog, completeSyncLog } from "../_shared/sync-logger.ts";
import { getTenantCredentials, updateLastSyncedAt } from "../_shared/tenant-credentials.ts";
import { resolveOrgContext } from "../_shared/org-resolver.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MOLOCO_AUTH_URL = 'https://api.moloco.cloud/cm/v1/auth/tokens';
const MOLOCO_API_URL = 'https://api.moloco.cloud/cm/v1';

async function getMolocoAccessToken(apiKey: string): Promise<string> {
  console.log('Getting Moloco access token...');
  
  const response = await fetch(MOLOCO_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ api_key: apiKey }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Moloco auth error:', errorText);
    throw new Error(`Failed to get Moloco access token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  console.log('Successfully obtained Moloco access token');
  return data.token;
}

// Fetch campaign details including budgets
async function fetchCampaignDetails(accessToken: string, adAccountId: string): Promise<Map<string, { daily_budget: number }>> {
  console.log('Fetching campaign details from Moloco...');
  
  const campaignBudgets = new Map<string, { daily_budget: number }>();
  
  try {
    const response = await fetch(`${MOLOCO_API_URL}/ad-accounts/${adAccountId}/campaigns`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Moloco campaigns API error:', errorText);
      return campaignBudgets;
    }

    const data = await response.json();
    const campaigns = data.campaigns || [];
    
    console.log(`Fetched ${campaigns.length} campaign details`);
    
    for (const campaign of campaigns) {
      // Moloco returns budget in different formats
      const dailyBudget = campaign.daily_budget?.amount || 
                          campaign.dailyBudget?.amount || 
                          campaign.budget?.daily_amount ||
                          0;
      
      campaignBudgets.set(campaign.id, {
        daily_budget: parseFloat(dailyBudget),
      });
      
      console.log(`Campaign ${campaign.id} (${campaign.title}): daily_budget=${dailyBudget}`);
    }
  } catch (error) {
    console.error('Error fetching campaign details:', error);
  }
  
  return campaignBudgets;
}

// Create report with CREATIVE dimension for creative-level data
async function createCreativeReport(accessToken: string, adAccountId: string, retryCount = 0): Promise<{ reportId: string; startDate: string; endDate: string }> {
  // Only sync complete days (up to yesterday)
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1); // Yesterday
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];
  
  console.log(`Creating Moloco creative report for date range: ${startStr} to ${endStr}`);
  
  const response = await fetch(`${MOLOCO_API_URL}/reports`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ad_account_id: adAccountId,
      date_range: {
        start: startStr,
        end: endStr,
      },
      dimensions: ['CREATIVE', 'DATE', 'CAMPAIGN', 'AD_GROUP'],
    }),
  });

  console.log(`Creative reports API response status: ${response.status}`);
  const responseText = await response.text();
  console.log(`Creative reports API response body: ${responseText.substring(0, 500)}`);

  if (response.status === 429) {
    if (retryCount < 3) {
      const waitTime = Math.pow(2, retryCount) * 5000;
      console.log(`Rate limited, waiting ${waitTime/1000}s before retry ${retryCount + 1}...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return createCreativeReport(accessToken, adAccountId, retryCount + 1);
    }
    throw new Error('Moloco API rate limit exceeded. Please try again in a few minutes.');
  }

  if (!response.ok) {
    throw new Error(`Failed to create Moloco creative report: ${response.status} ${responseText}`);
  }

  const data = JSON.parse(responseText);
  console.log('Creative report created with ID:', data.id);
  return { reportId: data.id, startDate: startStr, endDate: endStr };
}

// Create report with DATE dimension for campaign-level daily breakdown
async function createCampaignReport(accessToken: string, adAccountId: string, retryCount = 0): Promise<{ reportId: string; startDate: string; endDate: string }> {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];
  
  console.log(`Creating Moloco campaign report for date range: ${startStr} to ${endStr}`);
  
  const response = await fetch(`${MOLOCO_API_URL}/reports`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ad_account_id: adAccountId,
      date_range: {
        start: startStr,
        end: endStr,
      },
      dimensions: ['CAMPAIGN', 'DATE'],
    }),
  });

  console.log(`Campaign reports API response status: ${response.status}`);
  const responseText = await response.text();
  console.log(`Campaign reports API response body: ${responseText.substring(0, 500)}`);

  if (response.status === 429) {
    if (retryCount < 3) {
      const waitTime = Math.pow(2, retryCount) * 5000;
      console.log(`Rate limited, waiting ${waitTime/1000}s before retry ${retryCount + 1}...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return createCampaignReport(accessToken, adAccountId, retryCount + 1);
    }
    throw new Error('Moloco API rate limit exceeded. Please try again in a few minutes.');
  }

  if (!response.ok) {
    throw new Error(`Failed to create Moloco campaign report: ${response.status} ${responseText}`);
  }

  const data = JSON.parse(responseText);
  console.log('Campaign report created with ID:', data.id);
  return { reportId: data.id, startDate: startStr, endDate: endStr };
}

async function getReportStatus(accessToken: string, reportId: string): Promise<{ status: string; locationJson?: string }> {
  const response = await fetch(`${MOLOCO_API_URL}/reports/${reportId}/status`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get report status: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return {
    status: data.status,
    locationJson: data.location_json,
  };
}

async function waitForReportAndDownload(accessToken: string, reportId: string): Promise<any[]> {
  console.log('Waiting for report to be ready...');
  
  const maxAttempts = 30;
  const delayMs = 2000;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { status, locationJson } = await getReportStatus(accessToken, reportId);
    
    console.log(`Report status (attempt ${attempt + 1}): ${status}`);
    
    if (status === 'READY' && locationJson) {
      console.log('Report ready, downloading...');
      const reportResponse = await fetch(locationJson);
      if (!reportResponse.ok) {
        throw new Error(`Failed to download report: ${reportResponse.status}`);
      }
      const reportData = await reportResponse.json();
      return reportData.rows || [];
    }
    
    if (status === 'FAILED') {
      throw new Error('Report generation failed');
    }
    
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  throw new Error('Report generation timed out');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const syncLog = await startSyncLog('moloco-sync-campaigns');
  
  try {
    const body = await req.json().catch(() => ({}));
    const { userId, orgId } = await resolveOrgContext(req, body);

    // Resolve credentials from tenant or env fallback
    const { credentials: creds } = await getTenantCredentials('moloco', orgId);
    const adAccountId = creds.ad_account_id;
    const apiKey = creds.api_key;

    if (!apiKey || !adAccountId) {
      await completeSyncLog(syncLog?.id || null, false, 'Moloco credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Moloco credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Syncing Moloco campaigns and creatives for user: ${userId}, org: ${orgId}`);
    console.log(`Using ad account ID: ${adAccountId}`);

    const accessToken = await getMolocoAccessToken(apiKey);
    
    // Fetch campaign details with budgets
    const campaignBudgets = await fetchCampaignDetails(accessToken, adAccountId);
    
    // Create campaign-level report for daily_ad_spend and moloco_campaigns
    console.log('Creating campaign-level report...');
    const { reportId: campaignReportId } = await createCampaignReport(accessToken, adAccountId);
    const campaignRows = await waitForReportAndDownload(accessToken, campaignReportId);
    console.log(`Received ${campaignRows.length} campaign report rows`);

    // Process campaign data
    const dailySpendData: any[] = [];
    const campaignMap = new Map<string, any>();
    
    for (const row of campaignRows) {
      const campaignId = row.campaign?.id;
      if (!campaignId) continue;
      
      const rowDate = row.date || row.dimension_date || row.time?.date;
      const metric = row.metric || {};
      
      const spend = Number(metric.spend?.amount || metric.spend?.value || metric.spend || metric.cost || 0);
      const impressions = Number(metric.impressions) || 0;
      const clicks = Number(metric.clicks) || 0;
      const installs = Number(metric.installs) || 0;

      if (rowDate) {
        dailySpendData.push({
          user_id: userId,
          platform: 'moloco',
          campaign_id: campaignId,
          campaign_name: row.campaign?.title || 'Unknown',
          date: rowDate,
          spend,
          impressions,
          clicks,
          installs,
          synced_at: new Date().toISOString(),
        });
      }
      
      const existing = campaignMap.get(campaignId) || {
        campaign_id: campaignId,
        campaign_name: row.campaign?.title || 'Unknown',
        status: row.campaign?.status || 'UNKNOWN',
        impressions: 0,
        clicks: 0,
        installs: 0,
        spend: 0,
        start_date: null,
        end_date: null,
      };
      
      if (rowDate) {
        if (!existing.start_date || rowDate < existing.start_date) existing.start_date = rowDate;
        if (!existing.end_date || rowDate > existing.end_date) existing.end_date = rowDate;
      }
      
      existing.impressions += impressions;
      existing.clicks += clicks;
      existing.installs += installs;
      existing.spend += spend;
      
      campaignMap.set(campaignId, existing);
    }

    // Upsert daily spend data
    if (dailySpendData.length > 0) {
      const { error: dailyError } = await supabaseService
        .from('daily_ad_spend')
        .upsert(dailySpendData, { 
          onConflict: 'platform,campaign_id,date',
        });

      if (dailyError) {
        console.error('Error upserting daily spend:', dailyError);
      } else {
        console.log(`Upserted ${dailySpendData.length} daily spend records`);
      }
    }

    // Upsert aggregate campaign data
    const campaignData = Array.from(campaignMap.values()).map(campaign => {
      const cpc = campaign.clicks > 0 ? campaign.spend / campaign.clicks : 0;
      const cpm = campaign.impressions > 0 ? (campaign.spend / campaign.impressions) * 1000 : 0;
      const cpa = campaign.installs > 0 ? campaign.spend / campaign.installs : 0;
      const budgetInfo = campaignBudgets.get(campaign.campaign_id) || { daily_budget: 0 };
      
      return {
        user_id: userId,
        campaign_id: campaign.campaign_id,
        campaign_name: campaign.campaign_name,
        status: campaign.status,
        impressions: campaign.impressions,
        clicks: campaign.clicks,
        installs: campaign.installs,
        spend: campaign.spend,
        cpc,
        cpm,
        cpa,
        daily_budget: budgetInfo.daily_budget,
        start_date: campaign.start_date,
        end_date: campaign.end_date,
        synced_at: new Date().toISOString(),
      };
    });

    const { error: upsertError } = await supabaseService
      .from('moloco_campaigns')
      .upsert(campaignData, {
        onConflict: 'user_id,campaign_id',
      });

    if (upsertError) {
      console.error('Database error for campaigns:', upsertError);
    }

    // Now create creative-level report
    console.log('Creating creative-level report...');
    let totalCreatives = 0;
    let totalDailyCreativeRecords = 0;
    
    try {
      const { reportId: creativeReportId } = await createCreativeReport(accessToken, adAccountId);
      const creativeRows = await waitForReportAndDownload(accessToken, creativeReportId);
      console.log(`Received ${creativeRows.length} creative report rows`);

      if (creativeRows.length > 0) {
        console.log('Sample creative row structure:', JSON.stringify(creativeRows[0], null, 2));
      }

      // Process creative data - aggregate by (creative_id, date) to avoid duplicate key conflicts
      const dailyCreativeAggMap = new Map<string, {
        creative_id: string;
        creative_name: string;
        date: string;
        spend: number;
        impressions: number;
        clicks: number;
        installs: number;
        revenue: number;
      }>();
      const creativeMap = new Map<string, any>();
      
      for (const row of creativeRows) {
        const creativeId = row.creative?.id;
        if (!creativeId) continue;
        
        const rowDate = row.date || row.dimension_date || row.time?.date;
        const metric = row.metric || {};
        
        const spend = Number(metric.spend?.amount || metric.spend?.value || metric.spend || metric.cost || 0);
        const impressions = Number(metric.impressions) || 0;
        const clicks = Number(metric.clicks) || 0;
        const installs = Number(metric.installs) || 0;
        const revenue = Number(metric.revenue?.amount || metric.revenue?.value || metric.revenue || 0);

        // Aggregate daily spend by (creative_id, date)
        if (rowDate) {
          const key = `${creativeId}|${rowDate}`;
          const existingDaily = dailyCreativeAggMap.get(key) || {
            creative_id: creativeId,
            creative_name: row.creative?.title || 'Unknown',
            date: rowDate,
            spend: 0,
            impressions: 0,
            clicks: 0,
            installs: 0,
            revenue: 0,
          };
          
          existingDaily.spend += spend;
          existingDaily.impressions += impressions;
          existingDaily.clicks += clicks;
          existingDaily.installs += installs;
          existingDaily.revenue += revenue;
          
          dailyCreativeAggMap.set(key, existingDaily);
        }
        
        // Aggregate totals for creative master record
        const existing = creativeMap.get(creativeId) || {
          creative_id: creativeId,
          creative_name: row.creative?.title || 'Unknown',
          creative_type: row.creative?.type || null,
          main_asset_url: row.creative?.main_asset_location || null,
          campaign_id: row.campaign?.id || null,
          campaign_name: row.campaign?.title || null,
          ad_group_id: row.ad_group?.id || null,
          ad_group_name: row.ad_group?.title || null,
          total_spend: 0,
          total_impressions: 0,
          total_clicks: 0,
          total_installs: 0,
        };
        
        existing.total_spend += spend;
        existing.total_impressions += impressions;
        existing.total_clicks += clicks;
        existing.total_installs += installs;
        
        // Update asset URL if we find one
        if (row.creative?.main_asset_location && !existing.main_asset_url) {
          existing.main_asset_url = row.creative.main_asset_location;
        }
        
        creativeMap.set(creativeId, existing);
      }
      
      // Convert aggregated daily data to array
      const dailyCreativeSpendData = Array.from(dailyCreativeAggMap.values()).map(item => ({
        user_id: userId,
        creative_id: item.creative_id,
        creative_name: item.creative_name,
        date: item.date,
        spend: item.spend,
        impressions: item.impressions,
        clicks: item.clicks,
        installs: item.installs,
        revenue: item.revenue,
        synced_at: new Date().toISOString(),
      }));
      
      console.log(`Aggregated to ${dailyCreativeSpendData.length} unique (creative_id, date) records from ${creativeRows.length} raw rows`);

      // Upsert daily creative spend data
      if (dailyCreativeSpendData.length > 0) {
        const { error: dailyCreativeError } = await supabaseService
          .from('daily_moloco_creative_spend')
          .upsert(dailyCreativeSpendData, { 
            onConflict: 'creative_id,date',
          });

        if (dailyCreativeError) {
          console.error('Error upserting daily creative spend:', dailyCreativeError);
        } else {
          console.log(`Upserted ${dailyCreativeSpendData.length} daily creative spend records`);
          totalDailyCreativeRecords = dailyCreativeSpendData.length;
        }
      }

      // Upsert aggregate creative data
      const creativeData = Array.from(creativeMap.values()).map(creative => ({
        user_id: userId,
        creative_id: creative.creative_id,
        creative_name: creative.creative_name,
        creative_type: creative.creative_type,
        main_asset_url: creative.main_asset_url,
        campaign_id: creative.campaign_id,
        campaign_name: creative.campaign_name,
        ad_group_id: creative.ad_group_id,
        ad_group_name: creative.ad_group_name,
        total_spend: creative.total_spend,
        total_impressions: creative.total_impressions,
        total_clicks: creative.total_clicks,
        total_installs: creative.total_installs,
        synced_at: new Date().toISOString(),
      }));

      if (creativeData.length > 0) {
        const { error: creativeUpsertError } = await supabaseService
          .from('moloco_creatives')
          .upsert(creativeData, {
            onConflict: 'creative_id',
          });

        if (creativeUpsertError) {
          console.error('Database error for creatives:', creativeUpsertError);
        } else {
          console.log(`Upserted ${creativeData.length} creative records`);
          totalCreatives = creativeData.length;
        }
      }
    } catch (creativeError) {
      // Creative report might fail due to rate limits, but we still want campaign data
      console.error('Error syncing creatives (continuing with campaign data):', creativeError);
    }

    const totalDailyBudget = campaignData.reduce((sum, c) => sum + (c.daily_budget || 0), 0);

    const result = {
      success: true,
      totalCampaigns: campaignData.length,
      totalDailyRecords: dailySpendData.length,
      totalCreatives,
      totalDailyCreativeRecords,
      totalSpend: campaignData.reduce((sum, c) => sum + c.spend, 0),
      totalInstalls: campaignData.reduce((sum, c) => sum + c.installs, 0),
      totalDailyBudget,
      syncedAt: new Date().toISOString(),
    };

    await updateLastSyncedAt(orgId, 'moloco');
    await completeSyncLog(syncLog?.id || null, true);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing Moloco campaigns:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    await completeSyncLog(syncLog?.id || null, false, message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
