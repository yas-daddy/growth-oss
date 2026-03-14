import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, redirect_uri } = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ error: "Missing authorization code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appId = Deno.env.get("META_APP_ID");
    const appSecret = Deno.env.get("META_APP_SECRET");

    if (!appId || !appSecret) {
      return new Response(
        JSON.stringify({ error: "Meta App not configured on server" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Exchange code for short-lived token
    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirect_uri);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("[meta-oauth] Token exchange error:", tokenData.error);
      return new Response(
        JSON.stringify({ error: tokenData.error.message || "Failed to exchange code for token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const shortLivedToken = tokenData.access_token;

    // Step 2: Exchange for long-lived token
    const longTokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    longTokenUrl.searchParams.set("grant_type", "fb_exchange_token");
    longTokenUrl.searchParams.set("client_id", appId);
    longTokenUrl.searchParams.set("client_secret", appSecret);
    longTokenUrl.searchParams.set("fb_exchange_token", shortLivedToken);

    const longTokenRes = await fetch(longTokenUrl.toString());
    const longTokenData = await longTokenRes.json();

    if (longTokenData.error) {
      console.error("[meta-oauth] Long-lived token error:", longTokenData.error);
      return new Response(
        JSON.stringify({ error: longTokenData.error.message || "Failed to get long-lived token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = longTokenData.access_token;
    const expiresIn = longTokenData.expires_in; // ~5184000 seconds (60 days)

    // Step 3: Fetch user's ad accounts
    const adAccountsRes = await fetch(
      `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,account_status,currency,business_name&access_token=${accessToken}`
    );
    const adAccountsData = await adAccountsRes.json();

    if (adAccountsData.error) {
      console.error("[meta-oauth] Ad accounts error:", adAccountsData.error);
      return new Response(
        JSON.stringify({ error: adAccountsData.error.message || "Failed to fetch ad accounts" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 4: Fetch user's pages (for page_id)
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account&access_token=${accessToken}`
    );
    const pagesData = await pagesRes.json();

    const pages = (pagesData.data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      instagram_business_account_id: p.instagram_business_account?.id || null,
    }));

    return new Response(
      JSON.stringify({
        access_token: accessToken,
        expires_in: expiresIn,
        ad_accounts: (adAccountsData.data || []).map((a: any) => ({
          id: a.id, // act_XXXXX format
          account_id: a.account_id,
          name: a.name || a.business_name || `Account ${a.account_id}`,
          account_status: a.account_status,
          currency: a.currency,
        })),
        pages,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[meta-oauth-callback] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
