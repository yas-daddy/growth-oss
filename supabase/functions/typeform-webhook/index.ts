import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TypeformAnswer {
  field: {
    id: string;
    ref: string;
    type: string;
  };
  type: string;
  number?: number;
  text?: string;
  boolean?: boolean;
  email?: string;
  choice?: {
    label: string;
  };
}

interface TypeformResponse {
  event_id: string;
  event_type: string;
  form_response: {
    form_id: string;
    token: string;
    submitted_at: string;
    definition: {
      fields: Array<{
        id: string;
        ref: string;
        title: string;
        type: string;
      }>;
    };
    answers: TypeformAnswer[];
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: TypeformResponse = await req.json();
    
    console.log("Received Typeform webhook:", JSON.stringify(payload, null, 2));

    if (payload.event_type !== "form_response") {
      console.log("Ignoring non-form_response event:", payload.event_type);
      return new Response(JSON.stringify({ success: true, message: "Event ignored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { form_response } = payload;
    const { token, submitted_at, definition, answers } = form_response;

    // Build a map of field titles to answers
    const fieldMap = new Map<string, TypeformAnswer>();
    definition.fields.forEach((field) => {
      const answer = answers.find((a) => a.field.id === field.id);
      if (answer) {
        fieldMap.set(field.title.toLowerCase(), answer);
      }
    });

    // Helper function to find answer by partial title match
    const findAnswer = (patterns: string[]): TypeformAnswer | undefined => {
      for (const pattern of patterns) {
        for (const [title, answer] of fieldMap.entries()) {
          if (title.includes(pattern.toLowerCase())) {
            return answer;
          }
        }
      }
      return undefined;
    };

    // Extract answers based on question patterns
    const ratingAnswer = findAnswer(["how do you like", "rating", "rate"]);
    const npsAnswer = findAnswer(["likely", "recommend"]);
    const disappointmentAnswer = findAnswer(["disappointed"]);
    const feedbackAnswer = findAnswer(["improve", "feedback", "anything else"]);
    const benefitAnswer = findAnswer(["benefit", "primary"]);
    const acquisitionAnswer = findAnswer(["hear about", "first hear"]);
    const referralAnswer = findAnswer(["invited", "friends"]);
    const emailAnswer = findAnswer(["email"]);

    // Parse values - rating comes as number type from Typeform rating field
    const rating = ratingAnswer?.number ?? null;
    const npsScore = npsAnswer?.number ?? null;
    const disappointmentScore = disappointmentAnswer?.number ?? null;
    const feedbackText = feedbackAnswer?.text || null;
    const primaryBenefit = benefitAnswer?.text || benefitAnswer?.choice?.label || null;
    const acquisitionSource = acquisitionAnswer?.text || acquisitionAnswer?.choice?.label || null;
    const hasInvitedFriends = referralAnswer?.boolean ?? false;
    const email = emailAnswer?.email || emailAnswer?.text || null;

    console.log("Parsed values:", { rating, npsScore, disappointmentScore, feedbackText, email });

    if (!rating) {
      console.error("Rating is required but not found in response");
      return new Response(
        JSON.stringify({ success: false, error: "Rating is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert the survey response
    const { error: upsertError } = await supabase
      .from("typeform_surveys")
      .upsert(
        {
          response_id: token,
          rating,
          nps_score: npsScore,
          disappointment_score: disappointmentScore,
          feedback_text: feedbackText,
          primary_benefit: primaryBenefit,
          acquisition_source: acquisitionSource,
          has_invited_friends: hasInvitedFriends,
          email,
          submitted_at,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "response_id" }
      );

    if (upsertError) {
      console.error("Error upserting survey response:", upsertError);
      throw upsertError;
    }

    console.log("Successfully stored Typeform survey response:", token);

    return new Response(
      JSON.stringify({ success: true, response_id: token }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing Typeform webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
