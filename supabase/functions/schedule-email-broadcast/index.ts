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
    const userId = claimsData.claims.sub;

    const {
      image_url,
      email_title,
      pre_header,
      header_title,
      body_copy,
      cta_text,
      cta_url,
      offer_validity_hours,
      push_title,
      push_body,
      scheduled_at,
      extra_properties,
      campaign_id,
    } = await req.json();

    if (!email_title || !scheduled_at) {
      return new Response(JSON.stringify({ error: "email_title and scheduled_at are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scheduledDate = new Date(scheduled_at);
    const now = new Date();

    if (scheduledDate <= now) {
      return new Response(JSON.stringify({ error: "Cannot schedule broadcast in the past." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up canvas ID from the campaign settings
    let canvasId: string | null = null;

    if (campaign_id) {
      const { data: campaignSettings } = await supabase
        .from("email_campaign_settings")
        .select("canvas_id")
        .eq("id", campaign_id)
        .maybeSingle();
      canvasId = campaignSettings?.canvas_id || null;
    } else {
      // Fallback: read from first settings row (legacy)
      const { data: settings } = await supabase
        .from("email_campaign_settings")
        .select("canvas_id")
        .limit(1)
        .maybeSingle();
      canvasId = settings?.canvas_id || null;
    }

    if (!canvasId) {
      return new Response(JSON.stringify({ error: "Canvas ID not configured. Set it in Email Campaign settings." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const brazeRestUrl = Deno.env.get("BRAZE_REST_URL");
    const brazeApiKey = Deno.env.get("BRAZE_REST_API_KEY");

    if (!brazeRestUrl || !brazeApiKey) {
      return new Response(JSON.stringify({ error: "Braze API configuration missing." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const offerValiditySeconds = offer_validity_hours ? Math.round(Number(offer_validity_hours) * 3600) : null;

    const brazePayload = {
      canvas_id: canvasId,
      broadcast: true,
      canvas_entry_properties: {
        email_title: email_title || "",
        pre_header: pre_header || "",
        header_title: header_title || "",
        body_copy: body_copy || "",
        cta_text: cta_text || "",
        cta_url: cta_url || "",
        image_url: image_url || "",
        offer_validity_seconds: offerValiditySeconds,
        push_title: push_title || "",
        push_body: push_body || "",
        ...(extra_properties || {}),
      },
      schedule: {
        time: scheduledDate.toISOString(),
      },
    };

    const brazeResponse = await fetch(`${brazeRestUrl}/canvas/trigger/schedule/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${brazeApiKey}`,
      },
      body: JSON.stringify(brazePayload),
    });

    const brazeResult = await brazeResponse.json();

    if (!brazeResponse.ok) {
      console.error("Braze API error:", brazeResult);
      return new Response(JSON.stringify({ error: "Failed to schedule with Braze", details: brazeResult }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scheduleId = brazeResult.schedule_id || brazeResult.dispatch_id || null;

    // Save to database
    const { data: schedule, error: insertError } = await supabase
      .from("email_campaign_schedules")
      .insert({
        image_url,
        email_title,
        pre_header,
        header_title,
        body_copy,
        cta_text,
        cta_url,
        offer_validity_hours: offer_validity_hours ? Number(offer_validity_hours) : null,
        push_title: push_title || null,
        push_body: push_body || null,
        scheduled_at: scheduledDate.toISOString(),
        status: "scheduled",
        braze_schedule_id: scheduleId,
        braze_response: brazeResult,
        created_by: userId,
        extra_properties: extra_properties || {},
        campaign_id: campaign_id || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("DB insert error:", insertError);
      return new Response(JSON.stringify({ error: "Scheduled with Braze but failed to save record", details: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      schedule,
      braze_schedule_id: scheduleId,
    }), {
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
