import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startSyncLog, completeSyncLog } from "../_shared/sync-logger.ts";
import { getTenantCredentials, updateLastSyncedAt } from "../_shared/tenant-credentials.ts";
import { resolveOrgContext } from "../_shared/org-resolver.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const syncLog = await startSyncLog('meta-sync-campaigns');

  try {
    const body = await req.json().catch(() => ({}));
    const { userId, orgId } = await resolveOrgContext(req, body);

    // Resolve credentials from tenant or env fallback
    const { credentials } = await getTenantCredentials('meta_ads', orgId);
    let metaAccessToken = credentials.access_token;
    let metaAdAccountId = credentials.ad_account_id;

    if (!metaAccessToken || !metaAdAccountId) {
      return new Response(
        JSON.stringify({ error: 'Meta credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (metaAdAccountId && !metaAdAccountId.startsWith('act_')) {
      metaAdAccountId = `act_${metaAdAccountId}`;
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Syncing Meta campaigns (daily) for user: ${userId}, org: ${orgId}`);

    // Fetch campaign details with budget info
    const campaignsUrl = `https://graph.facebook.com/v21.0/${metaAdAccountId}/campaigns`;
    const campaignParams = new URLSearchParams({
      access_token: metaAccessToken,
      fields: 'id,name,status,daily_budget,lifetime_budget',
      limit: '500',
    });

    console.log('Fetching campaign budget info from Meta API...');
    const campaignBudgets = new Map<string, { daily_budget: number; lifetime_budget: number; uses_abo: boolean; is_active: boolean }>();
    
    let campaignsNextUrl: string | null = `${campaignsUrl}?${campaignParams}`;
    while (campaignsNextUrl) {
      const response = await fetch(campaignsNextUrl);
      const pageData: { data?: any[]; error?: { message: string }; paging?: { next?: string } } = await response.json();

      if (pageData.error) {
        console.error('Meta API error fetching campaigns:', pageData.error);
      } else if (pageData.data) {
        for (const campaign of pageData.data) {
          const dailyBudget = parseFloat(campaign.daily_budget || '0') / 100;
          const lifetimeBudget = parseFloat(campaign.lifetime_budget || '0') / 100;
          const usesAbo = dailyBudget === 0 && lifetimeBudget === 0;
          const isActive = campaign.status === 'ACTIVE';
          
          campaignBudgets.set(campaign.id, {
            daily_budget: isActive ? dailyBudget : 0,
            lifetime_budget: isActive ? lifetimeBudget : 0,
            uses_abo: usesAbo,
            is_active: isActive,
          });
        }
      }
      
      campaignsNextUrl = pageData.paging?.next || null;
    }

    console.log(`Fetched budgets for ${campaignBudgets.size} campaigns`);

    // Fetch adset-level budgets for campaigns using ABO
    const adsetsUrl = `https://graph.facebook.com/v21.0/${metaAdAccountId}/adsets`;
    const adsetParams = new URLSearchParams({
      access_token: metaAccessToken,
      fields: 'id,campaign_id,daily_budget,lifetime_budget,status',
      limit: '500',
    });

    console.log('Fetching adset budget info from Meta API...');
    const adsetBudgetsByCampaign = new Map<string, { daily_budget: number; lifetime_budget: number }>();
    
    let adsetsNextUrl: string | null = `${adsetsUrl}?${adsetParams}`;
    while (adsetsNextUrl) {
      const response = await fetch(adsetsNextUrl);
      const pageData: { data?: any[]; error?: { message: string }; paging?: { next?: string } } = await response.json();

      if (pageData.error) {
        console.error('Meta API error fetching adsets:', pageData.error);
      } else if (pageData.data) {
        for (const adset of pageData.data) {
          if (adset.status !== 'ACTIVE') continue;
          
          const campaignId = adset.campaign_id;
          const existing = adsetBudgetsByCampaign.get(campaignId) || { daily_budget: 0, lifetime_budget: 0 };
          
          existing.daily_budget += parseFloat(adset.daily_budget || '0') / 100;
          existing.lifetime_budget += parseFloat(adset.lifetime_budget || '0') / 100;
          
          adsetBudgetsByCampaign.set(campaignId, existing);
        }
      }
      
      adsetsNextUrl = pageData.paging?.next || null;
    }

    console.log(`Fetched adset budgets for ${adsetBudgetsByCampaign.size} campaigns`);

    // Merge adset budgets into campaign budgets for ABO campaigns
    for (const [campaignId, budget] of campaignBudgets) {
      if (budget.uses_abo && budget.is_active) {
        const adsetBudget = adsetBudgetsByCampaign.get(campaignId);
        if (adsetBudget) {
          budget.daily_budget = adsetBudget.daily_budget;
          budget.lifetime_budget = adsetBudget.lifetime_budget;
        }
      }
    }

    // Fetch DAILY campaign insights
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    
    const metaUrl = `https://graph.facebook.com/v21.0/${metaAdAccountId}/insights`;
    const params = new URLSearchParams({
      access_token: metaAccessToken,
      fields: 'campaign_id,campaign_name,spend,impressions,clicks,actions,date_start,date_stop',
      level: 'campaign',
      time_increment: '1',
      time_range: JSON.stringify({
        since: startDate.toISOString().split('T')[0],
        until: endDate.toISOString().split('T')[0],
      }),
    });

    console.log(`Fetching daily data from Meta API...`);
    
    const allRecords: any[] = [];
    let nextUrl: string | null = `${metaUrl}?${params}`;
    
    while (nextUrl) {
      const response = await fetch(nextUrl);
      const pageData: { data?: any[]; error?: { message: string }; paging?: { next?: string } } = await response.json();

      if (pageData.error) {
        console.error('Meta API error:', pageData.error);
        return new Response(
          JSON.stringify({ error: pageData.error.message || 'Meta API error' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (pageData.data) {
        allRecords.push(...pageData.data);
      }
      
      nextUrl = pageData.paging?.next || null;
      if (nextUrl) {
        console.log(`Fetching next page... (${allRecords.length} records so far)`);
      }
    }

    console.log(`Received ${allRecords.length} total daily records`);

    const dailyRecords = allRecords;
    
    // Process daily records for daily_ad_spend table
    const dailySpendData = dailyRecords.map((record: any) => {
      let installs = 0;
      if (record.actions) {
        const installAction = record.actions.find(
          (a: { action_type: string; value: string }) => 
            a.action_type === 'mobile_app_install' || 
            a.action_type === 'app_install'
        );
        if (installAction) {
          installs = parseInt(installAction.value, 10);
        }
      }

      return {
        user_id: userId,
        platform: 'meta',
        campaign_id: record.campaign_id,
        campaign_name: record.campaign_name,
        date: record.date_start,
        spend: parseFloat(record.spend || '0'),
        impressions: parseInt(record.impressions || '0', 10),
        clicks: parseInt(record.clicks || '0', 10),
        installs,
        synced_at: new Date().toISOString(),
      };
    });

    // Upsert daily spend data
    if (dailySpendData.length > 0) {
      const { error: dailyError } = await supabaseAdmin
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

    // Also update aggregate campaign data in meta_campaigns
    const campaignAggregates = new Map<string, any>();
    for (const record of dailyRecords) {
      const existing = campaignAggregates.get(record.campaign_id) || {
        campaign_id: record.campaign_id,
        campaign_name: record.campaign_name,
        spend: 0,
        impressions: 0,
        clicks: 0,
        installs: 0,
        date_start: record.date_start,
        date_stop: record.date_stop,
      };
      
      existing.spend += parseFloat(record.spend || '0');
      existing.impressions += parseInt(record.impressions || '0', 10);
      existing.clicks += parseInt(record.clicks || '0', 10);
      
      if (record.actions) {
        const installAction = record.actions.find(
          (a: { action_type: string; value: string }) => 
            a.action_type === 'mobile_app_install' || 
            a.action_type === 'app_install'
        );
        if (installAction) {
          existing.installs += parseInt(installAction.value, 10);
        }
      }
      
      if (record.date_start < existing.date_start) existing.date_start = record.date_start;
      if (record.date_stop > existing.date_stop) existing.date_stop = record.date_stop;
      
      campaignAggregates.set(record.campaign_id, existing);
    }

    const upsertedCampaigns = [];
    for (const [, campaign] of campaignAggregates) {
      const cpa = campaign.installs > 0 ? campaign.spend / campaign.installs : 0;
      const cpc = campaign.clicks > 0 ? campaign.spend / campaign.clicks : 0;
      const cpm = campaign.impressions > 0 ? (campaign.spend / campaign.impressions) * 1000 : 0;

      const budgetInfo = campaignBudgets.get(campaign.campaign_id) || { daily_budget: 0, lifetime_budget: 0 };

      const campaignData = {
        user_id: userId,
        campaign_id: campaign.campaign_id,
        campaign_name: campaign.campaign_name,
        spend: campaign.spend,
        impressions: campaign.impressions,
        clicks: campaign.clicks,
        installs: campaign.installs,
        cpc,
        cpm,
        cpa,
        daily_budget: budgetInfo.daily_budget,
        lifetime_budget: budgetInfo.lifetime_budget,
        date_start: campaign.date_start,
        date_stop: campaign.date_stop,
        synced_at: new Date().toISOString(),
      };

      const { data, error } = await supabaseAdmin
        .from('meta_campaigns')
        .upsert(campaignData, { 
          onConflict: 'user_id,campaign_id',
        })
        .select()
        .single();

      if (error) {
        console.error(`Error upserting campaign ${campaign.campaign_id}:`, error);
      } else {
        upsertedCampaigns.push(data);
      }
    }

    const totalSpend = upsertedCampaigns.reduce((sum, c) => sum + Number(c.spend), 0);
    const totalInstalls = upsertedCampaigns.reduce((sum, c) => sum + c.installs, 0);
    const totalDailyBudget = upsertedCampaigns.reduce((sum, c) => sum + Number(c.daily_budget || 0), 0);

    const summary = {
      totalCampaigns: upsertedCampaigns.length,
      totalDailyRecords: dailySpendData.length,
      totalSpend,
      totalInstalls,
      totalDailyBudget,
      syncedAt: new Date().toISOString(),
    };

    console.log('Sync completed:', summary);

    // Update last_synced_at on the provider connection
    await updateLastSyncedAt(orgId, 'meta_ads');
    await completeSyncLog(syncLog?.id || null, true);

    return new Response(
      JSON.stringify({ success: true, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in meta-sync-campaigns:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await completeSyncLog(syncLog?.id || null, false, errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
