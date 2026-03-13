import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { schedule_id } = await req.json();

    if (!schedule_id) {
      return new Response(JSON.stringify({ error: "schedule_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the schedule record
    const { data: schedule, error: fetchError } = await supabase
      .from("push_notification_schedules")
      .select("*")
      .eq("id", schedule_id)
      .single();

    if (fetchError || !schedule) {
      return new Response(JSON.stringify({ error: "Schedule not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (schedule.status === "cancelled") {
      return new Response(JSON.stringify({ error: "Already cancelled" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cancel with Braze
    const brazeRestUrl = Deno.env.get("BRAZE_REST_URL");
    const brazeApiKey = Deno.env.get("BRAZE_REST_API_KEY");
    const brazeCanvasId = Deno.env.get("BRAZE_CANVAS_ID");

    if (brazeRestUrl && brazeApiKey && brazeCanvasId && schedule.braze_schedule_id) {
      const brazeResponse = await fetch(`${brazeRestUrl}/canvas/trigger/schedule/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${brazeApiKey}`,
        },
        body: JSON.stringify({
          canvas_id: brazeCanvasId,
          schedule_id: schedule.braze_schedule_id,
        }),
      });

      const brazeResult = await brazeResponse.json();

      if (!brazeResponse.ok) {
        console.error("Braze cancel error:", brazeResult);
        // Still update DB status even if Braze fails
      }
    }

    // Update status in DB
    const { error: updateError } = await supabase
      .from("push_notification_schedules")
      .update({ status: "cancelled" })
      .eq("id", schedule_id);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to update status", details: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
