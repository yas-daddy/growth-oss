import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AIError, AI_MODEL_FAST, callAIText } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { review } = await req.json();

    if (!review) {
      return new Response(
        JSON.stringify({ error: "Missing review data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve user's org to fetch org-scoped review settings
    const { data: membership } = await supabaseClient
      .from("organization_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    const { data: settings } = membership?.org_id
      ? await supabaseClient
          .from("review_settings")
          .select("ai_prompt")
          .eq("org_id", membership.org_id)
          .maybeSingle()
      : { data: null };

    // Platform-specific character limits
    const getCharLimit = (source: string): number => {
      if (source === 'Google Play') return 340; // Slightly under 350 for safety
      if (source === 'App Store') return 5900;
      return 4000; // Trustpilot
    };
    
    const charLimit = getCharLimit(review.source);
    
    const basePrompt = settings?.ai_prompt || 
      "You are a professional customer service representative responding to app reviews. Be genuine, helpful and friendly.";
    
    // Very explicit about character limits
    const systemPrompt = review.source === 'Google Play' 
      ? `${basePrompt}\n\nCRITICAL: Google Play has a strict 350 CHARACTER limit (not words). Write a VERY SHORT response - maximum 2-3 brief sentences. Count your characters carefully.`
      : `${basePrompt}\n\nKeep your response concise and under ${charLimit} characters.`;

    // Build the review context
    const reviewContext = `
Platform: ${review.source}
Rating: ${review.stars}/5 stars
${review.title ? `Title: ${review.title}` : ""}
${review.author ? `Author: ${review.author}` : ""}
Review: ${review.text || "(No text provided)"}
`.trim();

    console.log("Generating AI response for review...");

    let suggestion = await callAIText(AI_MODEL_FAST, [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Please write a response to this review:\n\n${reviewContext}` },
    ]);


    // Truncate if still over limit (fallback safety)
    if (suggestion.length > charLimit) {
      console.log(`Truncating response from ${suggestion.length} to ${charLimit} chars`);
      // Find last sentence break before limit
      const truncated = suggestion.substring(0, charLimit);
      const lastPeriod = truncated.lastIndexOf('.');
      const lastExclaim = truncated.lastIndexOf('!');
      const lastBreak = Math.max(lastPeriod, lastExclaim);
      suggestion = lastBreak > charLimit * 0.5 ? truncated.substring(0, lastBreak + 1) : truncated.trim();
    }

    console.log(`AI response generated successfully (${suggestion.length} chars)`);

    return new Response(
      JSON.stringify({ suggestion }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating AI response:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: error instanceof AIError ? error.status : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
