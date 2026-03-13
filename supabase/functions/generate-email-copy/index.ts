import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_EMAIL_COPY_PROMPT = `You are an email marketing copywriter for a sports betting brand called StakeMate. Given an email title (subject line), generate the following fields for an email campaign.

IMPORTANT: Where promotional values like bet amounts or free bet amounts are dynamic, you MUST use Liquid template syntax exactly as shown in the examples. Use {{ bet_amount }} and {{ free_bet_amount }} where applicable.

Return these 5 fields:
- pre_header: A short teaser shown next to the subject in inbox
- header_title: The main heading inside the email
- body_copy: The main email body (use HTML <b> tags for emphasis, keep it 2-4 sentences, use \\n\\n for paragraph breaks)
- push_title: Push notification title (short, with emoji if appropriate)
- push_body: Push notification body (1 sentence, include CTA)

Example:
Email Title: "FA Cup Special: Bet {{ bet_amount }}, Get {{ free_bet_amount }} Free"
pre_header: Bet {{ bet_amount }}, {{ free_bet_amount }} FREE bet on us
header_title: Your FA Cup free bet is waiting
body_copy: The FA Cup has a habit of delivering big moments, late drama and the odd giant-killing that no one saw coming.\\n\\nTo make it even better, we're giving you a little extra to play with:\\n\\n<b>Bet {{ bet_amount }}, get {{ free_bet_amount }} FREE bet.</b>\\n\\nGet involved before kick off and give yourself something extra to cheer about.
push_title: Bet {{ bet_amount }}, get {{ free_bet_amount }} FREE bet ⚽
push_body: Kick off the FA Cup with a free bet. Terms apply. Bet here.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email_title } = await req.json();
    if (!email_title) {
      return new Response(JSON.stringify({ error: "email_title is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Read custom prompt from review_settings if available
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: settingsRow } = await supabase
      .from("review_settings")
      .select("email_copy_prompt")
      .limit(1)
      .maybeSingle();

    const systemPrompt = settingsRow?.email_copy_prompt || DEFAULT_EMAIL_COPY_PROMPT;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Email Title: "${email_title}"` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_email_copy",
              description: "Generate email campaign copy fields based on the email title.",
              parameters: {
                type: "object",
                properties: {
                  pre_header: { type: "string", description: "Short teaser for inbox preview" },
                  header_title: { type: "string", description: "Main heading inside email" },
                  body_copy: { type: "string", description: "Main email body with HTML tags" },
                  push_title: { type: "string", description: "Push notification title" },
                  push_body: { type: "string", description: "Push notification body" },
                },
                required: ["pre_header", "header_title", "body_copy", "push_title", "push_body"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_email_copy" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "No structured output from AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const generated = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(generated), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-email-copy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
