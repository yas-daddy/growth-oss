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

    const { fixture_id } = await req.json();

    if (!fixture_id) {
      return new Response(JSON.stringify({ error: "fixture_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const { data: settings } = await supabase
      .from("review_settings")
      .select("push_notification_prompt")
      .limit(1)
      .maybeSingle();

    const customPrompt = settings?.push_notification_prompt || "";
    const homeTeamName = fixture.home_team?.name || "Home Team";
    const awayTeamName = fixture.away_team?.name || "Away Team";
    const matchDate = new Date(fixture.match_date);
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // Fallback copy
      const homeShort = fixture.home_team?.short_name || homeTeamName;
      const awayShort = fixture.away_team?.short_name || awayTeamName;
      return new Response(JSON.stringify({
        title: `${homeShort} vs ${awayShort} - Kickoff Soon!`,
        body: `${homeTeamName} take on ${awayTeamName} shortly. Place your bets now on Stakemate!`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: systemPrompt }],
      }),
    });

    if (!aiResponse.ok) {
      const homeShort = fixture.home_team?.short_name || homeTeamName;
      const awayShort = fixture.away_team?.short_name || awayTeamName;
      return new Response(JSON.stringify({
        title: `${homeShort} vs ${awayShort} - Kickoff Soon!`,
        body: `${homeTeamName} take on ${awayTeamName} shortly. Place your bets now on Stakemate!`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return new Response(JSON.stringify({
        title: parsed.title || `${fixture.home_team?.short_name} vs ${fixture.away_team?.short_name}`,
        body: parsed.body || `Don't miss the action! Bet now on Stakemate.`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const homeShort = fixture.home_team?.short_name || homeTeamName;
    const awayShort = fixture.away_team?.short_name || awayTeamName;
    return new Response(JSON.stringify({
      title: `${homeShort} vs ${awayShort} - Kickoff Soon!`,
      body: `${homeTeamName} take on ${awayTeamName} shortly. Place your bets now on Stakemate!`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-push-copy error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
