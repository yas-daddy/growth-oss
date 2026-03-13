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
    const { adGroupId, creativeGroupId } = body;

    if (!adGroupId) {
      return new Response(
        JSON.stringify({ error: 'Missing adGroupId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!creativeGroupId) {
      return new Response(
        JSON.stringify({ error: 'Missing creativeGroupId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Attaching creative group ${creativeGroupId} to ad group ${adGroupId}`);
    
    const accessToken = await getAccessToken();
    
    // First, get the current ad group to see existing creative groups
    const getResponse = await fetch(`${MOLOCO_API_URL}/ad-groups/${adGroupId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      console.error('Get ad group error:', errorText);
      throw new Error(`Failed to get ad group: ${getResponse.status} ${errorText}`);
    }

    const adGroup = await getResponse.json();
    const existingCreativeGroupIds = adGroup.creative_group_ids || [];
    
    // Add the new creative group ID if not already present
    const updatedCreativeGroupIds = existingCreativeGroupIds.includes(creativeGroupId)
      ? existingCreativeGroupIds
      : [...existingCreativeGroupIds, creativeGroupId];

    // Update the ad group with the new creative group
    const updateResponse = await fetch(`${MOLOCO_API_URL}/ad-groups/${adGroupId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creative_group_ids: updatedCreativeGroupIds,
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('Update ad group error:', errorText);
      throw new Error(`Failed to update ad group: ${updateResponse.status} ${errorText}`);
    }

    const updatedAdGroup = await updateResponse.json();
    console.log(`Ad group ${adGroupId} updated with creative group ${creativeGroupId}`);

    return new Response(
      JSON.stringify({ 
        ad_group_id: updatedAdGroup.id,
        title: updatedAdGroup.title,
        creative_group_ids: updatedAdGroup.creative_group_ids,
        success: true,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error attaching to ad group:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
