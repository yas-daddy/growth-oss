import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startSyncLog, completeSyncLog } from "../_shared/sync-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GooglePlayReview {
  reviewId: string;
  authorName: string;
  comments: {
    userComment?: {
      text: string;
      lastModified: { seconds: string };
      starRating: number;
      reviewerLanguage: string;
      device: string;
      androidOsVersion: number;
      appVersionCode: number;
      appVersionName: string;
      thumbsUpCount: number;
      deviceMetadata?: {
        productName: string;
        manufacturer: string;
      };
    };
    developerComment?: {
      text: string;
      lastModified: { seconds: string };
    };
  }[];
}

interface GooglePlayReviewsResponse {
  reviews?: GooglePlayReview[];
  tokenPagination?: {
    nextPageToken: string;
  };
}

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const serviceAccount = JSON.parse(serviceAccountJson);
  
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  // Create JWT
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import the private key
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = serviceAccount.private_key
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Sign the JWT
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsignedToken}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function fetchAllReviews(
  accessToken: string,
  packageName: string
): Promise<GooglePlayReview[]> {
  const allReviews: GooglePlayReview[] = [];
  let nextPageToken: string | undefined;

  do {
    const url = new URL(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/reviews`
    );
    if (nextPageToken) {
      url.searchParams.set("token", nextPageToken);
    }
    url.searchParams.set("maxResults", "100");

    console.log(`Fetching reviews from: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Google Play API error: ${response.status} - ${errorText}`);
      throw new Error(`Google Play API error: ${response.status} - ${errorText}`);
    }

    const data: GooglePlayReviewsResponse = await response.json();
    
    if (data.reviews) {
      allReviews.push(...data.reviews);
    }

    nextPageToken = data.tokenPagination?.nextPageToken;
    console.log(`Fetched ${allReviews.length} reviews so far...`);
  } while (nextPageToken);

  console.log(`Total reviews fetched: ${allReviews.length}`);
  return allReviews;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const syncLog = await startSyncLog('google-play-sync');
  
  try {
    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      await completeSyncLog(syncLog?.id || null, false, 'No authorization header');
      throw new Error("No authorization header");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user or use admin for service role
    let userId: string;
    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabaseClient.auth.getUser();
    
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
      const { data: adminRole } = await supabase.from('user_roles').select('user_id').eq('role', 'admin').limit(1).maybeSingle();
      if (!adminRole) throw new Error("No admin user found");
      userId = adminRole.user_id;
      console.log(`Service role sync using admin user: ${userId}`);
    }

    console.log(`Starting Google Play sync for user: ${userId}`);

    // Get secrets
    const serviceAccountJson = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");
    const packageName = Deno.env.get("GOOGLE_PLAY_PACKAGE_NAME");

    if (!serviceAccountJson) {
      throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON not configured");
    }
    if (!packageName) {
      throw new Error("GOOGLE_PLAY_PACKAGE_NAME not configured");
    }

    // Get access token
    console.log("Getting access token...");
    const accessToken = await getAccessToken(serviceAccountJson);

    // Fetch all reviews
    const reviews = await fetchAllReviews(accessToken, packageName);
    console.log(`Received ${reviews.length} reviews`);

    // Transform and upsert reviews
    const syncedAt = new Date().toISOString();
    let upsertedCount = 0;

    for (let i = 0; i < reviews.length; i += 100) {
      const batch = reviews.slice(i, i + 100).map((review) => {
        const userComment = review.comments?.find(c => c.userComment)?.userComment;
        const developerComment = review.comments?.find(c => c.developerComment)?.developerComment;

        return {
          user_id: userId,
          review_id: review.reviewId,
          author_name: review.authorName || null,
          stars: userComment?.starRating || 0,
          text: userComment?.text || null,
          title: null, // Google Play doesn't have titles
          language: userComment?.reviewerLanguage || null,
          device: userComment?.deviceMetadata?.productName || null,
          app_version_code: userComment?.appVersionCode?.toString() || null,
          app_version_name: userComment?.appVersionName || null,
          thumbs_up_count: userComment?.thumbsUpCount || 0,
          review_created_at: userComment?.lastModified?.seconds 
            ? new Date(parseInt(userComment.lastModified.seconds) * 1000).toISOString()
            : syncedAt,
          review_updated_at: userComment?.lastModified?.seconds
            ? new Date(parseInt(userComment.lastModified.seconds) * 1000).toISOString()
            : null,
          developer_reply_text: developerComment?.text || null,
          developer_reply_at: developerComment?.lastModified?.seconds
            ? new Date(parseInt(developerComment.lastModified.seconds) * 1000).toISOString()
            : null,
          synced_at: syncedAt,
        };
      });

      const { error: upsertError } = await supabase
        .from("google_play_reviews")
        .upsert(batch, { onConflict: "review_id" });

      if (upsertError) {
        console.error(`Error upserting batch: ${upsertError.message}`);
        throw upsertError;
      }

      upsertedCount += batch.length;
      console.log(`Upserted ${upsertedCount}/${reviews.length} reviews`);
    }

    // Calculate stats
    const starDistribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    let totalStars = 0;

    reviews.forEach((review) => {
      const userComment = review.comments?.find(c => c.userComment)?.userComment;
      const stars = userComment?.starRating || 0;
      if (stars >= 1 && stars <= 5) {
        starDistribution[stars.toString()]++;
        totalStars += stars;
      }
    });

    const result = {
      totalReviews: reviews.length,
      averageRating: reviews.length > 0 ? Math.round((totalStars / reviews.length) * 10) / 10 : 0,
      starDistribution,
      syncedAt,
    };

    console.log(`Sync complete: ${JSON.stringify(result)}`);
    await completeSyncLog(syncLog?.id || null, true);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Error syncing Google Play reviews: ${errorMessage}`);
    await completeSyncLog(syncLog?.id || null, false, errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});