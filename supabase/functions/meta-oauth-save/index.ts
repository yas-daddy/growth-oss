import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveOrgContext } from "../_shared/org-resolver.ts";

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
    const body = await req.json();
    const { orgId } = await resolveOrgContext(req, body);

    const { access_token, ad_account_id, page_id, instagram_actor_id, display_name } = body;

    if (!access_token || !ad_account_id) {
      return new Response(
        JSON.stringify({ error: "Missing access_token or ad_account_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const credentials: Record<string, string> = {
      access_token,
      ad_account_id,
    };

    if (page_id) credentials.page_id = page_id;
    if (instagram_actor_id) credentials.instagram_actor_id = instagram_actor_id;

    const { data, error } = await supabase
      .from("provider_connections")
      .upsert(
        {
          org_id: orgId,
          provider: "meta_ads",
          auth_method: "oauth",
          credentials,
          display_name: display_name || "Meta Ads",
          status: "connected",
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          error_message: null,
        },
        { onConflict: "org_id,provider" }
      )
      .select()
      .single();

    if (error) {
      console.error("[meta-oauth-save] DB error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, connection: data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[meta-oauth-save] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
