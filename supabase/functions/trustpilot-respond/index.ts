import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get OAuth access token for Trustpilot private API
async function getAccessToken(apiKey: string, apiSecret: string): Promise<string> {
  const credentials = btoa(`${apiKey}:${apiSecret}`);
  
  const response = await fetch("https://api.trustpilot.com/v1/oauth/oauth-business-users-for-applications/accesstoken", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`OAuth error: ${response.status} - ${errorText}`);
    throw new Error(`Failed to get access token: ${errorText}`);
  }

  const data: { access_token: string } = await response.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting Trustpilot review response...");

    const { reviewId, responseText } = await req.json();

    if (!reviewId || !responseText) {
      return new Response(
        JSON.stringify({ error: "Missing reviewId or responseText" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("TRUSTPILOT_API_KEY");
    const apiSecret = Deno.env.get("TRUSTPILOT_API_SECRET");
    const businessUserId = Deno.env.get("TRUSTPILOT_BUSINESS_USER_ID");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!apiKey || !apiSecret || !businessUserId) {
      return new Response(
        JSON.stringify({ error: "Missing Trustpilot API credentials" }),
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

    // Get the review from database to get the actual Trustpilot review ID
    const { data: review, error: reviewError } = await supabaseClient
      .from("trustpilot_reviews")
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

    // Get OAuth access token
    const accessToken = await getAccessToken(apiKey, apiSecret);
    console.log("Got Trustpilot access token");

    // Reply to review via Trustpilot API
    const apiUrl = `https://api.trustpilot.com/v1/private/reviews/${review.review_id}/reply`;
    
    const response: Response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: responseText,
        authorBusinessUserId: businessUserId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Trustpilot API error: ${response.status} - ${errorText}`);
      
      // Check if review was deleted (404 NOT_FOUND or errorCode 1009)
      if (response.status === 404) {
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.errorCode === 1009 || errorData.message?.includes("not found")) {
            console.log(`Review ${review.review_id} has been deleted on Trustpilot`);
            return new Response(
              JSON.stringify({ 
                error: "Review has been deleted from Trustpilot", 
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
      
      // Parse error to provide better messaging
      let errorMessage = "Failed to submit response";
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.errorCode === 1009 || errorData.message?.includes("not found")) {
          errorMessage = "This review is no longer available on Trustpilot. It may have been deleted or is too old to respond to.";
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // Use original error text if parsing fails
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Response submitted successfully");

    // Update the review in database with the response
    const { error: updateError } = await supabaseClient
      .from("trustpilot_reviews")
      .update({
        response_text: responseText,
        responded_at: new Date().toISOString(),
      })
      .eq("id", reviewId);

    if (updateError) {
      console.error("Failed to update review record:", updateError);
    }

    return new Response(
      JSON.stringify({ success: true }),
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
