import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { startSyncLog, completeSyncLog } from "../_shared/sync-logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ReviewToProcess {
  id: string;
  review_id: string;
  platform: string;
  stars: number;
  title: string | null;
  text: string | null;
  author: string | null;
}

interface AutoResponseSettings {
  platform: string;
  enabled: boolean;
  auto_post_threshold: number;
}

interface PostResponseResult {
  success: boolean;
  reviewDeleted?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const syncLog = await startSyncLog('auto-respond-reviews');
  
  try {
    console.log('Starting auto-respond-reviews process...');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get automation settings
    const { data: settings, error: settingsError } = await supabase
      .from('auto_response_settings')
      .select('*');

    if (settingsError) {
      throw new Error(`Failed to fetch settings: ${settingsError.message}`);
    }

    // Get custom AI prompt from review_settings (first available org setting)
    const { data: reviewSettings } = await supabase
      .from('review_settings')
      .select('ai_prompt')
      .limit(1)
      .maybeSingle();

    const customPrompt = reviewSettings?.ai_prompt || 
      "You are a professional customer service representative. Generate a helpful, empathetic, and professional response to the following customer review. Keep the response concise (2-3 sentences) and address any specific concerns mentioned. Be genuine and avoid generic responses.";
    
    console.log(`Using custom AI prompt: ${customPrompt.substring(0, 100)}...`);

    const enabledPlatforms = (settings as AutoResponseSettings[]).filter(s => s.enabled);
    
    if (enabledPlatforms.length === 0) {
      console.log('No platforms have auto-response enabled. Exiting.');
      return new Response(
        JSON.stringify({ success: true, message: 'No platforms enabled', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Enabled platforms: ${enabledPlatforms.map(p => p.platform).join(', ')}`);

    const results = {
      processed: 0,
      autoPosted: 0,
      queued: 0,
      errors: 0,
    };

    // Process each enabled platform
    for (const platformSettings of enabledPlatforms) {
      const { platform, auto_post_threshold } = platformSettings;
      console.log(`Processing ${platform} with threshold ${auto_post_threshold}...`);

      // Get unresponded reviews for this platform
      const reviews = await getUnrespondedReviews(supabase, platform);
      console.log(`Found ${reviews.length} unresponded reviews for ${platform}`);

      for (const review of reviews) {
        try {
          // Check if already in pending queue
          const { data: existingPending } = await supabase
            .from('pending_responses')
            .select('id')
            .eq('platform', platform)
            .eq('review_id', review.review_id)
            .eq('status', 'pending')
            .single();

          if (existingPending) {
            console.log(`Review ${review.review_id} already in pending queue, skipping`);
            continue;
          }

          // Generate AI response using custom prompt
          const aiResponse = await generateAIResponse(review, customPrompt);
          
          if (!aiResponse) {
            console.log(`Failed to generate AI response for ${review.review_id}`);
            results.errors++;
            continue;
          }

          // Decide: auto-post or queue
          if (review.stars >= auto_post_threshold) {
            // Auto-post for high-rated reviews
            console.log(`Auto-posting response for ${review.stars}-star review ${review.review_id}`);
            const postResult = await postResponse(supabase, platform, review, aiResponse);
            
            if (postResult.success) {
              results.autoPosted++;
              // Log to pending_responses as auto-posted
              await supabase.from('pending_responses').insert({
                platform,
                review_id: review.review_id,
                review_db_id: review.id,
                review_stars: review.stars,
                review_title: review.title,
                review_text: review.text,
                review_author: review.author,
                ai_response: aiResponse,
                status: 'auto_posted',
                posted_at: new Date().toISOString(),
              });
            } else if (postResult.reviewDeleted) {
              // Review was deleted, already cleaned up - just log it
              console.log(`Review ${review.review_id} was deleted, skipping`);
            } else {
              results.errors++;
            }
          } else {
            // Queue for manual review
            console.log(`Queuing response for ${review.stars}-star review ${review.review_id}`);
            await supabase.from('pending_responses').insert({
              platform,
              review_id: review.review_id,
              review_db_id: review.id,
              review_stars: review.stars,
              review_title: review.title,
              review_text: review.text,
              review_author: review.author,
              ai_response: aiResponse,
              status: 'pending',
            });
            results.queued++;
          }

          results.processed++;
        } catch (reviewError) {
          console.error(`Error processing review ${review.review_id}:`, reviewError);
          results.errors++;
        }
      }
    }

    console.log('Auto-respond completed:', results);
    await completeSyncLog(syncLog?.id || null, true);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Auto-respond error:', error);
    await completeSyncLog(syncLog?.id || null, false, errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function getUnrespondedReviews(supabase: any, platform: string): Promise<ReviewToProcess[]> {
  const reviews: ReviewToProcess[] = [];
  
  // Calculate 7 days ago
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoffDate = sevenDaysAgo.toISOString();
  
  // Get rejected review IDs to exclude
  const { data: rejectedResponses } = await supabase
    .from('pending_responses')
    .select('review_db_id')
    .eq('platform', platform)
    .not('rejected_at', 'is', null);
  
  const rejectedIds = new Set((rejectedResponses || []).map((r: { review_db_id: string }) => r.review_db_id));
  console.log(`Found ${rejectedIds.size} rejected reviews to exclude for ${platform}`);

  if (platform === 'App Store') {
    const { data, error } = await supabase
      .from('app_store_reviews')
      .select('id, review_id, stars, title, text, author_name')
      .is('response_text', null)
      .gte('created_at', cutoffDate)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      reviews.push(...data
        .filter((r: any) => !rejectedIds.has(r.id))
        .map((r: any) => ({
          id: r.id,
          review_id: r.review_id,
          platform: 'App Store',
          stars: r.stars,
          title: r.title,
          text: r.text,
          author: r.author_name,
        })));
    }
  } else if (platform === 'Google Play') {
    const { data, error } = await supabase
      .from('google_play_reviews')
      .select('id, review_id, stars, title, text, author_name')
      .is('response_text', null)
      .gte('review_created_at', cutoffDate)
      .order('review_created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      reviews.push(...data
        .filter((r: any) => !rejectedIds.has(r.id))
        .map((r: any) => ({
          id: r.id,
          review_id: r.review_id,
          platform: 'Google Play',
          stars: r.stars,
          title: r.title,
          text: r.text,
          author: r.author_name,
        })));
    }
  } else if (platform === 'Trustpilot') {
    const { data, error } = await supabase
      .from('trustpilot_reviews')
      .select('id, review_id, stars, title, text, consumer_display_name')
      .is('response_text', null)
      .gte('created_at', cutoffDate)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      reviews.push(...data
        .filter((r: any) => !rejectedIds.has(r.id))
        .map((r: any) => ({
          id: r.id,
          review_id: r.review_id,
          platform: 'Trustpilot',
          stars: r.stars,
          title: r.title,
          text: r.text,
          author: r.consumer_display_name,
        })));
    }
  }

  console.log(`Returning ${reviews.length} reviews for ${platform} (after filtering rejected and old reviews)`);
  return reviews;
}

async function generateAIResponse(review: ReviewToProcess, customPrompt: string): Promise<string | null> {
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return null;
    }

    // Platform-specific character limits
    const getCharLimit = (platform: string): number => {
      if (platform === 'Google Play') return 340;
      if (platform === 'App Store') return 5900;
      return 4000; // Trustpilot
    };
    
    const charLimit = getCharLimit(review.platform);
    
    // Use custom prompt with platform-specific character limit instructions
    const systemPrompt = review.platform === 'Google Play' 
      ? `${customPrompt}\n\nCRITICAL: Google Play has a strict 350 CHARACTER limit (not words). Write a VERY SHORT response - maximum 2-3 brief sentences. Count your characters carefully.`
      : `${customPrompt}\n\nKeep your response concise and under ${charLimit} characters.`;

    const reviewContext = `
Platform: ${review.platform}
Rating: ${review.stars}/5 stars
${review.title ? `Title: ${review.title}` : ''}
Review: ${review.text || '(No text provided)'}
Author: ${review.author || 'Anonymous'}
`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate a response for this review:\n${reviewContext}` },
        ],
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      console.error('AI API error:', await response.text());
      return null;
    }

    const data = await response.json();
    let suggestion = data.choices?.[0]?.message?.content || '';
    
    // Truncate if over limit
    if (suggestion.length > charLimit) {
      const truncated = suggestion.substring(0, charLimit);
      const lastPeriod = truncated.lastIndexOf('.');
      const lastExclaim = truncated.lastIndexOf('!');
      const lastBreak = Math.max(lastPeriod, lastExclaim);
      suggestion = lastBreak > charLimit * 0.5 ? truncated.substring(0, lastBreak + 1) : truncated.trim();
    }

    return suggestion;
  } catch (error) {
    console.error('Error generating AI response:', error);
    return null;
  }
}

async function postResponse(supabase: any, platform: string, review: ReviewToProcess, responseText: string): Promise<PostResponseResult> {
  try {
    let response: Response;
    
    if (platform === 'App Store') {
      response = await fetch(`${SUPABASE_URL}/functions/v1/app-store-respond`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reviewId: review.id, responseText }),
      });
    } else if (platform === 'Google Play') {
      response = await fetch(`${SUPABASE_URL}/functions/v1/google-play-respond`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reviewId: review.id, responseText }),
      });
    } else if (platform === 'Trustpilot') {
      response = await fetch(`${SUPABASE_URL}/functions/v1/trustpilot-respond`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reviewId: review.id, responseText }),
      });
    } else {
      console.error(`Unknown platform: ${platform}`);
      return { success: false };
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to post to ${platform} (${response.status}): ${errorText}`);
      
      // Check for deleted review (HTTP 410 Gone)
      if (response.status === 410) {
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.isReviewDeleted) {
            console.log(`Review ${review.review_id} was deleted on ${platform}, cleaning up...`);
            await cleanupDeletedReview(supabase, platform, review.id);
            return { success: false, reviewDeleted: true };
          }
        } catch {
          // JSON parse failed
        }
      }
      
      return { success: false };
    }
    
    console.log(`Successfully posted response to ${platform} for review ${review.review_id}`);
    return { success: true };
  } catch (error) {
    console.error(`Error posting to ${platform}:`, error);
    return { success: false };
  }
}

async function cleanupDeletedReview(supabase: any, platform: string, reviewDbId: string): Promise<void> {
  try {
    // Delete from the appropriate reviews table
    let tableName = '';
    if (platform === 'App Store') {
      tableName = 'app_store_reviews';
    } else if (platform === 'Google Play') {
      tableName = 'google_play_reviews';
    } else if (platform === 'Trustpilot') {
      tableName = 'trustpilot_reviews';
    }
    
    if (tableName) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', reviewDbId);
      
      if (error) {
        console.error(`Failed to delete review from ${tableName}:`, error);
      } else {
        console.log(`Deleted review ${reviewDbId} from ${tableName}`);
      }
    }
    
    // Also mark any pending responses as review_deleted
    await supabase
      .from('pending_responses')
      .update({ 
        status: 'review_deleted',
        reviewed_at: new Date().toISOString()
      })
      .eq('review_db_id', reviewDbId);
      
  } catch (error) {
    console.error(`Error cleaning up deleted review:`, error);
  }
}
