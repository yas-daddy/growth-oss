import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_VERSION = 'v25.0';

interface InstagramPost {
  id: string;
  caption: string | null;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'REELS';
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  is_eligible: boolean;
  ineligibility_reason?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    const metaAccessToken = Deno.env.get('META_ACCESS_TOKEN');
    const metaAdAccountId = Deno.env.get('META_AD_ACCOUNT_ID');

    if (!metaAccessToken) {
      return new Response(
        JSON.stringify({ error: 'META_ACCESS_TOKEN not configured.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!metaAdAccountId) {
      return new Response(
        JSON.stringify({ error: 'META_AD_ACCOUNT_ID not configured.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use the Ad Account's instagram_accounts edge (Marketing API)
    // This works with ads_management permission without needing instagram_basic app approval
    const adAccountPath = metaAdAccountId.startsWith('act_') ? metaAdAccountId : `act_${metaAdAccountId}`;
    
    // Step 1: Get IG account(s) linked to the ad account
    const igAccountsUrl = `https://graph.facebook.com/${API_VERSION}/${adAccountPath}/instagram_accounts` +
      `?fields=id,username` +
      `&access_token=${metaAccessToken}`;

    console.log(`Fetching IG accounts via Marketing API: /${adAccountPath}/instagram_accounts`);
    const igAccountsResponse = await fetch(igAccountsUrl);
    const igAccountsData = await igAccountsResponse.json();

    if (igAccountsData.error) {
      console.error('Error fetching IG accounts from ad account:', JSON.stringify(igAccountsData.error));
      return new Response(
        JSON.stringify({ 
          error: igAccountsData.error.message || 'Failed to fetch Instagram accounts from ad account',
          meta_error_code: igAccountsData.error.code,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const igAccounts = igAccountsData.data || [];
    console.log(`Found ${igAccounts.length} IG account(s) linked to ad account`);

    if (igAccounts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No Instagram accounts linked to this ad account.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const igUserId = igAccounts[0].id;
    const igUsername = igAccounts[0].username || 'unknown';
    console.log(`Using IG account: ${igUserId} (${igUsername})`);

    // Step 2: Fetch media from the IG account using the system user token
    const postsUrl = `https://graph.facebook.com/${API_VERSION}/${igUserId}/media` +
      `?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp` +
      `&limit=50` +
      `&access_token=${metaAccessToken}`;

    console.log(`Fetching IG posts: /${igUserId}/media`);
    const postsResponse = await fetch(postsUrl);
    const postsData = await postsResponse.json();

    if (postsData.error) {
      console.error('Error fetching IG media:', JSON.stringify(postsData.error));
      
      // If direct media fails, try via page token as fallback
      console.log('Attempting fallback via /me/accounts page token...');
      let fallbackPosts: InstagramPost[] = [];
      
      try {
        const pagesUrl = `https://graph.facebook.com/${API_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${metaAccessToken}`;
        const pagesResponse = await fetch(pagesUrl);
        const pagesData = await pagesResponse.json();
        
        if (pagesData.data) {
          for (const page of pagesData.data) {
            if (page.instagram_business_account?.id && page.access_token) {
              const pageIgId = page.instagram_business_account.id;
              const pageToken = page.access_token;
              console.log(`Trying page token for IG ${pageIgId} from page ${page.name}`);
              
              const fallbackUrl = `https://graph.facebook.com/${API_VERSION}/${pageIgId}/media` +
                `?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp` +
                `&limit=50` +
                `&access_token=${pageToken}`;
              
              const fbResponse = await fetch(fallbackUrl);
              const fbData = await fbResponse.json();
              
              if (!fbData.error && fbData.data) {
                console.log(`Fallback succeeded: ${fbData.data.length} posts via page token`);
                fallbackPosts = fbData.data.map((post: any) => ({
                  id: post.id,
                  caption: post.caption || null,
                  media_type: post.media_type,
                  media_url: post.media_url || '',
                  thumbnail_url: post.thumbnail_url,
                  permalink: post.permalink,
                  timestamp: post.timestamp,
                  is_eligible: true,
                  ineligibility_reason: undefined,
                }));
                break;
              } else {
                console.error(`Fallback also failed for page ${page.name}:`, JSON.stringify(fbData.error));
              }
            }
          }
        }
      } catch (fbErr) {
        console.error('Fallback discovery failed:', fbErr);
      }
      
      if (fallbackPosts.length > 0) {
        return new Response(
          JSON.stringify({ instagram: fallbackPosts }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: postsData.error.message || 'Failed to fetch Instagram posts',
          meta_error_code: postsData.error.code,
          ig_user_id: igUserId,
          hint: 'Your Meta App may need the instagram_basic permission approved. Go to Meta App Dashboard > App Review > Permissions and Features > Request instagram_basic.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const posts: InstagramPost[] = (postsData.data || []).map((post: any) => ({
      id: post.id,
      caption: post.caption || null,
      media_type: post.media_type,
      media_url: post.media_url || '',
      thumbnail_url: post.thumbnail_url,
      permalink: post.permalink,
      timestamp: post.timestamp,
      is_eligible: true,
      ineligibility_reason: undefined,
    }));

    console.log(`Fetched ${posts.length} Instagram posts for ${igUsername}`);

    return new Response(
      JSON.stringify({ instagram: posts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in meta-fetch-existing-posts:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
