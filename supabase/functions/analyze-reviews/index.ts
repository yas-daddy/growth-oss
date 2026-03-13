import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Not authenticated');
    }

    const { reviews } = await req.json();
    
    if (!reviews || reviews.length === 0) {
      return new Response(
        JSON.stringify({ 
          issues: "No negative reviews to analyze in this period.",
          features: "No negative reviews to analyze in this period."
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing ${reviews.length} negative reviews...`);

    // Get organization-wide custom insights prompt
    const { data: settings } = await supabaseClient
      .from('review_settings')
      .select('insights_prompt')
      .limit(1)
      .maybeSingle();

    const defaultPrompt = `Analyze these customer reviews and provide brief insights in two sections.

SECTION 1 - ISSUES:
Summarize any technical problems, app crashes, features not working, or bugs mentioned. 2 sentences max. Do NOT include section headers or question text in your response.

SECTION 2 - FEATURES:
Summarize any feature requests, missing functionality, or suggestions for improvement. 2 sentences max. Do NOT include section headers or question text in your response.

Be specific and cite examples. If nothing relevant, say "No specific issues mentioned." Format your response exactly as:
ISSUES: [your 2 sentence summary]
FEATURES: [your 2 sentence summary]`;

    const insightsPrompt = settings?.insights_prompt || defaultPrompt;

    // Format reviews for the AI
    const reviewsText = reviews
      .map((r: { stars: number; title?: string; text?: string; source: string }) => 
        `[${r.stars}★ - ${r.source}] ${r.title ? r.title + ': ' : ''}${r.text || 'No text'}`
      )
      .join('\n\n');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: insightsPrompt },
          { role: "user", content: `Here are the customer reviews to analyze:\n\n${reviewsText}` }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    console.log("AI analysis complete, raw response:", content);

    // Parse the response to extract issues and features
    // Clean up common AI response patterns
    let cleanedContent = content
      // Remove intro phrases
      .replace(/^here are the insights.*?:\s*/i, '')
      .replace(/^based on the.*?:\s*/i, '')
      // Remove numbered list formatting with questions
      .replace(/\d+\.\s*\*?\*?did users have any specific issues or bugs\??\*?\*?\s*/gi, 'ISSUES: ')
      .replace(/\d+\.\s*\*?\*?what features were users asking for\??\*?\*?\s*/gi, 'FEATURES: ')
      // Remove standalone questions
      .replace(/\*?\*?did users have any specific issues or bugs\??\*?\*?\s*/gi, '')
      .replace(/\*?\*?what features were users asking for\??\*?\*?\s*/gi, '')
      .trim();

    // Try to extract issues and features sections
    const issuesMatch = cleanedContent.match(/ISSUES:\s*([\s\S]*?)(?=FEATURES:|$)/i);
    const featuresMatch = cleanedContent.match(/FEATURES:\s*([\s\S]*?)$/i);

    let issues = issuesMatch?.[1]?.trim() || '';
    let features = featuresMatch?.[1]?.trim() || '';

    // If no ISSUES/FEATURES format found, try splitting by numbered list
    if (!issues && !features) {
      const parts = cleanedContent.split(/\n\n|\n(?=\d\.)/);
      if (parts.length >= 2) {
        issues = parts[0].replace(/^\d+\.\s*/, '').trim();
        features = parts[1].replace(/^\d+\.\s*/, '').trim();
      } else {
        issues = cleanedContent;
        features = '';
      }
    }

    // Final cleanup - remove any remaining bold markers and question text
    issues = issues.replace(/\*\*/g, '').replace(/^issues:?\s*/i, '').trim();
    features = features.replace(/\*\*/g, '').replace(/^features:?\s*/i, '').trim();

    return new Response(
      JSON.stringify({ issues, features, raw: content }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error analyzing reviews:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
