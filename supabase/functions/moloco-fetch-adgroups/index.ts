import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MOLOCO_AUTH_URL = 'https://api.moloco.cloud/cm/v1/auth/tokens';
const MOLOCO_API_URL = 'https://api.moloco.cloud/cm/v1';

async function getAccessToken(): Promise<string> {
  const apiKey = Deno.env.get('MOLOCO_API_KEY')!;
  
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
    throw new Error(`Failed to get Moloco access token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const adAccountId = Deno.env.get('MOLOCO_AD_ACCOUNT_ID')!;

    // Verify user is authenticated
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching Moloco campaigns and ad groups for user: ${user.id}`);
    
    const accessToken = await getAccessToken();
    
    // Fetch campaigns first - Moloco uses query params, not path params
    const campaignsResponse = await fetch(
      `${MOLOCO_API_URL}/campaigns?ad_account_id=${adAccountId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!campaignsResponse.ok) {
      const errorText = await campaignsResponse.text();
      console.error('Moloco campaigns API error:', errorText);
      throw new Error(`Failed to fetch campaigns: ${campaignsResponse.status} ${errorText}`);
    }

    const campaignsData = await campaignsResponse.json();
    const campaigns = campaignsData.campaigns || [];
    
    console.log(`Fetched ${campaigns.length} campaigns`);

    // Fetch ad groups - also uses query params
    const adGroupsResponse = await fetch(
      `${MOLOCO_API_URL}/ad-groups?ad_account_id=${adAccountId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!adGroupsResponse.ok) {
      const errorText = await adGroupsResponse.text();
      console.error('Moloco ad groups API error:', errorText);
      throw new Error(`Failed to fetch ad groups: ${adGroupsResponse.status} ${errorText}`);
    }

    const adGroupsData = await adGroupsResponse.json();
    const adGroups = adGroupsData.ad_groups || [];
    
    console.log(`Fetched ${adGroups.length} ad groups`);

    // Create campaign lookup map
    const campaignMap = new Map<string, any>();
    for (const campaign of campaigns) {
      campaignMap.set(campaign.id, {
        id: campaign.id,
        title: campaign.title,
        status: campaign.status,
        app_id: campaign.app_id,
        goal: campaign.goal,
      });
    }

    // Format ad groups with campaign info
    const formattedAdGroups = adGroups.map((adGroup: any) => {
      const campaign = campaignMap.get(adGroup.campaign_id);
      return {
        id: adGroup.id,
        title: adGroup.title,
        status: adGroup.status,
        campaign_id: adGroup.campaign_id,
        campaign_title: campaign?.title || 'Unknown Campaign',
        campaign_status: campaign?.status || 'UNKNOWN',
        creative_group_ids: adGroup.creative_group_ids || [],
        targeting: adGroup.targeting,
      };
    });

    // Group by campaign for the frontend
    const campaignsWithAdGroups = campaigns.map((campaign: any) => ({
      id: campaign.id,
      title: campaign.title,
      status: campaign.status,
      app_id: campaign.app_id,
      goal: campaign.goal,
      ad_groups: formattedAdGroups.filter((ag: any) => ag.campaign_id === campaign.id),
    }));

    return new Response(
      JSON.stringify({ 
        campaigns: campaignsWithAdGroups,
        ad_groups: formattedAdGroups,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching ad groups:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
