import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateAdRequest {
  adsetIds: string[];
  adName: string;
  primaryTexts: string[]; // Now supports up to 5
  headlines: string[]; // Now supports up to 5
  description?: string;
  callToAction: string;
  destinationUrl: string;
  urlParameters?: string;
  media: Array<{
    type: 'image' | 'video';
    hash?: string;
    videoId?: string;
    fileName?: string; // Original filename for ad naming
    sourceInstagramMediaId?: string; // For existing Instagram posts
  }>;
  startPaused?: boolean;
  campaignObjective?: string; // Used to detect awareness campaigns
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

    // Get Meta credentials from environment secrets
    const metaAccessToken = Deno.env.get('META_ACCESS_TOKEN');
    const envAccountId = Deno.env.get('META_AD_ACCOUNT_ID');
    const metaPageId = Deno.env.get('META_PAGE_ID');
    const instagramActorId = Deno.env.get('META_INSTAGRAM_ACTOR_ID');

    if (!metaAccessToken || !envAccountId || !metaPageId) {
      return new Response(
        JSON.stringify({ error: 'Meta credentials not configured. Please set META_ACCESS_TOKEN, META_AD_ACCOUNT_ID, and META_PAGE_ID.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Using environment secrets for ad creation');
    let metaAdAccountId = envAccountId;

    // Ensure ad account ID has act_ prefix
    if (!metaAdAccountId.startsWith('act_')) {
      metaAdAccountId = `act_${metaAdAccountId}`;
    }

    const body: CreateAdRequest = await req.json();
    const { 
      adsetIds, 
      adName, 
      primaryTexts, 
      headlines, 
      description, 
      callToAction, 
      destinationUrl,
      urlParameters,
      media,
      startPaused = false,
      campaignObjective,
    } = body;

    // Validate - need at least one text and headline
    if (!adsetIds?.length || !adName || !primaryTexts?.length || !headlines?.length || !callToAction || !destinationUrl || !media?.length) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Creating ad "${adName}" in ${adsetIds.length} adsets with ${media.length} creative(s), ${primaryTexts.length} texts, ${headlines.length} headlines`);

    const createdAds: any[] = [];
    const errors: any[] = [];

    // Build the link with optional UTM parameters
    let link = destinationUrl;
    if (urlParameters) {
      const separator = link.includes('?') ? '&' : '?';
      link = `${link}${separator}${urlParameters}`;
    }

    // Create one ad per media item per adset
    // This ensures each video/image gets its own separate ad
    const hasMultipleTexts = primaryTexts.length > 1 || headlines.length > 1;
    
    // Awareness objectives don't support flexible ad format (creative_asset_groups_spec)
    const isAwarenessObjective = campaignObjective && 
      ['REACH', 'BRAND_AWARENESS', 'OUTCOME_AWARENESS'].includes(campaignObjective);
    
    // Only use flexible format if there are multiple texts AND it's NOT an awareness campaign
    const useFlexibleFormat = hasMultipleTexts && !isAwarenessObjective;
    
    if (hasMultipleTexts && isAwarenessObjective) {
      console.log('Skipping flexible format - not supported by awareness objectives. Using first text/headline only.');
    }
    
    for (const adsetId of adsetIds) {
      for (let mediaIndex = 0; mediaIndex < media.length; mediaIndex++) {
        try {
          const mediaItem = media[mediaIndex];
          // Use individual filename as ad name, or fall back to base adName
          const uniqueAdName = mediaItem.fileName 
            ? mediaItem.fileName.replace(/\.[^/.]+$/, '') // Remove extension
            : (media.length > 1 ? `${adName} - ${mediaIndex + 1}` : adName);
          
          // Build object_story_spec - handle existing posts vs uploaded media
          let creativePayload: any;

          if (mediaItem.sourceInstagramMediaId) {
            // Use existing Instagram post workflow
            if (!instagramActorId) {
              console.error('META_INSTAGRAM_ACTOR_ID not configured');
              errors.push({ 
                adsetId, 
                mediaIndex,
                error: 'META_INSTAGRAM_ACTOR_ID not configured for existing post ads' 
              });
              continue;
            }

            creativePayload = {
              name: `Creative - ${uniqueAdName}`,
              object_id: metaPageId,
              instagram_user_id: instagramActorId,
              source_instagram_media_id: mediaItem.sourceInstagramMediaId,
            };

            // Add call_to_action if not NO_BUTTON
            if (callToAction !== 'NO_BUTTON') {
              creativePayload.call_to_action = JSON.stringify({
                type: callToAction,
                value: { link },
              });
            }

            console.log(`Creating creative from existing Instagram post: ${mediaItem.sourceInstagramMediaId}`);
          } else {
            // Standard uploaded media workflow
            const primaryText = primaryTexts[0];
            const headline = headlines[0];
            
            let objectStorySpec: any = {
              page_id: metaPageId,
            };

            if (mediaItem.type === 'image' && mediaItem.hash) {
              objectStorySpec.link_data = {
                image_hash: mediaItem.hash,
                link: link,
                message: primaryText,
                name: headline,
                description: description || '',
                call_to_action: callToAction !== 'NO_BUTTON' ? {
                  type: callToAction,
                  value: { link },
                } : undefined,
              };
            } else if (mediaItem.type === 'video' && mediaItem.videoId) {
              // Fetch video thumbnail from Meta
              let thumbnailUrl = '';
              try {
                const videoInfoRes = await fetch(
                  `https://graph.facebook.com/v21.0/${mediaItem.videoId}?fields=thumbnails&access_token=${metaAccessToken}`
                );
                const videoInfo = await videoInfoRes.json();
                if (videoInfo.thumbnails?.data?.[0]?.uri) {
                  thumbnailUrl = videoInfo.thumbnails.data[0].uri;
                }
              } catch (e) {
                console.log('Could not fetch video thumbnail, will try without');
              }

              objectStorySpec.video_data = {
                video_id: mediaItem.videoId,
                link_description: description || '',
                message: primaryText,
                title: headline,
                call_to_action: callToAction !== 'NO_BUTTON' ? {
                  type: callToAction,
                  value: { link },
                } : undefined,
                ...(thumbnailUrl && { image_url: thumbnailUrl }),
              };
            } else {
              console.error('Invalid media item:', mediaItem);
              errors.push({ adsetId, mediaIndex, error: 'Invalid media item' });
              continue;
            }

            creativePayload = {
              name: `Creative - ${uniqueAdName}`,
              object_story_spec: objectStorySpec,
            };
          }

          const creativeUrl = `https://graph.facebook.com/v21.0/${metaAdAccountId}/adcreatives`;
          const creativeParams = new URLSearchParams({
            access_token: metaAccessToken,
          });
          
          // Add each payload field separately for proper encoding
          for (const [key, value] of Object.entries(creativePayload)) {
            creativeParams.set(key, typeof value === 'string' ? value : JSON.stringify(value));
          }

          const creativeResponse = await fetch(creativeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: creativeParams.toString(),
          });

          const creativeData = await creativeResponse.json();

          if (creativeData.error) {
            console.error('Error creating creative:', creativeData.error);
            errors.push({ 
              adsetId, 
              mediaIndex,
              error: creativeData.error.message || 'Failed to create creative' 
            });
            continue;
          }

          const creativeId = creativeData.id;
          console.log(`Created creative ${creativeId} for adset ${adsetId}, media ${mediaIndex + 1}`);

          // Create Ad - use creative_asset_groups_spec for multiple text variations
          const adUrl = `https://graph.facebook.com/v21.0/${metaAdAccountId}/ads`;
          const adParams = new URLSearchParams({
            access_token: metaAccessToken,
            name: uniqueAdName,
            adset_id: adsetId,
            creative: JSON.stringify({ creative_id: creativeId }),
            status: startPaused ? 'PAUSED' : 'ACTIVE',
          });

          // Add creative_asset_groups_spec for multiple text variations (Flexible Ad Format)
          // This allows up to 5 texts per type in standard ad sets
          // Note: Awareness campaigns (REACH, BRAND_AWARENESS) don't support this feature
          if (useFlexibleFormat) {
            const texts: Array<{ text: string; text_type: string }> = [];
            
            // Add primary texts (up to 5)
            for (const text of primaryTexts.slice(0, 5)) {
              texts.push({ text, text_type: 'primary_text' });
            }
            
            // Add headlines (up to 5)
            for (const text of headlines.slice(0, 5)) {
              texts.push({ text, text_type: 'headline' });
            }
            
            // Add description if provided
            if (description) {
              texts.push({ text: description, text_type: 'description' });
            }

            const creativeAssetGroupsSpec: any = {
              groups: [{
                texts,
                ...(callToAction !== 'NO_BUTTON' && {
                  call_to_action: {
                    type: callToAction,
                    value: { link },
                  },
                }),
              }],
            };

            // Add media to the group
            if (mediaItem.type === 'image' && mediaItem.hash) {
              creativeAssetGroupsSpec.groups[0].images = [{ hash: mediaItem.hash }];
            } else if (mediaItem.type === 'video' && mediaItem.videoId) {
              creativeAssetGroupsSpec.groups[0].videos = [{ video_id: mediaItem.videoId }];
            }

            adParams.set('creative_asset_groups_spec', JSON.stringify(creativeAssetGroupsSpec));
            console.log('Using creative_asset_groups_spec for multiple text variations');
          }

          const adResponse = await fetch(adUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: adParams.toString(),
          });

          const adData = await adResponse.json();

          if (adData.error) {
            console.error('Error creating ad:', adData.error);
            errors.push({ 
              adsetId, 
              mediaIndex,
              creativeId,
              error: adData.error.message || 'Failed to create ad' 
            });
            continue;
          }

          console.log(`Created ad ${adData.id} in adset ${adsetId} for media ${mediaIndex + 1}`);
          createdAds.push({
            adId: adData.id,
            creativeId,
            adsetId,
            name: uniqueAdName,
            mediaIndex,
          });

        } catch (err) {
          console.error('Error processing ad:', err);
          errors.push({ 
            adsetId,
            mediaIndex, 
            error: err instanceof Error ? err.message : 'Unknown error' 
          });
        }
      }
    }

    const summary = {
      totalCreated: createdAds.length,
      totalErrors: errors.length,
      ads: createdAds,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log('Ad creation complete:', summary);

    return new Response(
      JSON.stringify({ 
        success: createdAds.length > 0, 
        summary,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in meta-create-ad:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
