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

    // Helper to paginate through Meta API results
    async function fetchAllPages(baseUrl: string, limit = 100): Promise<any[]> {
      const allData: any[] = [];
      let url = `${baseUrl}&limit=${limit}&access_token=${metaAccessToken}`;
      
      while (url && allData.length < 500) { // Cap at 500 to prevent excessive calls
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
          console.error('Meta API error:', data.error);
          break;
        }
        
        if (data.data) {
          allData.push(...data.data);
        }
        
        // Check for next page
        url = data.paging?.next || null;
      }
      
      return allData;
    }

    // Fetch all videos from Meta (with pagination)
    const videosData = await fetchAllPages(
      `https://graph.facebook.com/v21.0/${metaAdAccountId}/advideos?fields=id,title,thumbnail_url,created_time,length`
    );

    // Fetch all images from Meta (with pagination)
    const imagesData = await fetchAllPages(
      `https://graph.facebook.com/v21.0/${metaAdAccountId}/adimages?fields=hash,name,url,created_time`
    );

    // Fetch files from Supabase bucket
    const { data: bucketFiles, error: bucketError } = await supabaseAdmin
      .storage
      .from('ad-media')
      .list('', { limit: 500, sortBy: { column: 'created_at', order: 'desc' } });

    const bucketMedia = bucketFiles?.map(file => {
      const { data: urlData } = supabaseAdmin.storage.from('ad-media').getPublicUrl(file.name);
      return {
        id: file.id,
        name: file.name,
        url: urlData.publicUrl,
        type: file.metadata?.mimetype?.startsWith('video/') ? 'video' : 'image',
        source: 'bucket',
        created_at: file.created_at,
      };
    }) || [];

    const metaVideos = videosData.map((vid: any) => ({
      id: vid.id,
      videoId: vid.id,
      name: vid.title || 'Untitled',
      url: vid.thumbnail_url,
      type: 'video',
      source: 'meta',
      duration: vid.length,
      created_at: vid.created_time,
    }));

    // Filter out auto-generated video thumbnails from images
    // These have patterns like: "123456789_123456789_123456789_n.jpg" or similar numeric patterns
    // Real uploaded images usually have meaningful names with file extensions
    const videoThumbnailPattern = /^\d+_\d+(_\d+)*(_[a-z])?(\.\w+)?$/i; // Pattern: numbers_numbers[_numbers...]_letter.ext
    
    const metaImages = imagesData
      .filter((img: any) => {
        const name = img.name || '';
        // Filter out images that look like auto-generated video thumbnails
        if (videoThumbnailPattern.test(name)) return false;
        // Filter out pure numeric names (likely auto-generated)
        if (/^\d+$/.test(name)) return false;
        // Also filter out images with no name
        if (!name) return false;
        return true;
      })
      .map((img: any) => ({
        id: img.hash,
        hash: img.hash,
        name: img.name,
        url: img.url,
        type: 'image',
        source: 'meta',
        created_at: img.created_time,
      }));

    // Sort by created_at descending (most recent first)
    const sortByDate = (a: any, b: any) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    };
    
    metaImages.sort(sortByDate);
    metaVideos.sort(sortByDate);

    console.log(`Found ${metaImages.length} Meta images (filtered), ${metaVideos.length} Meta videos, ${bucketMedia.length} bucket files`);

    return new Response(
      JSON.stringify({
        bucket: bucketMedia,
        meta: {
          images: metaImages,
          videos: metaVideos,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in meta-list-media:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
