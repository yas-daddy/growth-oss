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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const META_ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN');

    if (!META_ACCESS_TOKEN) {
      throw new Error('META_ACCESS_TOKEN is not configured');
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
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
      return new Response(JSON.stringify({ error: 'Admin access required to pause ads' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { ad_id, ad_name } = await req.json();

    if (!ad_id) {
      return new Response(JSON.stringify({ error: 'ad_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Pausing Meta ad: ${ad_name || ad_id}`);

    // Call Meta Graph API to pause the ad
    const metaUrl = `https://graph.facebook.com/v21.0/${ad_id}`;
    
    const response = await fetch(metaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: META_ACCESS_TOKEN,
        status: 'PAUSED',
      }),
    });

    const responseData = await response.json();
    console.log('Meta API response:', JSON.stringify(responseData));

    if (!response.ok || responseData.error) {
      const errorMessage = responseData.error?.message || 'Failed to pause ad';
      console.error('Meta API error:', errorMessage);
      return new Response(JSON.stringify({ 
        error: errorMessage,
        details: responseData.error,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update local database to reflect paused status
    const { error: dbError } = await supabase
      .from('meta_ads')
      .update({ 
        status: 'PAUSED',
        updated_at: new Date().toISOString(),
      })
      .eq('ad_id', ad_id);

    if (dbError) {
      console.error('Failed to update local database:', dbError);
    }

    return new Response(JSON.stringify({
      success: true,
      ad_id,
      ad_name,
      new_status: 'PAUSED',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error pausing ad:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
