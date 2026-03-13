import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting NPS metrics calculation...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all typeform surveys with NPS scores
    const { data: surveys, error: fetchError } = await supabase
      .from("typeform_surveys")
      .select("nps_score, submitted_at")
      .not("nps_score", "is", null)
      .order("submitted_at", { ascending: true });

    if (fetchError) {
      console.error("Error fetching surveys:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${surveys?.length || 0} NPS responses`);

    if (!surveys || surveys.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No NPS data to process", metricsCount: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group by date
    const dailyMetrics: Record<string, { promoters: number; passives: number; detractors: number }> = {};

    for (const survey of surveys) {
      const date = survey.submitted_at.split("T")[0]; // Extract date part
      const score = survey.nps_score;

      if (!dailyMetrics[date]) {
        dailyMetrics[date] = { promoters: 0, passives: 0, detractors: 0 };
      }

      if (score >= 9) {
        dailyMetrics[date].promoters++;
      } else if (score >= 7) {
        dailyMetrics[date].passives++;
      } else {
        dailyMetrics[date].detractors++;
      }
    }

    // Calculate NPS for each day and prepare upsert data
    const metricsToUpsert = Object.entries(dailyMetrics).map(([date, counts]) => {
      const total = counts.promoters + counts.passives + counts.detractors;
      const npsScore = total > 0 
        ? ((counts.promoters / total) - (counts.detractors / total)) * 100 
        : null;

      return {
        date,
        promoters: counts.promoters,
        passives: counts.passives,
        detractors: counts.detractors,
        nps_score: npsScore !== null ? Math.round(npsScore * 100) / 100 : null,
        calculated_at: new Date().toISOString(),
      };
    });

    console.log(`Calculated metrics for ${metricsToUpsert.length} days`);

    // Upsert in batches
    const batchSize = 50;
    let totalUpserted = 0;

    for (let i = 0; i < metricsToUpsert.length; i += batchSize) {
      const batch = metricsToUpsert.slice(i, i + batchSize);
      const { error: upsertError } = await supabase
        .from("daily_nps_metrics")
        .upsert(batch, { onConflict: "date" });

      if (upsertError) {
        console.error(`Upsert error for batch ${i}:`, upsertError);
        throw upsertError;
      }
      totalUpserted += batch.length;
    }

    console.log(`Successfully upserted ${totalUpserted} NPS metrics`);

    return new Response(
      JSON.stringify({
        success: true,
        metricsCount: totalUpserted,
        message: `Calculated NPS metrics for ${totalUpserted} days`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error calculating NPS metrics:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
