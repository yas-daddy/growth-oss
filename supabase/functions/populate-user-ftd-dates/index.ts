import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

  const startTime = Date.now();
  console.log('=== POPULATE USER FTD DATES STARTED ===');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Call the populate function
    const { data, error } = await supabase.rpc('populate_user_ftd_dates');

    if (error) {
      console.error('Error populating user FTD dates:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get count of populated rows
    const { count } = await supabase
      .from('user_ftd_dates')
      .select('*', { count: 'exact', head: true });

    const duration = Date.now() - startTime;
    console.log(`=== POPULATE USER FTD DATES COMPLETED in ${duration}ms ===`);
    console.log(`Inserted ${data} new users, total rows: ${count}`);

    return new Response(JSON.stringify({
      success: true,
      duration,
      insertedUsers: data,
      totalRows: count,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      duration: Date.now() - startTime,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
