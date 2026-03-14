import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as jose from 'https://deno.land/x/jose@v5.2.0/index.ts';
import { startSyncLog, completeSyncLog } from "../_shared/sync-logger.ts";
import { getTenantCredentials, updateLastSyncedAt } from "../_shared/tenant-credentials.ts";
import { resolveOrgContext } from "../_shared/org-resolver.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APPLE_AUTH_URL = 'https://appleid.apple.com/auth/oauth2/token';
const APPLE_ADS_API_URL = 'https://api.searchads.apple.com/api/v5';

function normalizePemKey(key: string): string {
  let normalized = key.replace(/\\n/g, '\n').trim();
  normalized = normalized
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s/g, '');
  const pemKey = `-----BEGIN PRIVATE KEY-----\n${normalized}\n-----END PRIVATE KEY-----`;
  return pemKey;
}

async function generateClientSecret(creds: Record<string, string>): Promise<string> {
  const clientId = creds.client_id;
  const teamId = creds.team_id;
  const keyId = creds.key_id;
  const rawPrivateKey = creds.private_key;

  console.log('Generating client secret JWT...');
  const privateKeyPem = normalizePemKey(rawPrivateKey);
  const privateKey = await jose.importPKCS8(privateKeyPem, 'ES256');

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 86400 * 180;

  const jwt = await new jose.SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(privateKey);

  console.log('Client secret JWT generated successfully');
  return jwt;
}

async function getAccessToken(creds: Record<string, string>): Promise<string> {
  const clientId = creds.client_id;
  const clientSecret = await generateClientSecret(creds);

  console.log('Requesting access token from Apple...');

  const response = await fetch(APPLE_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'searchadsorg',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Apple OAuth error:', errorText);
    throw new Error(`Failed to get Apple access token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  console.log('Successfully obtained Apple access token');
  return data.access_token;
}

async function fetchCampaigns(accessToken: string, appleOrgId: string): Promise<any[]> {
  console.log('Fetching campaigns from Apple Search Ads...');

  const response = await fetch(`${APPLE_ADS_API_URL}/campaigns`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-AP-Context': `orgId=${appleOrgId}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Apple Ads API error:', errorText);
    throw new Error(`Failed to fetch campaigns: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  console.log(`Received ${data.data?.length || 0} campaigns`);
  
  if (data.data?.length > 0) {
    console.log('Sample campaign with budget info:', JSON.stringify(data.data[0], null, 2));
  }
  
  return data.data || [];
}

async function fetchDailyReports(accessToken: string, appleOrgId: string, campaignIds: string[]): Promise<any[]> {
  if (campaignIds.length === 0) return [];

  console.log('Fetching daily campaign reports...');

  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);

  const requestBody = {
    startTime: startDate.toISOString().split('T')[0],
    endTime: endDate.toISOString().split('T')[0],
    granularity: 'DAILY',
    selector: {
      conditions: [
        {
          field: 'campaignId',
          operator: 'IN',
          values: campaignIds,
        },
      ],
      orderBy: [
        { field: 'localSpend', sortOrder: 'DESCENDING' }
      ],
    },
    returnRowTotals: true,
    returnGrandTotals: false,
  };

  const response = await fetch(`${APPLE_ADS_API_URL}/reports/campaigns`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-AP-Context': `orgId=${appleOrgId}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Apple Ads Daily Reports API error:', errorText);
    return [];
  }

  const data = await response.json();
  console.log('Daily reports response rows:', data.data?.reportingDataResponse?.row?.length || 0);
  return data.data?.reportingDataResponse?.row || [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const syncLog = await startSyncLog('apple-sync-campaigns');
  
  try {
    const body = await req.json().catch(() => ({}));
    const { userId, orgId } = await resolveOrgContext(req, body);

    // Resolve credentials from tenant or env fallback
    const { credentials: creds } = await getTenantCredentials('apple_search_ads', orgId);
    const appleOrgId = creds.org_id_apple;

    if (!creds.client_id || !creds.private_key || !appleOrgId) {
      await completeSyncLog(syncLog?.id || null, false, 'Apple Search Ads credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Apple Search Ads credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Syncing Apple campaigns (daily) for user: ${userId}, org: ${orgId}`);

    const accessToken = await getAccessToken(creds);
    const campaigns = await fetchCampaigns(accessToken, appleOrgId);

    if (campaigns.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No campaigns found', totalCampaigns: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract budget info from campaigns
    const campaignBudgetMap = new Map<string, { daily_budget: number; budget_amount: number }>();
    for (const campaign of campaigns) {
      const dailyBudget = campaign.dailyBudgetAmount?.amount || campaign.dailyBudget?.amount || 0;
      const budgetAmount = campaign.budgetAmount?.amount || campaign.budget?.amount || campaign.totalBudget?.amount || 0;
      
      campaignBudgetMap.set(campaign.id.toString(), {
        daily_budget: parseFloat(dailyBudget),
        budget_amount: parseFloat(budgetAmount),
      });
    }

    const campaignIds = campaigns.map((c: any) => c.id.toString());
    const campaignNameMap = new Map<string, string>();
    for (const c of campaigns) {
      campaignNameMap.set(c.id.toString(), c.name);
    }

    const dailyReports = await fetchDailyReports(accessToken, appleOrgId, campaignIds);

    const dailySpendData: any[] = [];
    const campaignAggregates = new Map<string, any>();

    for (const report of dailyReports) {
      const campaignId = report.metadata?.campaignId?.toString();
      if (!campaignId) continue;

      const campaignName = campaignNameMap.get(campaignId) || 'Unknown';
      
      const granularityData = report.granularity || [];
      
      for (const dayData of granularityData) {
        const date = dayData.date;
        if (!date) continue;

        const spend = parseFloat(dayData.localSpend?.amount || '0');
        const impressions = dayData.impressions || 0;
        const taps = dayData.taps || 0;
        const installs = dayData.installs || dayData.newDownloads || dayData.conversions || 0;

        dailySpendData.push({
          user_id: userId,
          platform: 'apple',
          campaign_id: campaignId,
          campaign_name: campaignName,
          date: date,
          spend,
          impressions,
          clicks: taps,
          installs,
          synced_at: new Date().toISOString(),
        });
      }

      const totalMetrics = report.total || {};
      const existing = campaignAggregates.get(campaignId) || {
        spend: 0, impressions: 0, taps: 0, installs: 0, start_date: null, end_date: null,
      };

      existing.spend += parseFloat(totalMetrics.localSpend?.amount || '0');
      existing.impressions += totalMetrics.impressions || 0;
      existing.taps += totalMetrics.taps || 0;
      existing.installs += totalMetrics.installs || totalMetrics.newDownloads || totalMetrics.conversions || 0;

      campaignAggregates.set(campaignId, existing);
    }

    // Upsert daily spend data
    if (dailySpendData.length > 0) {
      const { error: dailyError } = await supabaseService
        .from('daily_ad_spend')
        .upsert(dailySpendData, { onConflict: 'platform,campaign_id,date' });

      if (dailyError) {
        console.error('Error upserting daily spend:', dailyError);
      } else {
        console.log(`Upserted ${dailySpendData.length} daily spend records for Apple`);
      }
    }

    // Prepare aggregate campaign data
    const campaignData = campaigns.map((campaign: any) => {
      const agg = campaignAggregates.get(campaign.id.toString()) || {};
      const budgetInfo = campaignBudgetMap.get(campaign.id.toString()) || { daily_budget: 0, budget_amount: 0 };
      
      return {
        user_id: userId,
        campaign_id: campaign.id.toString(),
        campaign_name: campaign.name,
        status: campaign.status,
        impressions: agg.impressions || 0,
        taps: agg.taps || 0,
        conversions: agg.installs || 0,
        spend: agg.spend || 0,
        avg_cpa: agg.installs > 0 ? agg.spend / agg.installs : 0,
        avg_cpt: agg.taps > 0 ? agg.spend / agg.taps : 0,
        daily_budget: budgetInfo.daily_budget,
        budget_amount: budgetInfo.budget_amount,
        start_date: campaign.startTime?.split('T')[0] || null,
        end_date: campaign.endTime?.split('T')[0] || null,
        synced_at: new Date().toISOString(),
      };
    });

    const { error: upsertError } = await supabaseService
      .from('apple_campaigns')
      .upsert(campaignData, { onConflict: 'user_id,campaign_id' });

    if (upsertError) {
      console.error('Database error:', upsertError);
      throw new Error(`Failed to save campaigns: ${upsertError.message}`);
    }

    const result = {
      success: true,
      totalCampaigns: campaignData.length,
      totalDailyRecords: dailySpendData.length,
      totalSpend: campaignData.reduce((sum, c) => sum + c.spend, 0),
      totalConversions: campaignData.reduce((sum, c) => sum + c.conversions, 0),
      totalDailyBudget: campaignData.reduce((sum, c) => sum + (c.daily_budget || 0), 0),
      syncedAt: new Date().toISOString(),
    };

    console.log('Sync completed:', result);
    await updateLastSyncedAt(orgId, 'apple_search_ads');
    await completeSyncLog(syncLog?.id || null, true);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing Apple campaigns:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    await completeSyncLog(syncLog?.id || null, false, message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
