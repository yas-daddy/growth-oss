import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startSyncLog, completeSyncLog } from "../_shared/sync-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate Google OAuth2 access token from service account
async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const serviceAccount = JSON.parse(serviceAccountJson);
  
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600, // 1 hour
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import the private key
  const pemContents = serviceAccount.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");
  
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
    encoder.encode(signingInput)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${signingInput}.${signatureB64}`;

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let logId: string | null = null;

  try {
    console.log("Starting Google Search Console sync...");

    const serviceAccountJson = Deno.env.get("GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON");
    const siteUrl = Deno.env.get("GOOGLE_SEARCH_CONSOLE_SITE_URL");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!serviceAccountJson || !siteUrl) {
      console.error("Missing Google Search Console credentials");
      return new Response(
        JSON.stringify({ error: "Missing Google Search Console credentials" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Start sync log
    const syncLog = await startSyncLog('google-search-console-sync');
    logId = syncLog?.id ?? null;

    // Get access token from service account
    console.log("Generating access token...");
    const accessToken = await getAccessToken(serviceAccountJson);
    console.log("Access token obtained");

    // Query last 16 months of data (GSC API allows up to 16 months)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 16);

    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    const requestBody = {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      dimensions: ["date"],
      rowLimit: 5000,
    };

    console.log(`Querying Search Console from ${requestBody.startDate} to ${requestBody.endDate}`);

    const encodedSiteUrl = encodeURIComponent(siteUrl);
    const apiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Search Console API error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ 
          error: "Failed to fetch Search Console data", 
          details: errorText,
          status: response.status 
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rows = data.rows || [];

    console.log(`Fetched ${rows.length} days of Search Console data`);

    // Transform and upsert metrics
    const metricsToUpsert = rows.map((row: any) => ({
      date: row.keys[0], // date dimension
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
      ctr: row.ctr || 0,
      position: row.position || null,
      synced_at: new Date().toISOString(),
    }));

    if (metricsToUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from("google_search_console_metrics")
        .upsert(metricsToUpsert, { onConflict: "date" });

      if (upsertError) {
        console.error("Upsert error:", upsertError);
        throw upsertError;
      }
    }

    console.log(`Successfully synced ${metricsToUpsert.length} days of Search Console metrics`);

    // Complete sync log
    await completeSyncLog(logId, true);

    return new Response(
      JSON.stringify({
        success: true,
        metricsCount: metricsToUpsert.length,
        message: `Synced ${metricsToUpsert.length} days of Search Console data`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error syncing Search Console:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    
    // Complete sync log with error
    await completeSyncLog(logId, false, errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
