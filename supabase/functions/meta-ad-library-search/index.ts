import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { search_terms, media_type, ad_active_status, after } = await req.json();

    if (!search_terms || search_terms.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'search_terms is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = Deno.env.get('META_ACCESS_TOKEN');
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'META_ACCESS_TOKEN not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const params = new URLSearchParams({
      search_terms: search_terms.trim(),
      ad_reached_countries: "['GB']",
      ad_type: 'ALL',
      fields: 'id,ad_creative_bodies,ad_creative_link_titles,ad_snapshot_url,ad_delivery_start_time,ad_delivery_stop_time,page_name,page_id,publisher_platforms,eu_total_reach,languages',
      access_token: accessToken,
      limit: '25',
    });

    if (media_type && media_type !== 'ALL') {
      params.set('media_type', media_type);
    }

    if (ad_active_status && ad_active_status !== 'ALL') {
      params.set('ad_active_status', ad_active_status);
    }

    if (after) {
      params.set('after', after);
    }

    const url = `https://graph.facebook.com/v22.0/ads_archive?${params.toString()}`;
    console.log('Fetching Meta Ad Library:', url.replace(accessToken, '***'));

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error('Meta API error:', data.error);
      return new Response(JSON.stringify({ error: data.error.message || 'Meta API error', code: data.error.code }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract pagination cursor
    const nextCursor = data.paging?.cursors?.after || null;
    const hasMore = !!data.paging?.next;

    return new Response(JSON.stringify({
      ads: data.data || [],
      next_cursor: nextCursor,
      has_more: hasMore,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in meta-ad-library-search:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
