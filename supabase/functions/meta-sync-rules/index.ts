import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getTenantCredentials } from "../_shared/tenant-credentials.ts";
import { resolveOrgContext } from "../_shared/org-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MetaAdRule {
  id: string;
  name: string;
  status: string;
  account_id: string;
  evaluation_spec: Record<string, unknown>;
  execution_spec: Record<string, unknown>;
  schedule_spec?: Record<string, unknown>;
  created_by?: { name?: string };
  created_time?: string;
  updated_time?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { orgId } = await resolveOrgContext(req, body);

    const { credentials } = await getTenantCredentials("meta_ads", orgId);
    const accessToken = credentials.access_token;
    let adAccountId = credentials.ad_account_id;

    if (!accessToken || !adAccountId) {
      throw new Error("Meta credentials not configured");
    }

    // Fetch all rules from Meta
    const fields = "id,name,status,account_id,evaluation_spec,execution_spec,schedule_spec,created_by,created_time,updated_time";
    const url = `https://graph.facebook.com/v24.0/act_${adAccountId}/adrules_library?fields=${fields}&access_token=${accessToken}`;

    console.log("Fetching Meta ad rules...");
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Meta API error: ${data.error.message}`);
    }

    const rules: MetaAdRule[] = data.data || [];
    console.log(`Fetched ${rules.length} rules from Meta`);

    // Upsert rules into database
    for (const rule of rules) {
      const { error } = await supabase
        .from("meta_ad_rules")
        .upsert(
          {
            meta_rule_id: rule.id,
            name: rule.name,
            status: rule.status,
            account_id: rule.account_id,
            evaluation_spec: rule.evaluation_spec,
            execution_spec: rule.execution_spec,
            schedule_spec: rule.schedule_spec || null,
            created_by_name: rule.created_by?.name || null,
            created_time: rule.created_time || null,
            updated_time: rule.updated_time || null,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "meta_rule_id" }
        );

      if (error) {
        console.error(`Error upserting rule ${rule.id}:`, error);
      }
    }

    // Remove rules that no longer exist in Meta
    const metaRuleIds = rules.map((r) => r.id);
    if (metaRuleIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("meta_ad_rules")
        .delete()
        .not("meta_rule_id", "in", `(${metaRuleIds.join(",")})`);

      if (deleteError) {
        console.error("Error cleaning up old rules:", deleteError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: rules.length,
        message: `Successfully synced ${rules.length} Meta ad rules`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error syncing Meta rules:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
