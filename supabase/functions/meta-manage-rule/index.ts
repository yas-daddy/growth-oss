import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateRuleRequest {
  action: "create" | "update" | "delete" | "toggle";
  ruleId?: string;
  name?: string;
  status?: "ENABLED" | "DISABLED";
  evaluation_spec?: {
    evaluation_type: "SCHEDULE" | "TRIGGER";
    filters: Array<{
      field: string;
      value: unknown;
      operator: string;
    }>;
    trigger?: {
      type: string;
      field?: string;
      value?: unknown;
      operator?: string;
    };
  };
  execution_spec?: {
    execution_type: string;
    execution_options?: Array<{
      field: string;
      value: unknown;
      operator: string;
    }>;
  };
  schedule_spec?: {
    schedule_type: "DAILY" | "HOURLY" | "SEMI_HOURLY" | "CUSTOM";
    schedule?: Array<{
      start_minute?: number;
      end_minute?: number;
      days?: number[];
    }>;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const accessToken = Deno.env.get("META_ACCESS_TOKEN");
    const adAccountId = Deno.env.get("META_AD_ACCOUNT_ID");

    if (!accessToken || !adAccountId) {
      throw new Error("META_ACCESS_TOKEN or META_AD_ACCOUNT_ID not configured");
    }

    const body: CreateRuleRequest = await req.json();
    const { action, ruleId } = body;

    let result: { success: boolean; ruleId?: string; message?: string };

    switch (action) {
      case "create": {
        if (!body.name || !body.evaluation_spec || !body.execution_spec) {
          throw new Error("Missing required fields for rule creation");
        }

        const formData = new URLSearchParams();
        formData.append("name", body.name);
        formData.append("evaluation_spec", JSON.stringify(body.evaluation_spec));
        formData.append("execution_spec", JSON.stringify(body.execution_spec));
        if (body.schedule_spec) {
          formData.append("schedule_spec", JSON.stringify(body.schedule_spec));
        }
        formData.append("status", body.status || "ENABLED");
        formData.append("access_token", accessToken);

        const response = await fetch(
          `https://graph.facebook.com/v24.0/act_${adAccountId}/adrules_library`,
          {
            method: "POST",
            body: formData,
          }
        );

        const data = await response.json();
        if (data.error) {
          throw new Error(`Meta API error: ${data.error.message}`);
        }

        // Sync the new rule to database
        await supabase.from("meta_ad_rules").insert({
          meta_rule_id: data.id,
          name: body.name,
          status: body.status || "ENABLED",
          account_id: adAccountId,
          evaluation_spec: body.evaluation_spec,
          execution_spec: body.execution_spec,
          schedule_spec: body.schedule_spec || null,
          synced_at: new Date().toISOString(),
        });

        result = { success: true, ruleId: data.id, message: "Rule created successfully" };
        break;
      }

      case "update": {
        if (!ruleId) throw new Error("Rule ID required for update");

        const formData = new URLSearchParams();
        if (body.name) formData.append("name", body.name);
        if (body.evaluation_spec) {
          formData.append("evaluation_spec", JSON.stringify(body.evaluation_spec));
        }
        if (body.execution_spec) {
          formData.append("execution_spec", JSON.stringify(body.execution_spec));
        }
        if (body.schedule_spec) {
          formData.append("schedule_spec", JSON.stringify(body.schedule_spec));
        }
        if (body.status) formData.append("status", body.status);
        formData.append("access_token", accessToken);

        const response = await fetch(
          `https://graph.facebook.com/v24.0/${ruleId}`,
          {
            method: "POST",
            body: formData,
          }
        );

        const data = await response.json();
        if (data.error) {
          throw new Error(`Meta API error: ${data.error.message}`);
        }

        // Update in database
        const updateData: Record<string, unknown> = { synced_at: new Date().toISOString() };
        if (body.name) updateData.name = body.name;
        if (body.status) updateData.status = body.status;
        if (body.evaluation_spec) updateData.evaluation_spec = body.evaluation_spec;
        if (body.execution_spec) updateData.execution_spec = body.execution_spec;
        if (body.schedule_spec) updateData.schedule_spec = body.schedule_spec;

        await supabase
          .from("meta_ad_rules")
          .update(updateData)
          .eq("meta_rule_id", ruleId);

        result = { success: true, ruleId, message: "Rule updated successfully" };
        break;
      }

      case "toggle": {
        if (!ruleId || !body.status) throw new Error("Rule ID and status required for toggle");

        const formData = new URLSearchParams();
        formData.append("status", body.status);
        formData.append("access_token", accessToken);

        const response = await fetch(
          `https://graph.facebook.com/v24.0/${ruleId}`,
          {
            method: "POST",
            body: formData,
          }
        );

        const data = await response.json();
        if (data.error) {
          throw new Error(`Meta API error: ${data.error.message}`);
        }

        await supabase
          .from("meta_ad_rules")
          .update({ status: body.status, synced_at: new Date().toISOString() })
          .eq("meta_rule_id", ruleId);

        result = { success: true, ruleId, message: `Rule ${body.status.toLowerCase()}` };
        break;
      }

      case "delete": {
        if (!ruleId) throw new Error("Rule ID required for delete");

        const response = await fetch(
          `https://graph.facebook.com/v24.0/${ruleId}?access_token=${accessToken}`,
          { method: "DELETE" }
        );

        const data = await response.json();
        if (data.error) {
          throw new Error(`Meta API error: ${data.error.message}`);
        }

        await supabase.from("meta_ad_rules").delete().eq("meta_rule_id", ruleId);

        result = { success: true, ruleId, message: "Rule deleted successfully" };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error managing Meta rule:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
