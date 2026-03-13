import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startSyncLog, completeSyncLog } from "../_shared/sync-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TrustpilotReview {
  id: string;
  stars: number;
  title: string;
  text: string;
  language: string;
  createdAt: string;
  updatedAt?: string;
  isVerified: boolean;
  consumer: {
    displayName: string;
    countryCode?: string;
  };
}

interface TrustpilotResponse {
  reviews: TrustpilotReview[];
  links: Array<{
    rel: string;
    href: string;
  }>;
}

async function fetchAllReviews(apiKey: string, businessUnitId: string): Promise<TrustpilotReview[]> {
  const allReviews: TrustpilotReview[] = [];
  let nextPageUrl: string | null = `https://api.trustpilot.com/v1/business-units/${businessUnitId}/all-reviews?perPage=100`;
  
  while (nextPageUrl) {
    console.log(`Fetching reviews from: ${nextPageUrl}`);
    
    const response = await fetch(nextPageUrl, {
      headers: {
        "apikey": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Trustpilot API error: ${response.status} - ${errorText}`);
      throw new Error(`Trustpilot API error: ${response.status} - ${errorText}`);
    }

    const data: TrustpilotResponse = await response.json();
    console.log(`Received ${data.reviews.length} reviews`);
    
    allReviews.push(...data.reviews);
    
    // Find next page link
    const nextLink = data.links?.find(link => link.rel === "next-page");
    nextPageUrl = nextLink?.href || null;
    
    // Add small delay to avoid rate limiting
    if (nextPageUrl) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return allReviews;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const syncLog = await startSyncLog('trustpilot-sync');
  
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      await completeSyncLog(syncLog?.id || null, false, 'Missing authorization header');
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const trustpilotApiKey = Deno.env.get("TRUSTPILOT_API_KEY");
    const businessUnitId = Deno.env.get("TRUSTPILOT_BUSINESS_UNIT_ID");

    if (!trustpilotApiKey || !businessUnitId) {
      await completeSyncLog(syncLog?.id || null, false, 'Missing Trustpilot API credentials');
      throw new Error("Missing Trustpilot API credentials");
    }

    // Use service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Try to get user from auth header, or fall back to admin user for service role calls
    let userId: string;
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (user) {
      // Verify user has admin role
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!userRole) {
        throw new Error('Admin access required to sync data');
      }
      userId = user.id;
    } else {
      // Service role call - get first admin user
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle();
      
      if (!adminRole) {
        throw new Error('No admin user found for service role sync');
      }
      userId = adminRole.user_id;
      console.log(`Service role sync using admin user: ${userId}`);
    }

    console.log(`Starting Trustpilot sync for user: ${userId}`);

    // Use service role client for database operations
    // supabase already created above

    // Fetch all reviews from Trustpilot
    const reviews = await fetchAllReviews(trustpilotApiKey, businessUnitId);
    console.log(`Total reviews fetched: ${reviews.length}`);

    // Transform and upsert reviews
    const reviewRecords = reviews.map(review => ({
      user_id: userId,
      review_id: review.id,
      stars: review.stars,
      title: review.title || null,
      text: review.text || null,
      language: review.language || null,
      consumer_display_name: review.consumer?.displayName || null,
      consumer_country_code: review.consumer?.countryCode || null,
      created_at: review.createdAt,
      updated_at: review.updatedAt || null,
      is_verified: review.isVerified || false,
      synced_at: new Date().toISOString(),
    }));

    // Upsert in batches
    const batchSize = 100;
    let upsertedCount = 0;
    
    for (let i = 0; i < reviewRecords.length; i += batchSize) {
      const batch = reviewRecords.slice(i, i + batchSize);
      const { error: upsertError } = await supabase
        .from("trustpilot_reviews")
        .upsert(batch, { onConflict: "review_id" });

      if (upsertError) {
        console.error(`Error upserting batch: ${upsertError.message}`);
        throw upsertError;
      }
      
      upsertedCount += batch.length;
      console.log(`Upserted ${upsertedCount}/${reviewRecords.length} reviews`);
    }

    // Calculate stats
    const starCounts = reviews.reduce((acc, r) => {
      acc[r.stars] = (acc[r.stars] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const avgRating = reviews.length > 0 
      ? reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length 
      : 0;

    const result = {
      totalReviews: reviews.length,
      averageRating: Math.round(avgRating * 10) / 10,
      starDistribution: starCounts,
      syncedAt: new Date().toISOString(),
    };

    console.log(`Sync complete:`, result);
    await completeSyncLog(syncLog?.id || null, true);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Error syncing Trustpilot reviews: ${errorMessage}`);
    await completeSyncLog(syncLog?.id || null, false, errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: errorMessage === "Unauthorized" ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
