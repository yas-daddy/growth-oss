import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KeywordMetrics {
  keyword_id: string;
  keyword_text: string;
  match_type: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  taps: number;
  installs: number;
  ftds: number;
  bets: number;
  ttr: number;
  cpt: number;
  cpi: number;
  cpa_ftd: number;
  cpa_bet: number;
  bid_amount: number;
}

interface AIRecommendation {
  keyword_id: string;
  keyword_text: string;
  recommendation_type: 'increase_bid' | 'decrease_bid' | 'pause';
  confidence: number;
  reasoning: string;
  suggested_action: {
    type: string;
    current_value?: number;
    suggested_value?: number;
    change_percent?: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Authenticate user or service role (for cron-triggered calls from generate-recommendations)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Check if this is a service role call (from generate-recommendations orchestrator)
    const token = authHeader.replace('Bearer ', '');
    const isServiceRoleCall = token === SUPABASE_SERVICE_ROLE_KEY;
    
    let userId: string;
    
    if (isServiceRoleCall) {
      // Use admin user for cron-triggered calls
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')
        .limit(1)
        .single();
      
      if (!adminRole?.user_id) {
        return new Response(JSON.stringify({ error: 'No admin user found for service role call' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = adminRole.user_id;
      console.log('AI Keyword Analysis called via service role, using admin user');
    } else {
      // Verify the user token for non-service-role calls
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = user.id;
      console.log('AI Keyword Analysis called by user:', userId);
    }

    const { days = 14 } = await req.json().catch(() => ({}));

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`Fetching keyword data from ${startDateStr} to ${endDateStr}`);

    // Fetch keyword spend data
    const { data: keywordSpend, error: spendError } = await supabase
      .from('daily_apple_keyword_spend')
      .select('*')
      .gte('date', startDateStr)
      .lte('date', endDateStr);

    if (spendError) {
      throw new Error(`Failed to fetch keyword spend: ${spendError.message}`);
    }

    // Fetch AppsFlyer keyword events
    const { data: keywordEvents, error: eventsError } = await supabase
      .from('appsflyer_keyword_events')
      .select('*')
      .gte('event_date', startDateStr)
      .lte('event_date', endDateStr);

    if (eventsError) {
      throw new Error(`Failed to fetch keyword events: ${eventsError.message}`);
    }

    // Fetch keyword metadata
    const { data: keywords, error: keywordsError } = await supabase
      .from('apple_keywords')
      .select('keyword_id, keyword_text, match_type, bid_amount, campaign_name, status');

    if (keywordsError) {
      throw new Error(`Failed to fetch keywords: ${keywordsError.message}`);
    }

    // Aggregate data by keyword
    const keywordMap = new Map<string, KeywordMetrics>();

    // Process spend data
    for (const row of keywordSpend || []) {
      const existing = keywordMap.get(row.keyword_id) || {
        keyword_id: row.keyword_id,
        keyword_text: row.keyword_text,
        match_type: row.match_type || 'unknown',
        campaign_name: row.campaign_name || 'Unknown',
        spend: 0,
        impressions: 0,
        taps: 0,
        installs: 0,
        ftds: 0,
        bets: 0,
        ttr: 0,
        cpt: 0,
        cpi: 0,
        cpa_ftd: 0,
        cpa_bet: 0,
        bid_amount: 0,
      };

      existing.spend += Number(row.spend) || 0;
      existing.impressions += Number(row.impressions) || 0;
      existing.taps += Number(row.taps) || 0;
      existing.installs += Number(row.installs) || 0;

      keywordMap.set(row.keyword_id, existing);
    }

    // Process events data - match the actual event names in the database
    for (const event of keywordEvents || []) {
      const existing = keywordMap.get(event.keyword_id);
      if (existing) {
        if (event.event_name === 'first_time_deposit') {
          existing.ftds += event.event_count;
        } else if (event.event_name === 'bet_placed') {
          existing.bets += event.event_count;
        }
      }
    }

    // Add bid amounts from keywords table
    for (const kw of keywords || []) {
      const existing = keywordMap.get(kw.keyword_id);
      if (existing) {
        existing.bid_amount = Number(kw.bid_amount) || 0;
      }
    }

    // Calculate derived metrics
    const metricsArray: KeywordMetrics[] = [];
    for (const [, metrics] of keywordMap) {
      metrics.ttr = metrics.impressions > 0 ? (metrics.taps / metrics.impressions) * 100 : 0;
      metrics.cpt = metrics.taps > 0 ? metrics.spend / metrics.taps : 0;
      metrics.cpi = metrics.installs > 0 ? metrics.spend / metrics.installs : 0;
      metrics.cpa_ftd = metrics.ftds > 0 ? metrics.spend / metrics.ftds : 0;
      metrics.cpa_bet = metrics.bets > 0 ? metrics.spend / metrics.bets : 0;
      metricsArray.push(metrics);
    }

    // Sort by spend descending
    metricsArray.sort((a, b) => b.spend - a.spend);

    // Take top 50 keywords for analysis (to stay within token limits)
    const topKeywords = metricsArray.slice(0, 50);

    if (topKeywords.length === 0) {
      return new Response(JSON.stringify({ 
        recommendations: [],
        message: 'No keyword data available for analysis'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prepare data for AI with conversion rates
    const keywordSummary = topKeywords.map(k => ({
      keyword_id: k.keyword_id,
      keyword: k.keyword_text,
      match_type: k.match_type,
      campaign: k.campaign_name,
      spend: k.spend.toFixed(2),
      impressions: k.impressions,
      taps: k.taps,
      installs: k.installs,
      ftds: k.ftds,
      bets: k.bets,
      ttr_percent: k.ttr.toFixed(2),
      cpt: k.cpt.toFixed(2),
      cpi: k.cpi.toFixed(2),
      cpa_ftd: k.ftds > 0 ? k.cpa_ftd.toFixed(2) : 'N/A',
      cpa_bet: k.bets > 0 ? k.cpa_bet.toFixed(2) : 'N/A',
      cvr_install_to_ftd: k.installs > 0 ? ((k.ftds / k.installs) * 100).toFixed(2) + '%' : 'N/A',
      cvr_install_to_bet: k.installs > 0 ? ((k.bets / k.installs) * 100).toFixed(2) + '%' : 'N/A',
      current_bid: k.bid_amount.toFixed(2),
    }));

    // Calculate portfolio averages for context
    const totalSpend = metricsArray.reduce((sum, k) => sum + k.spend, 0);
    const totalInstalls = metricsArray.reduce((sum, k) => sum + k.installs, 0);
    const totalFtds = metricsArray.reduce((sum, k) => sum + k.ftds, 0);
    const totalBets = metricsArray.reduce((sum, k) => sum + k.bets, 0);
    const avgCpi = totalInstalls > 0 ? totalSpend / totalInstalls : 0;
    const avgCpaFtd = totalFtds > 0 ? totalSpend / totalFtds : 0;
    const avgCpaBet = totalBets > 0 ? totalSpend / totalBets : 0;
    const avgCvrInstallToFtd = totalInstalls > 0 ? (totalFtds / totalInstalls) * 100 : 0;
    const avgCvrInstallToBet = totalInstalls > 0 ? (totalBets / totalInstalls) * 100 : 0;

    const systemPrompt = `You are an expert Apple Search Ads analyst specializing in app monetization. Your PRIMARY focus is on downstream conversion metrics (FTDs and Bets), not just installs.

Portfolio Context (${days} day period):
- Total Keywords Analyzed: ${metricsArray.length}
- Total Spend: $${totalSpend.toFixed(2)}
- Total Installs: ${totalInstalls}
- Total FTDs (First Time Deposits): ${totalFtds}
- Total Bets Placed: ${totalBets}
- Average CPI: $${avgCpi.toFixed(2)}
- Average CPA (FTD): $${avgCpaFtd.toFixed(2)}
- Average CPA (Bet): $${avgCpaBet.toFixed(2)}
- Average Install→FTD CVR: ${avgCvrInstallToFtd.toFixed(2)}%
- Average Install→Bet CVR: ${avgCvrInstallToBet.toFixed(2)}%

IMPORTANT: Prioritize recommendations based on FTD and Bet metrics over install metrics. A keyword with fewer installs but better FTD/Bet conversion is more valuable than one with many installs but poor downstream conversion.

You can ONLY provide these 3 types of actionable recommendations:

1. INCREASE_BID: Keywords showing strong downstream conversion (FTDs/Bets relative to installs) but limited scale - they need more impression share. Also use this for keywords with strong CPA (FTD) below $${(avgCpaFtd * 0.8).toFixed(2)} OR high Install→FTD CVR (>${(avgCvrInstallToFtd * 1.3).toFixed(2)}%) that deserve more budget.

2. DECREASE_BID: Keywords with poor downstream conversion (Install→FTD CVR <${(avgCvrInstallToFtd * 0.5).toFixed(2)}% or CPA FTD >${(avgCpaFtd * 1.5).toFixed(2)}) despite decent install volume

3. PAUSE: Keywords with significant spend (>$50) but ZERO FTDs, or very poor Install→FTD conversion (<${(avgCvrInstallToFtd * 0.25).toFixed(2)}%) with substantial spend

When analyzing, consider:
- FTD conversion rate is the most important efficiency metric
- Bet volume indicates user quality and long-term value
- Low CPA (FTD) is better than low CPI if downstream conversion is strong
- Keywords bringing high-quality users (high FTD/Bet rates) are more valuable even at higher CPI

Return 5-10 most impactful recommendations. ONLY use increase_bid, decrease_bid, or pause as recommendation types.`;

    const userPrompt = `Analyze these Apple Search Ads keywords and provide recommendations focused on FTD and Bet optimization:

${JSON.stringify(keywordSummary, null, 2)}

Prioritize recommendations that will maximize FTDs and Bets, not just installs. Consider downstream conversion rates (cvr_install_to_ftd, cvr_install_to_bet) as primary decision factors.`;

    // Call Lovable AI with tool calling for structured output
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'provide_recommendations',
              description: 'Provide keyword optimization recommendations',
              parameters: {
                type: 'object',
                properties: {
                  recommendations: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        keyword_id: { type: 'string', description: 'The keyword ID' },
                        keyword_text: { type: 'string', description: 'The keyword text' },
                        recommendation_type: { 
                          type: 'string', 
                          enum: ['increase_bid', 'decrease_bid', 'pause'],
                          description: 'Type of recommendation - only actionable types allowed'
                        },
                        confidence: { 
                          type: 'number', 
                          description: 'Confidence score 0-100'
                        },
                        reasoning: { 
                          type: 'string', 
                          description: 'Clear explanation of why this recommendation is made'
                        },
                        suggested_action: {
                          type: 'object',
                          properties: {
                            type: { type: 'string' },
                            current_value: { type: 'number' },
                            suggested_value: { type: 'number' },
                            change_percent: { type: 'number' }
                          },
                          required: ['type']
                        }
                      },
                      required: ['keyword_id', 'keyword_text', 'recommendation_type', 'confidence', 'reasoning', 'suggested_action']
                    }
                  }
                },
                required: ['recommendations']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'provide_recommendations' } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits depleted. Please add funds to continue.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error('Failed to get AI recommendations');
    }

    const aiData = await aiResponse.json();
    console.log('AI response:', JSON.stringify(aiData, null, 2));

    // Extract recommendations from tool call
    let recommendations: AIRecommendation[] = [];
    
    if (aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      const args = JSON.parse(aiData.choices[0].message.tool_calls[0].function.arguments);
      recommendations = args.recommendations || [];
    }

    // Store recommendations in database
    if (recommendations.length > 0) {
      // First, mark old pending recommendations as dismissed
      await supabase
        .from('ai_keyword_recommendations')
        .update({ status: 'dismissed' })
        .eq('user_id', userId)
        .eq('status', 'pending');

      // Insert new recommendations
      const insertData = recommendations.map(rec => {
        // Get the original keyword data to use the clean keyword_text (without match type prefix)
        const originalKeyword = keywordSummary.find(k => k.keyword_id === rec.keyword_id);
        return {
          user_id: userId,
          keyword_id: rec.keyword_id,
          keyword_text: originalKeyword?.keyword || rec.keyword_text,
          recommendation_type: rec.recommendation_type,
          confidence: rec.confidence,
          reasoning: rec.reasoning,
          suggested_action: rec.suggested_action,
          metrics_snapshot: originalKeyword || null,
          status: 'pending',
        };
      });

      const { error: insertError } = await supabase
        .from('ai_keyword_recommendations')
        .insert(insertData);

      if (insertError) {
        console.error('Failed to store recommendations:', insertError);
      }
    }

    return new Response(JSON.stringify({
      recommendations,
      keywords_analyzed: metricsArray.length,
      date_range: { start: startDateStr, end: endDateStr },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('AI keyword analysis error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
