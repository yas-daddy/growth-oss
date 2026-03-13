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

    console.log(`Fetching Moloco tracking links for user: ${user.id}`);
    
    const accessToken = await getAccessToken();
    
    // Fetch tracking links
    const response = await fetch(
      `${MOLOCO_API_URL}/tracking-links?ad_account_id=${adAccountId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Moloco tracking links API error:', errorText);
      throw new Error(`Failed to fetch tracking links: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const trackingLinks = data.tracking_links || [];
    
    console.log(`Fetched ${trackingLinks.length} tracking links`);

    // Format response
    const formattedLinks = trackingLinks.map((link: any) => ({
      id: link.id,
      title: link.title,
      device_os: link.device_os,
      click_through_url: link.click_through_url,
      impression_url: link.impression_url,
      status: link.status,
    }));

    return new Response(
      JSON.stringify({ tracking_links: formattedLinks }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching tracking links:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
