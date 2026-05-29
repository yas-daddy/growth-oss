import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AppsFlyer OneLink config — set these to your own OneLink subdomain and template ID.
const ONELINK_SUBDOMAIN = Deno.env.get('ONELINK_SUBDOMAIN') ?? 'your-brand';
const ONELINK_TEMPLATE_ID = Deno.env.get('ONELINK_TEMPLATE_ID') ?? 'xxxx';

interface OneLinkRequest {
  affiliate_id: string;
  campaign_names: string[];
}

interface GeneratedLink {
  campaign_name: string;
  url: string;
}

function constructOneLinkUrl(mediaSource: string, campaignName: string): string {
  const params = new URLSearchParams({
    pid: mediaSource,
    c: campaignName,
    af_force_deeplink: 'true',
  });
  return `https://${ONELINK_SUBDOMAIN}.onelink.me/${ONELINK_TEMPLATE_ID}?${params.toString()}`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Get the user from the auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { affiliate_id, campaign_names }: OneLinkRequest = await req.json();

    if (!affiliate_id || !campaign_names || !Array.isArray(campaign_names) || campaign_names.length === 0) {
      throw new Error('Missing required fields: affiliate_id and campaign_names (array)');
    }

    // Validate all campaign names
    const campaignNameRegex = /^[a-zA-Z0-9_-]+$/;
    const invalidNames = campaign_names.filter(name => !campaignNameRegex.test(name));
    if (invalidNames.length > 0) {
      throw new Error(`Invalid campaign names (only letters, numbers, underscores, hyphens allowed): ${invalidNames.join(', ')}`);
    }

    console.log(`Generating ${campaign_names.length} OneLink URLs for affiliate ${affiliate_id}`);

    // Fetch the affiliate to get the channel (media_source)
    const { data: affiliate, error: affiliateError } = await supabaseAdmin
      .from('affiliates')
      .select('id, name, channel')
      .eq('id', affiliate_id)
      .single();

    if (affiliateError || !affiliate) {
      console.error('Affiliate fetch error:', affiliateError);
      throw new Error('Affiliate not found');
    }

    console.log(`Found affiliate: ${affiliate.name}, channel: ${affiliate.channel}`);

    // Generate URLs for all campaign names
    const generatedLinks: GeneratedLink[] = campaign_names.map(campaignName => ({
      campaign_name: campaignName,
      url: constructOneLinkUrl(affiliate.channel, campaignName),
    }));

    // Store all generated links in the database
    const linksToInsert = generatedLinks.map(link => ({
      affiliate_id,
      campaign_name: link.campaign_name,
      short_url: link.url,
      long_url: null,
      created_by: user.id,
    }));

    const { error: insertError } = await supabaseAdmin
      .from('affiliate_links')
      .insert(linksToInsert);

    if (insertError) {
      console.error('Failed to store links:', insertError);
      // Don't throw - still return the links even if storage fails
    }

    console.log(`Successfully generated ${generatedLinks.length} links`);

    return new Response(
      JSON.stringify({
        success: true,
        links: generatedLinks,
        affiliate_name: affiliate.name,
        media_source: affiliate.channel,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating OneLink URLs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate links';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
