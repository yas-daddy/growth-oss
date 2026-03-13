import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startSyncLog, completeSyncLog } from "../_shared/sync-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate JWT for App Store Connect API
async function generateAppStoreJWT(
  keyId: string,
  issuerId: string,
  privateKey: string
): Promise<string> {
  const header = {
    alg: "ES256",
    kid: keyId,
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + 20 * 60, // 20 minutes
    aud: "appstoreconnect-v1",
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import the private key
  const pemContents = privateKey
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  // Sign the JWT
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    encoder.encode(signingInput)
  );

  // Convert signature from DER to raw format for JWT
  const signatureArray = new Uint8Array(signature);
  const signatureB64 = btoa(String.fromCharCode(...signatureArray))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${signingInput}.${signatureB64}`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const syncLog = await startSyncLog('app-store-sync');
  
  try {
    console.log("Starting App Store reviews sync...");

    // Get environment variables
    const keyId = Deno.env.get("APP_STORE_KEY_ID");
    const issuerId = Deno.env.get("APP_STORE_ISSUER_ID");
    const privateKey = Deno.env.get("APP_STORE_PRIVATE_KEY");
    const appId = Deno.env.get("APP_STORE_APP_ID");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!keyId || !issuerId || !privateKey || !appId) {
      console.error("Missing App Store Connect credentials");
      await completeSyncLog(syncLog?.id || null, false, 'Missing App Store Connect credentials');
      return new Response(
        JSON.stringify({ error: "Missing App Store Connect credentials" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase credentials");
      await completeSyncLog(syncLog?.id || null, false, 'Missing Supabase credentials');
      return new Response(
        JSON.stringify({ error: "Missing Supabase credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      await completeSyncLog(syncLog?.id || null, false, 'Missing authorization header');
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Try to get user from auth header, or fall back to admin user for service role calls
    let userId: string;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    
    if (user) {
      // Verify user has admin role
      const { data: userRole } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!userRole) {
        return new Response(
          JSON.stringify({ error: 'Admin access required to sync data' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = user.id;
    } else {
      const { data: adminRole } = await supabaseClient.from('user_roles').select('user_id').eq('role', 'admin').limit(1).maybeSingle();
      if (!adminRole) {
        return new Response(JSON.stringify({ error: 'No admin user found' }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userId = adminRole.user_id;
      console.log(`Service role sync using admin user: ${userId}`);
    }

    console.log(`Authenticated user: ${userId}`);

    // Generate JWT for App Store Connect API
    const jwt = await generateAppStoreJWT(keyId, issuerId, privateKey);
    console.log("Generated App Store Connect JWT");

    // Fetch all customer reviews with pagination
    const allReviews: any[] = [];
    let currentUrl: string | null = `https://api.appstoreconnect.apple.com/v1/apps/${appId}/customerReviews?sort=-createdDate&limit=200`;
    let currentJwt = jwt;
    
    while (currentUrl) {
      console.log(`Fetching reviews from: ${currentUrl}`);

      const response: Response = await fetch(currentUrl, {
        headers: {
          Authorization: `Bearer ${currentJwt}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`App Store API error: ${response.status} - ${errorText}`);
        return new Response(
          JSON.stringify({ 
            error: "Failed to fetch App Store reviews", 
            details: errorText,
            status: response.status 
          }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data: { data?: any[]; links?: { next?: string } } = await response.json();
      const pageReviews = data.data || [];
      allReviews.push(...pageReviews);
      console.log(`Fetched ${pageReviews.length} reviews, total so far: ${allReviews.length}`);

      // Check for next page
      currentUrl = data.links?.next || null;
      
      // Regenerate JWT if we have many pages (to avoid expiration)
      if (currentUrl && allReviews.length % 1000 === 0) {
        currentJwt = await generateAppStoreJWT(keyId, issuerId, privateKey);
        console.log("Regenerated JWT for continued pagination");
      }
    }

    console.log(`Total reviews fetched: ${allReviews.length}`);

    // Transform and upsert reviews (including those without text - just ratings)
    const reviews = allReviews.map((review: any) => ({
      review_id: review.id,
      user_id: userId,
      stars: review.attributes.rating,
      title: review.attributes.title || null,
      text: review.attributes.body || null,
      author_name: review.attributes.reviewerNickname || null,
      app_version: null,
      territory: review.attributes.territory || null,
      created_at: review.attributes.createdDate,
      updated_at: null,
      synced_at: new Date().toISOString(),
    }));

    if (reviews.length > 0) {
      // Batch upsert reviews
      const batchSize = 50;
      let totalUpserted = 0;

      for (let i = 0; i < reviews.length; i += batchSize) {
        const batch = reviews.slice(i, i + batchSize);
        const { error: upsertError } = await supabaseClient
          .from("app_store_reviews")
          .upsert(batch, { onConflict: "review_id" });

        if (upsertError) {
          console.error(`Upsert error for batch ${i}:`, upsertError);
          throw upsertError;
        }
        totalUpserted += batch.length;
        console.log(`Upserted batch ${i / batchSize + 1}, total: ${totalUpserted}`);
      }
    }

    console.log("App Store sync completed successfully");
    await completeSyncLog(syncLog?.id || null, true);

    return new Response(
      JSON.stringify({
        success: true,
        reviewsCount: reviews.length,
        message: `Successfully synced ${reviews.length} App Store reviews`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in App Store sync:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    await completeSyncLog(syncLog?.id || null, false, errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
