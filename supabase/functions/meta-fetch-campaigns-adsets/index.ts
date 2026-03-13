import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const metaAccessToken = Deno.env.get('META_ACCESS_TOKEN');
    let metaAdAccountId = Deno.env.get('META_AD_ACCOUNT_ID');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (metaAdAccountId && !metaAdAccountId.startsWith('act_')) {
      metaAdAccountId = `act_${metaAdAccountId}`;
    }

    if (!metaAccessToken || !metaAdAccountId) {
      return new Response(
        JSON.stringify({ error: 'Meta credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!userRole) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching campaigns and adsets from Meta API...');

    // Fetch campaigns
    const campaignsUrl = `https://graph.facebook.com/v21.0/${metaAdAccountId}/campaigns`;
    const campaignParams = new URLSearchParams({
      access_token: metaAccessToken,
      fields: 'id,name,status,objective,daily_budget,lifetime_budget',
      limit: '500',
    });

    const campaigns: any[] = [];
    let campaignsNextUrl: string | null = `${campaignsUrl}?${campaignParams}`;
    
    while (campaignsNextUrl) {
      const campaignsResponse = await fetch(campaignsNextUrl);
      const campaignsData: { data?: any[]; error?: { message: string }; paging?: { next?: string } } = await campaignsResponse.json();
      
      if (campaignsData.error) {
        console.error('Meta API error fetching campaigns:', campaignsData.error);
        return new Response(
          JSON.stringify({ error: campaignsData.error.message || 'Meta API error' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (campaignsData.data) {
        campaigns.push(...campaignsData.data);
      }
      
      campaignsNextUrl = campaignsData.paging?.next || null;
    }

    console.log(`Fetched ${campaigns.length} campaigns`);

    // Fetch adsets with promoted_object to get app store URLs
    const adsetsUrl = `https://graph.facebook.com/v21.0/${metaAdAccountId}/adsets`;
    const adsetParams = new URLSearchParams({
      access_token: metaAccessToken,
      fields: 'id,name,status,campaign_id,daily_budget,lifetime_budget,targeting,promoted_object',
      limit: '500',
    });

    const adsets: any[] = [];
    let adsetsNextUrl: string | null = `${adsetsUrl}?${adsetParams}`;
    
    while (adsetsNextUrl) {
      const adsetsResponse = await fetch(adsetsNextUrl);
      const adsetsData: { data?: any[]; error?: { message: string }; paging?: { next?: string } } = await adsetsResponse.json();
      
      if (adsetsData.error) {
        console.error('Meta API error fetching adsets:', adsetsData.error);
        break;
      }
      
      if (adsetsData.data) {
        adsets.push(...adsetsData.data);
      }
      
      adsetsNextUrl = adsetsData.paging?.next || null;
    }

    console.log(`Fetched ${adsets.length} adsets`);

    // Cache for app details by application ID
    const appCache: Record<string, { iosUrl?: string; androidUrl?: string }> = {};

    // Group adsets by campaign_id and fetch app store URLs
    const adsetsByCampaign = new Map<string, any[]>();
    
    for (const adset of adsets) {
      const campaignId = adset.campaign_id;
      if (!adsetsByCampaign.has(campaignId)) {
        adsetsByCampaign.set(campaignId, []);
      }
      
      let iosUrl: string | undefined;
      let androidUrl: string | undefined;
      
      // Check promoted_object for object_store_url or application_id
      if (adset.promoted_object) {
        const po = adset.promoted_object;
        
        // Direct object_store_url
        if (po.object_store_url) {
          const url = po.object_store_url;
          if (url.includes('apps.apple.com') || url.includes('itunes.apple.com')) {
            iosUrl = url;
          } else if (url.includes('play.google.com')) {
            androidUrl = url;
          }
        }
        
        // Fetch app details if we have application_id
        if (po.application_id) {
          if (appCache[po.application_id]) {
            iosUrl = iosUrl || appCache[po.application_id].iosUrl;
            androidUrl = androidUrl || appCache[po.application_id].androidUrl;
          } else {
            try {
              const appUrl = `https://graph.facebook.com/v21.0/${po.application_id}?fields=ios_app_store_id,object_store_urls&access_token=${metaAccessToken}`;
              const appResponse = await fetch(appUrl);
              const appData = await appResponse.json();
              
              if (appData && !appData.error) {
                // object_store_urls is an array of store URLs
                if (appData.object_store_urls && Array.isArray(appData.object_store_urls)) {
                  for (const url of appData.object_store_urls) {
                    if (url.includes('apps.apple.com') || url.includes('itunes.apple.com')) {
                      iosUrl = url;
                    } else if (url.includes('play.google.com')) {
                      androidUrl = url;
                    }
                  }
                }
                
                // Build iOS URL from app store ID if not found
                if (!iosUrl && appData.ios_app_store_id) {
                  iosUrl = `https://apps.apple.com/app/id${appData.ios_app_store_id}`;
                }
                
                appCache[po.application_id] = { iosUrl, androidUrl };
              }
            } catch (err) {
              console.error('Error fetching app details:', err);
            }
          }
        }
      }
      
      adsetsByCampaign.get(campaignId)!.push({
        id: adset.id,
        name: adset.name,
        status: adset.status,
        daily_budget: adset.daily_budget ? parseFloat(adset.daily_budget) / 100 : null,
        lifetime_budget: adset.lifetime_budget ? parseFloat(adset.lifetime_budget) / 100 : null,
        targeting: adset.targeting || null,
        iosUrl,
        androidUrl,
      });
    }

    // Build response with campaigns and their adsets
    const result = campaigns.map(campaign => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      objective: campaign.objective,
      daily_budget: campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : null,
      lifetime_budget: campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget) / 100 : null,
      adsets: adsetsByCampaign.get(campaign.id) || [],
    }));

    // Sort: ACTIVE first, then by name
    result.sort((a, b) => {
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
      return a.name.localeCompare(b.name);
    });

    return new Response(
      JSON.stringify({ campaigns: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in meta-fetch-campaigns-adsets:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
