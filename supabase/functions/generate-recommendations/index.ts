import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface GenerationResult {
  function: string;
  success: boolean;
  duration: number;
  error?: string;
  count?: number;
}

async function callAnalysisFunction(
  functionName: string, 
  body: Record<string, unknown> = {}
): Promise<GenerationResult> {
  const startTime = Date.now();
  try {
    console.log(`Calling ${functionName}...`);
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const duration = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${functionName} failed: ${errorText}`);
      return { function: functionName, success: false, duration, error: errorText };
    }

    const result = await response.json();
    console.log(`${functionName} completed in ${duration}ms`);
    return { 
      function: functionName, 
      success: true, 
      duration,
      count: result.recommendations?.length || result.predictions?.length || 0
    };
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`${functionName} error:`, error);
    return { function: functionName, success: false, duration, error: errorMessage };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('=== RECOMMENDATION GENERATION STARTED ===');
  console.log(`Start time: ${new Date().toISOString()}`);

  const results: GenerationResult[] = [];

  try {
    // Generate keyword recommendations (14 day lookback)
    console.log('--- Step 1: Generating keyword recommendations ---');
    const keywordResult = await callAnalysisFunction('ai-keyword-analysis', { days: 14 });
    results.push(keywordResult);

    // Small delay between calls to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate creative fatigue predictions (30 day lookback, all platforms)
    console.log('--- Step 2: Generating creative fatigue predictions ---');
    const creativeResult = await callAnalysisFunction('ai-creative-fatigue-analysis', { 
      days: 30, 
      platform: 'all' 
    });
    results.push(creativeResult);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate budget recommendations (30 day lookback)
    console.log('--- Step 3: Generating budget recommendations ---');
    const budgetResult = await callAnalysisFunction('ai-budget-analysis', { days: 30 });
    results.push(budgetResult);

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const totalRecommendations = results.reduce((sum, r) => sum + (r.count || 0), 0);

    console.log('=== RECOMMENDATION GENERATION COMPLETED ===');
    console.log(`Total duration: ${totalDuration}ms`);
    console.log(`Success: ${successCount}, Failed: ${failureCount}`);
    console.log(`Total recommendations generated: ${totalRecommendations}`);

    return new Response(JSON.stringify({
      success: failureCount === 0,
      totalDuration,
      successCount,
      failureCount,
      totalRecommendations,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Recommendation generation fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      results,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
