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

    const { fixture_id, title: customTitle, body: customBody, scheduled_at: customScheduledAt } = await req.json();

    if (!fixture_id) {
      return new Response(JSON.stringify({ error: "fixture_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch fixture with team names
    const { data: fixture, error: fixtureError } = await supabase
      .from("football_fixtures")
      .select("*, home_team:football_teams!football_fixtures_home_team_id_fkey(name, short_name), away_team:football_teams!football_fixtures_away_team_id_fkey(name, short_name)")
      .eq("id", fixture_id)
      .single();

    if (fixtureError || !fixture) {
      return new Response(JSON.stringify({ error: "Fixture not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const homeShort = fixture.home_team?.short_name || fixture.home_team?.name || "Home";
    const awayShort = fixture.away_team?.short_name || fixture.away_team?.name || "Away";
    const matchDate = new Date(fixture.match_date);
    const dateStr = matchDate.toISOString().split("T")[0];
    const matchName = `${homeShort.toUpperCase().replace(/\s+/g, "_")}_${awayShort.toUpperCase().replace(/\s+/g, "_")}_${dateStr}`;

    // Use custom title/body if provided, otherwise generate with AI
    let aiTitle = customTitle;
    let aiBody = customBody;

    if (!aiTitle || !aiBody) {
      // Fetch custom prompt from review_settings
      const { data: settings } = await supabase
        .from("review_settings")
        .select("push_notification_prompt")
        .limit(1)
        .maybeSingle();

      const customPrompt = settings?.push_notification_prompt || "";

      const homeTeamName = fixture.home_team?.name || "Home Team";
      const awayTeamName = fixture.away_team?.name || "Away Team";
      const kickoffTime = matchDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
      const kickoffDate = matchDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" });

      const oddsInfo = fixture.home_odds && fixture.draw_odds && fixture.away_odds
        ? `Odds: ${homeTeamName} ${fixture.home_odds}, Draw ${fixture.draw_odds}, ${awayTeamName} ${fixture.away_odds}.`
        : "";

      const systemPrompt = `You are a push notification copywriter for a sports betting app called Stakemate. Generate a compelling push notification for an upcoming football match.

${customPrompt ? `Additional instructions: ${customPrompt}` : ""}

Match details:
- ${homeTeamName} vs ${awayTeamName}
- Kickoff: ${kickoffDate} at ${kickoffTime}
- Competition: ${fixture.competition || "Premier League"}
${oddsInfo}

Generate a JSON object with exactly two fields:
- "title": A short, punchy notification title (max 50 chars)
- "body": An engaging notification body that creates urgency to bet (max 150 chars)

Respond ONLY with the JSON object, no other text.`;

      try {
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(LOVABLE_API_KEY ? { Authorization: `Bearer ${LOVABLE_API_KEY}` } : {}),
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: systemPrompt }],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          // Parse JSON from response (handle markdown code blocks)
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            aiTitle = aiTitle || parsed.title;
            aiBody = aiBody || parsed.body;
          }
        }
      } catch (aiError) {
        console.error("AI generation failed, using fallback:", aiError);
      }

      // Fallback if AI fails
      if (!aiTitle) aiTitle = `${homeShort} vs ${awayShort} - Kickoff Soon!`;
      if (!aiBody) aiBody = `${fixture.home_team?.name || "Home"} take on ${fixture.away_team?.name || "Away"} shortly. Place your bets now on Stakemate!`;
    }

    // Use custom scheduled_at if provided, otherwise kickoff - 20 minutes
    const scheduledAt = customScheduledAt ? new Date(customScheduledAt) : new Date(matchDate.getTime() - 20 * 60 * 1000);
    const now = new Date();

    if (scheduledAt <= now) {
      return new Response(JSON.stringify({ error: "Cannot schedule push notification in the past. Match kickoff is too soon." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Braze to schedule the canvas
    const brazeRestUrl = Deno.env.get("BRAZE_REST_URL");
    const brazeApiKey = Deno.env.get("BRAZE_REST_API_KEY");

    // Read canvas ID from DB settings
    const { data: brazeSettings } = await supabase
      .from("review_settings")
      .select("braze_canvas_id")
      .limit(1)
      .maybeSingle();

    const brazeCanvasId = brazeSettings?.braze_canvas_id;

    if (!brazeCanvasId) {
      return new Response(JSON.stringify({ error: "Braze Canvas ID not configured. Set it in Settings > Customisations." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!brazeRestUrl || !brazeApiKey) {
      return new Response(JSON.stringify({ error: "Braze API configuration missing (REST URL or API key)." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const brazePayload = {
      canvas_id: brazeCanvasId,
      broadcast: true,
      canvas_entry_properties: {
        title: aiTitle,
        body: aiBody,
        match_name: matchName,
      },
      schedule: {
        time: scheduledAt.toISOString(),
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
      .from("push_notification_schedules")
      .insert({
        fixture_id,
        braze_schedule_id: scheduleId,
        scheduled_at: scheduledAt.toISOString(),
        ai_title: aiTitle,
        ai_body: aiBody,
        status: "scheduled",
        created_by: userId,
        braze_response: brazeResult,
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
      match_name: matchName,
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
