import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    exp: now + 20 * 60,
    aud: "appstoreconnect-v1",
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signingInput = `${headerB64}.${payloadB64}`;

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

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    encoder.encode(signingInput)
  );

  const signatureArray = new Uint8Array(signature);
  const signatureB64 = btoa(String.fromCharCode(...signatureArray))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${signingInput}.${signatureB64}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting App Store review response...");

    const { reviewId, responseText } = await req.json();

    if (!reviewId || !responseText) {
      return new Response(
        JSON.stringify({ error: "Missing reviewId or responseText" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const keyId = Deno.env.get("APP_STORE_KEY_ID");
    const issuerId = Deno.env.get("APP_STORE_ISSUER_ID");
    const privateKey = Deno.env.get("APP_STORE_PRIVATE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!keyId || !issuerId || !privateKey) {
      return new Response(
        JSON.stringify({ error: "Missing App Store Connect credentials" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate - support both user tokens and service role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    
    // Check if this is the service role key (used by auto-respond-reviews)
    const isServiceRole = token === supabaseServiceKey;
    
    if (!isServiceRole) {
      // Validate user token
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Invalid authentication" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    console.log(`Authenticated via ${isServiceRole ? 'service role' : 'user token'}`);

    // Get the review from database to get the actual Apple review ID
    const { data: review, error: reviewError } = await supabaseClient
      .from("app_store_reviews")
      .select("review_id")
      .eq("id", reviewId)
      .maybeSingle();

    if (reviewError || !review) {
      console.error("Review not found:", reviewError);
      return new Response(
        JSON.stringify({ error: "Review not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jwt = await generateAppStoreJWT(keyId, issuerId, privateKey);
    console.log("Generated App Store Connect JWT");

    // Create response via App Store Connect API
    const apiUrl = "https://api.appstoreconnect.apple.com/v1/customerReviewResponses";
    
    const response: Response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          type: "customerReviewResponses",
          attributes: {
            responseBody: responseText,
          },
          relationships: {
            review: {
              data: {
                type: "customerReviews",
                id: review.review_id,
              },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`App Store API error: ${response.status} - ${errorText}`);
      
      // Check if review was deleted (404 NOT_FOUND)
      if (response.status === 404) {
        try {
          const errorData = JSON.parse(errorText);
          // Apple returns errors array with NOT_FOUND status
          const notFoundError = errorData.errors?.find((e: any) => 
            e.status === "404" || e.code === "NOT_FOUND" || e.title?.includes("not found")
          );
          if (notFoundError || errorText.includes("not found")) {
            console.log(`Review ${review.review_id} has been deleted on App Store`);
            return new Response(
              JSON.stringify({ 
                error: "Review has been deleted from App Store", 
                isReviewDeleted: true,
                reviewId 
              }),
              { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } catch {
          // JSON parse failed, continue with generic error
        }
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to submit response", details: errorText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const responseData: { data?: { id?: string } } = await response.json();
    console.log("Response submitted successfully:", responseData);

    // Update the review in database with the response
    const { error: updateError } = await supabaseClient
      .from("app_store_reviews")
      .update({
        response_text: responseText,
        response_id: responseData.data?.id || null,
        responded_at: new Date().toISOString(),
      })
      .eq("id", reviewId);

    if (updateError) {
      console.error("Failed to update review record:", updateError);
    }

    return new Response(
      JSON.stringify({ success: true, responseId: responseData.data?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error responding to review:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
