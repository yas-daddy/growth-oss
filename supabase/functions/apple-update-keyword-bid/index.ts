import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as jose from 'https://deno.land/x/jose@v5.2.0/index.ts';

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

async function generateClientSecret(): Promise<string> {
  const clientId = Deno.env.get('APPLE_ADS_CLIENT_ID')!;
  const teamId = Deno.env.get('APPLE_ADS_TEAM_ID')!;
  const keyId = Deno.env.get('APPLE_ADS_KEY_ID')!;
  const rawPrivateKey = Deno.env.get('APPLE_ADS_PRIVATE_KEY')!;

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

  return jwt;
}

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get('APPLE_ADS_CLIENT_ID')!;
  const clientSecret = await generateClientSecret();

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
    throw new Error(`Failed to get Apple access token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

interface BidUpdateRequest {
  keyword_id: string;
  campaign_id: string;
  adgroup_id: string;
  new_bid: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const orgId = Deno.env.get('APPLE_ADS_ORG_ID')!;

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Verify the user token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has admin role
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = userRoles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required to update bids' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { keyword_id, new_bid, min_bid, max_bid } = await req.json();

    if (!keyword_id || typeof new_bid !== 'number' || new_bid <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid request: keyword_id and new_bid (positive number) required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Apply min/max bid constraints if provided
    let constrainedBid = new_bid;
    if (typeof min_bid === 'number' && constrainedBid < min_bid) {
      console.log(`Bid ${constrainedBid} below minimum ${min_bid}, clamping to minimum`);
      constrainedBid = min_bid;
    }
    if (typeof max_bid === 'number' && constrainedBid > max_bid) {
      console.log(`Bid ${constrainedBid} above maximum ${max_bid}, clamping to maximum`);
      constrainedBid = max_bid;
    }

    // Get keyword details from database to find campaign_id and adgroup_id
    const { data: keyword, error: keywordError } = await supabase
      .from('apple_keywords')
      .select('keyword_id, keyword_text, campaign_id, adgroup_id, bid_amount')
      .eq('keyword_id', keyword_id)
      .maybeSingle();

    if (keywordError || !keyword) {
      return new Response(JSON.stringify({ error: 'Keyword not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!keyword.campaign_id || !keyword.adgroup_id) {
      return new Response(JSON.stringify({ error: 'Keyword missing campaign_id or adgroup_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Updating bid for keyword "${keyword.keyword_text}" (${keyword_id}) from ${keyword.bid_amount} to ${constrainedBid}${constrainedBid !== new_bid ? ` (requested: ${new_bid}, constrained by min/max)` : ''}`);

    // Get Apple access token
    const accessToken = await getAccessToken();

    // Update keyword bid via Apple Search Ads API
    // API endpoint: PUT /campaigns/{campaignId}/adgroups/{adgroupId}/targetingkeywords/{keywordId}
    const updateUrl = `${APPLE_ADS_API_URL}/campaigns/${keyword.campaign_id}/adgroups/${keyword.adgroup_id}/targetingkeywords/${keyword_id}`;
    
    const updatePayload = {
      bidAmount: {
        amount: constrainedBid.toFixed(2),
        currency: 'GBP'
      }
    };

    console.log(`Calling Apple API: PUT ${updateUrl}`);
    console.log('Payload:', JSON.stringify(updatePayload));

    const updateResponse = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-AP-Context': `orgId=${orgId}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    });

    const responseText = await updateResponse.text();
    console.log(`Apple API response (${updateResponse.status}):`, responseText);

    if (!updateResponse.ok) {
      return new Response(JSON.stringify({ 
        error: 'Failed to update bid in Apple Search Ads',
        details: responseText,
        status: updateResponse.status
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse response
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    // Update local database with new bid
    const { error: dbUpdateError } = await supabase
      .from('apple_keywords')
      .update({ 
        bid_amount: constrainedBid,
        updated_at: new Date().toISOString()
      })
      .eq('keyword_id', keyword_id);

    if (dbUpdateError) {
      console.error('Failed to update local database:', dbUpdateError);
    }

    return new Response(JSON.stringify({
      success: true,
      keyword_id,
      keyword_text: keyword.keyword_text,
      old_bid: keyword.bid_amount,
      requested_bid: new_bid,
      new_bid: constrainedBid,
      was_constrained: constrainedBid !== new_bid,
      min_bid: min_bid ?? null,
      max_bid: max_bid ?? null,
      apple_response: responseData,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error updating keyword bid:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
