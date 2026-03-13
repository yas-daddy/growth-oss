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

    const body = await req.json();
    const { creativeIds, trackingLinkId, groupName, startPaused } = body;

    if (!creativeIds || !Array.isArray(creativeIds) || creativeIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing or empty creativeIds array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!trackingLinkId) {
      return new Response(
        JSON.stringify({ error: 'Missing trackingLinkId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Creating creative group with ${creativeIds.length} creatives`);
    
    const accessToken = await getAccessToken();
    
    // Create the creative group
    const response = await fetch(`${MOLOCO_API_URL}/creative-groups`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ad_account_id: adAccountId,
        title: groupName || `Creative Group ${new Date().toISOString().split('T')[0]}`,
        creative_ids: creativeIds,
        tracking_link_id: trackingLinkId,
        status: startPaused ? 'PAUSED' : 'ACTIVE',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Creative group creation error:', errorText);
      throw new Error(`Failed to create creative group: ${response.status} ${errorText}`);
    }

    const creativeGroup = await response.json();
    console.log(`Creative group created with ID: ${creativeGroup.id}`);

    return new Response(
      JSON.stringify({ 
        creative_group_id: creativeGroup.id,
        title: creativeGroup.title,
        status: creativeGroup.status,
        creative_ids: creativeGroup.creative_ids,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating creative group:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
