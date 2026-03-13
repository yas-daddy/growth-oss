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

    const body = await req.json();
    const { mediaUrl, mediaType, fileName } = body;

    if (!mediaUrl || !mediaType) {
      return new Response(
        JSON.stringify({ error: 'mediaUrl and mediaType are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Uploading ${mediaType} to Meta: ${fileName}`);

    if (mediaType === 'image') {
      // Download image and upload as Base64 bytes
      const uploadUrl = `https://graph.facebook.com/v21.0/${metaAdAccountId}/adimages`;

      const imageResponse = await fetch(mediaUrl);
      if (!imageResponse.ok) {
        return new Response(
          JSON.stringify({ error: `Failed to download image: ${imageResponse.status}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));

      const params = new URLSearchParams({
        access_token: metaAccessToken,
        bytes: base64Image,
      });
      if (fileName) {
        params.set('name', fileName);
      }

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const data = await response.json();

      if (data.error) {
        console.error('Meta API error uploading image:', data.error);
        return new Response(
          JSON.stringify({ error: data.error.message || 'Failed to upload image to Meta' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Response contains { images: { [filename]: { hash: '...', url: '...' } } }
      const images = data.images || {};
      const imageKey = Object.keys(images)[0];
      const imageData = images[imageKey];

      if (!imageData?.hash) {
        console.error('No image hash returned:', data);
        return new Response(
          JSON.stringify({ error: 'Failed to get image hash from Meta' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Image uploaded successfully. Hash: ${imageData.hash}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          type: 'image',
          hash: imageData.hash,
          url: imageData.url,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (mediaType === 'video') {
      // For videos, upload and then poll for ready status
      const initUrl = `https://graph.facebook.com/v21.0/${metaAdAccountId}/advideos`;
      
      // Get clean title from fileName (remove extension)
      const videoTitle = fileName ? fileName.replace(/\.[^/.]+$/, '') : undefined;
      
      const initParams = new URLSearchParams({
        access_token: metaAccessToken,
        file_url: mediaUrl,
      });
      
      // Add title if we have one
      if (videoTitle) {
        initParams.append('title', videoTitle);
      }

      const initResponse = await fetch(initUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: initParams.toString(),
      });

      const initData = await initResponse.json();

      if (initData.error) {
        console.error('Meta API error uploading video:', initData.error);
        return new Response(
          JSON.stringify({ error: initData.error.message || 'Failed to upload video to Meta' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!initData.id) {
        console.error('No video ID returned:', initData);
        return new Response(
          JSON.stringify({ error: 'Failed to get video ID from Meta' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const videoId = initData.id;
      console.log(`Video upload initiated. ID: ${videoId}. Waiting for processing...`);

      // Poll for video status - Meta needs time to process videos before they can be used in ads
      const maxAttempts = 30; // 30 attempts * 2 seconds = 60 seconds max wait
      const pollInterval = 2000; // 2 seconds between polls
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        const statusUrl = `https://graph.facebook.com/v21.0/${videoId}?fields=status&access_token=${metaAccessToken}`;
        const statusResponse = await fetch(statusUrl);
        const statusData = await statusResponse.json();
        
        if (statusData.error) {
          console.error('Error checking video status:', statusData.error);
          continue;
        }
        
        const videoStatus = statusData.status?.video_status;
        console.log(`Video ${videoId} status check ${attempt + 1}/${maxAttempts}: ${videoStatus}`);
        
        if (videoStatus === 'ready') {
          console.log(`Video ${videoId} is ready for use in ads`);
          return new Response(
            JSON.stringify({ 
              success: true, 
              type: 'video',
              videoId: videoId,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (videoStatus === 'error') {
          console.error('Video processing failed:', statusData);
          return new Response(
            JSON.stringify({ error: 'Video processing failed on Meta' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      // If we've exhausted all attempts, return with a warning
      console.log(`Video ${videoId} still processing after ${maxAttempts * pollInterval / 1000}s, returning anyway`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          type: 'video',
          videoId: videoId,
          warning: 'Video may still be processing. Try again in a minute if ad creation fails.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid mediaType. Must be "image" or "video"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in meta-upload-media:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
