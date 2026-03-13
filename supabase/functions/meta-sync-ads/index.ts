import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startSyncLog, completeSyncLog } from "../_shared/sync-logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const syncLog = await startSyncLog('meta-sync-ads');

  try {
    const metaAccessToken = Deno.env.get('META_ACCESS_TOKEN');
    let metaAdAccountId = Deno.env.get('META_AD_ACCOUNT_ID');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (metaAdAccountId && !metaAdAccountId.startsWith('act_')) {
      metaAdAccountId = `act_${metaAdAccountId}`;
    }

    if (!metaAccessToken || !metaAdAccountId) {
      console.error('Missing Meta credentials');
      return new Response(
        JSON.stringify({ error: 'Meta credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Try to get user from auth header, or fall back to admin user for service role calls
    let userId: string;
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (user) {
      // Verify user has admin role
      const { data: userRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!userRole) {
        return new Response(
          JSON.stringify({ error: 'Admin access required to sync data' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = user.id;
    } else {
      // Service role call - get first admin user
      const { data: adminRole } = await supabaseAdmin
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle();
      
      if (!adminRole) {
        return new Response(
          JSON.stringify({ error: 'No admin user found for service role sync' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = adminRole.user_id;
      console.log(`Service role sync using admin user: ${userId}`);
    }

    console.log(`Syncing Meta ads for user: ${userId}`);

    // Step 1: Fetch all ads with their details and high-quality preview images
    const adsUrl = `https://graph.facebook.com/v21.0/${metaAdAccountId}/ads`;
    const adParams = new URLSearchParams({
      access_token: metaAccessToken,
      fields: 'id,name,adset_id,campaign_id,status,created_time,creative{thumbnail_url,image_url,video_id,object_type}',
      limit: '500',
    });

    console.log('Fetching ads from Meta API...');
    const adsData: any[] = [];
    let adsNextUrl: string | null = `${adsUrl}?${adParams}`;
    
    while (adsNextUrl) {
      const adsResponse: Response = await fetch(adsNextUrl);
      const adsPageData: { data?: any[]; error?: { message: string }; paging?: { next?: string } } = await adsResponse.json();

      if (adsPageData.error) {
        console.error('Meta API error fetching ads:', adsPageData.error);
        throw new Error(adsPageData.error.message);
      }

      if (adsPageData.data) {
        adsData.push(...adsPageData.data);
      }
      
      adsNextUrl = adsPageData.paging?.next || null;
      if (adsNextUrl) {
        console.log(`Fetching next page of ads... (${adsData.length} ads so far)`);
      }
    }

    console.log(`Fetched ${adsData.length} ads`);

    // Step 2: Fetch campaign names for all campaign IDs
    const campaignIds = [...new Set(adsData.map(ad => ad.campaign_id))];
    const campaignNames = new Map<string, string>();
    
    for (let i = 0; i < campaignIds.length; i += 50) {
      const batch = campaignIds.slice(i, i + 50);
      const campaignUrl = `https://graph.facebook.com/v21.0/?ids=${batch.join(',')}&fields=id,name&access_token=${metaAccessToken}`;
      const response = await fetch(campaignUrl);
      const data = await response.json();
      
      for (const [id, info] of Object.entries(data)) {
        if ((info as any).name) {
          campaignNames.set(id, (info as any).name);
        }
      }
    }

    // Step 3: Fetch adset names for all adset IDs
    const adsetIds = [...new Set(adsData.map(ad => ad.adset_id))];
    const adsetNames = new Map<string, string>();
    
    for (let i = 0; i < adsetIds.length; i += 50) {
      const batch = adsetIds.slice(i, i + 50);
      const adsetUrl = `https://graph.facebook.com/v21.0/?ids=${batch.join(',')}&fields=id,name&access_token=${metaAccessToken}`;
      const response = await fetch(adsetUrl);
      const data = await response.json();
      
      for (const [id, info] of Object.entries(data)) {
        if ((info as any).name) {
          adsetNames.set(id, (info as any).name);
        }
      }
    }

    // Step 4: Fetch high-quality thumbnails for video ads
    const videoIds = adsData
      .filter(ad => ad.creative?.video_id)
      .map(ad => ad.creative.video_id);
    
    const videoThumbnails = new Map<string, string>();
    
    // Fetch video thumbnails with larger dimensions
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      // Request thumbnails edge which provides larger images
      const videoUrl = `https://graph.facebook.com/v21.0/?ids=${batch.join(',')}&fields=id,thumbnails{uri,width,height}&access_token=${metaAccessToken}`;
      const response = await fetch(videoUrl);
      const data = await response.json();
      
      for (const [id, info] of Object.entries(data)) {
        const videoData = info as any;
        if (videoData.thumbnails?.data && videoData.thumbnails.data.length > 0) {
          // Find the largest thumbnail
          const thumbnails = videoData.thumbnails.data as { uri: string; width: number; height: number }[];
          const largest = thumbnails.reduce((prev, curr) => 
            (curr.width * curr.height) > (prev.width * prev.height) ? curr : prev
          );
          videoThumbnails.set(id, largest.uri);
        }
      }
    }

    console.log(`Fetched ${videoThumbnails.size} video thumbnails`);

    // Step 5: Fetch ad-level insights (daily) - incremental sync
    // Find latest synced date and only fetch from there (with 7-day overlap for delayed attributions)
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1); // Yesterday
    
    let startDate = new Date();
    startDate.setDate(startDate.getDate() - 90); // Default to 90 days for first sync
    
    const { data: latestSync } = await supabaseAdmin
      .from('daily_meta_ad_spend')
      .select('date')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (latestSync?.date) {
      // Start from 7 days before latest synced date (overlap for delayed attributions)
      const latestDate = new Date(latestSync.date);
      latestDate.setDate(latestDate.getDate() - 7);
      
      // Only use incremental if it would reduce the range
      if (latestDate > startDate) {
        startDate = latestDate;
        console.log(`Incremental sync: starting from ${startDate.toISOString().split('T')[0]} (7-day overlap)`);
      }
    } else {
      console.log('Full sync: no previous data found, fetching 90 days');
    }

    const insightsUrl = `https://graph.facebook.com/v21.0/${metaAdAccountId}/insights`;
    const insightsParams = new URLSearchParams({
      access_token: metaAccessToken,
      fields: 'ad_id,ad_name,campaign_id,campaign_name,spend,impressions,clicks,reach,frequency,ctr,cpc,cpm,actions,cost_per_action_type,action_values,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_thruplay_watched_actions,date_start,date_stop',
      level: 'ad',
      time_increment: '1',
      time_range: JSON.stringify({
        since: startDate.toISOString().split('T')[0],
        until: endDate.toISOString().split('T')[0],
      }),
      limit: '500',
    });

    console.log('Fetching ad-level insights from Meta API...');
    const insightsData: any[] = [];
    let insightsNextUrl: string | null = `${insightsUrl}?${insightsParams}`;
    
    while (insightsNextUrl) {
      const insightsResponse: Response = await fetch(insightsNextUrl);
      const insightsPageData: { data?: any[]; error?: { message: string }; paging?: { next?: string } } = await insightsResponse.json();

      if (insightsPageData.error) {
        console.error('Meta API error fetching insights:', insightsPageData.error);
        throw new Error(insightsPageData.error.message);
      }

      if (insightsPageData.data) {
        insightsData.push(...insightsPageData.data);
      }
      
      insightsNextUrl = insightsPageData.paging?.next || null;
      if (insightsNextUrl) {
        console.log(`Fetching next page of insights... (${insightsData.length} records so far)`);
      }
    }

    console.log(`Fetched ${insightsData.length} daily ad insight records`);

    // Step 6: Process and aggregate ad data
    const adAggregates = new Map<string, any>();
    const adInfo = new Map<string, any>();

    // Store ad info (thumbnail, creative type, created_time, etc.)
    // For videos: use high-res video picture; for images: use image_url; fallback to thumbnail_url
    for (const ad of adsData) {
      let thumbnailUrl = ad.creative?.thumbnail_url || null;
      
      // For video creatives, use the high-quality video picture
      if (ad.creative?.video_id && videoThumbnails.has(ad.creative.video_id)) {
        thumbnailUrl = videoThumbnails.get(ad.creative.video_id) || thumbnailUrl;
      } else if (ad.creative?.image_url) {
        // For image creatives, use the high-res image_url
        thumbnailUrl = ad.creative.image_url;
      }
      
      adInfo.set(ad.id, {
        ad_id: ad.id,
        ad_name: ad.name,
        adset_id: ad.adset_id,
        adset_name: adsetNames.get(ad.adset_id) || null,
        campaign_id: ad.campaign_id,
        campaign_name: campaignNames.get(ad.campaign_id) || null,
        thumbnail_url: thumbnailUrl,
        creative_type: ad.creative?.object_type || null,
        status: ad.status,
        created_time: ad.created_time ? new Date(ad.created_time).toISOString() : null,
      });
    }

    // Aggregate insights by ad
    for (const record of insightsData) {
      const existing = adAggregates.get(record.ad_id) || {
        ad_id: record.ad_id,
        ad_name: record.ad_name,
        campaign_id: record.campaign_id,
        campaign_name: record.campaign_name,
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        date_start: record.date_start,
        date_stop: record.date_stop,
      };

      existing.spend += parseFloat(record.spend || '0');
      existing.impressions += parseInt(record.impressions || '0', 10);
      existing.clicks += parseInt(record.clicks || '0', 10);

      // Count app installs as conversions
      if (record.actions) {
        const installAction = record.actions.find(
          (a: { action_type: string; value: string }) => 
            a.action_type === 'mobile_app_install' || 
            a.action_type === 'app_install'
        );
        if (installAction) {
          existing.conversions += parseInt(installAction.value, 10);
        }
      }

      if (record.date_start < existing.date_start) existing.date_start = record.date_start;
      if (record.date_stop > existing.date_stop) existing.date_stop = record.date_stop;

      adAggregates.set(record.ad_id, existing);
    }

    // Helper to extract action values by type
    const getActionValue = (actions: any[], actionType: string): number => {
      if (!actions) return 0;
      const action = actions.find((a: any) => a.action_type === actionType);
      return action ? parseInt(action.value, 10) : 0;
    };

    const getCostPerAction = (costs: any[], actionType: string): number => {
      if (!costs) return 0;
      const cost = costs.find((c: any) => c.action_type === actionType);
      return cost ? parseFloat(cost.value) : 0;
    };

    const getActionValueAmount = (values: any[], actionType: string): number => {
      if (!values) return 0;
      const value = values.find((v: any) => v.action_type === actionType);
      return value ? parseFloat(value.value) : 0;
    };

    // Step 6: Upsert daily ad spend records
    const dailyAdSpendRecords = insightsData.map((record: any) => {
      // App installs / conversions
      const conversions = getActionValue(record.actions, 'mobile_app_install') || 
                          getActionValue(record.actions, 'app_install');
      
      // Registrations (complete_registration action)
      const registrations = getActionValue(record.actions, 'complete_registration') ||
                           getActionValue(record.actions, 'omni_complete_registration');
      const registrationsCost = getCostPerAction(record.cost_per_action_type, 'complete_registration') ||
                                getCostPerAction(record.cost_per_action_type, 'omni_complete_registration');
      
      // Purchases
      const purchases = getActionValue(record.actions, 'purchase') ||
                       getActionValue(record.actions, 'omni_purchase');
      const purchasesCost = getCostPerAction(record.cost_per_action_type, 'purchase') ||
                           getCostPerAction(record.cost_per_action_type, 'omni_purchase');
      const purchasesValue = getActionValueAmount(record.action_values, 'purchase') ||
                            getActionValueAmount(record.action_values, 'omni_purchase');
      
      // Add to cart
      const addToCart = getActionValue(record.actions, 'add_to_cart') ||
                       getActionValue(record.actions, 'omni_add_to_cart');
      
      // Link clicks and landing page views
      const linkClicks = getActionValue(record.actions, 'link_click');
      const landingPageViews = getActionValue(record.actions, 'landing_page_view');
      
      // Video view metrics
      const videoViews25 = getActionValue(record.video_p25_watched_actions, 'video_view');
      const videoViews50 = getActionValue(record.video_p50_watched_actions, 'video_view');
      const videoViews75 = getActionValue(record.video_p75_watched_actions, 'video_view');
      const videoViews100 = getActionValue(record.video_p100_watched_actions, 'video_view');
      const videoViews3s = getActionValue(record.video_thruplay_watched_actions, 'video_view');

      return {
        user_id: userId,
        ad_id: record.ad_id,
        ad_name: record.ad_name,
        campaign_id: record.campaign_id,
        campaign_name: record.campaign_name,
        date: record.date_start,
        spend: parseFloat(record.spend || '0'),
        impressions: parseInt(record.impressions || '0', 10),
        clicks: parseInt(record.clicks || '0', 10),
        conversions,
        reach: parseInt(record.reach || '0', 10),
        frequency: parseFloat(record.frequency || '0'),
        ctr: parseFloat(record.ctr || '0'),
        cpc: parseFloat(record.cpc || '0'),
        cpm: parseFloat(record.cpm || '0'),
        registrations,
        registrations_cost: registrationsCost,
        purchases,
        purchases_cost: purchasesCost,
        purchases_value: purchasesValue,
        add_to_cart: addToCart,
        link_clicks: linkClicks,
        landing_page_views: landingPageViews,
        video_views_25: videoViews25,
        video_views_50: videoViews50,
        video_views_75: videoViews75,
        video_views_100: videoViews100,
        video_views_3s: videoViews3s,
        synced_at: new Date().toISOString(),
      };
    });

    if (dailyAdSpendRecords.length > 0) {
      const { error: dailyError } = await supabaseAdmin
        .from('daily_meta_ad_spend')
        .upsert(dailyAdSpendRecords, {
          onConflict: 'ad_id,date',
        });

      if (dailyError) {
        console.error('Error upserting daily ad spend:', dailyError);
      } else {
        console.log(`Upserted ${dailyAdSpendRecords.length} daily ad spend records`);
      }
    }

    // Step 7: Upsert aggregated ad data to meta_ads table
    const metaAdsRecords = [];
    for (const [adId, aggregate] of adAggregates) {
      const info = adInfo.get(adId) || {};
      
      metaAdsRecords.push({
        user_id: userId,
        ad_id: adId,
        ad_name: aggregate.ad_name,
        adset_id: info.adset_id || null,
        adset_name: info.adset_name || null,
        campaign_id: aggregate.campaign_id,
        campaign_name: aggregate.campaign_name,
        thumbnail_url: info.thumbnail_url || null,
        creative_type: info.creative_type || null,
        status: info.status || null,
        created_time: info.created_time || null,
        spend: aggregate.spend,
        impressions: aggregate.impressions,
        clicks: aggregate.clicks,
        conversions: aggregate.conversions,
        date_start: aggregate.date_start,
        date_stop: aggregate.date_stop,
        synced_at: new Date().toISOString(),
      });
    }

    if (metaAdsRecords.length > 0) {
      const { error: adsError } = await supabaseAdmin
        .from('meta_ads')
        .upsert(metaAdsRecords, {
          onConflict: 'ad_id',
        });

      if (adsError) {
        console.error('Error upserting meta ads:', adsError);
      } else {
        console.log(`Upserted ${metaAdsRecords.length} meta ads records`);
      }
    }

    const totalSpend = metaAdsRecords.reduce((sum, a) => sum + a.spend, 0);
    const totalConversions = metaAdsRecords.reduce((sum, a) => sum + a.conversions, 0);

    const summary = {
      totalAds: metaAdsRecords.length,
      totalDailyRecords: dailyAdSpendRecords.length,
      totalSpend,
      totalConversions,
      syncedAt: new Date().toISOString(),
    };

    console.log('Ad sync completed:', summary);

    await completeSyncLog(syncLog?.id || null, true);

    return new Response(
      JSON.stringify({ success: true, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in meta-sync-ads:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await completeSyncLog(syncLog?.id || null, false, errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
