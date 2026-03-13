import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChannelMetrics {
  channel: string;
  spend: number;
  ftds: number;
  cpa: number;
  installs: number;
  cvr_to_ftd: number;
}

interface BudgetRecommendation {
  entity_type: 'channel' | 'campaign';
  entity_id: string;
  entity_name: string;
  channel: string;
  action_type: 'increase' | 'decrease' | 'reallocate' | 'pause';
  confidence: number;
  reasoning: string;
  recommended_action: string;
  current_spend: number;
  suggested_change: number;
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
      console.log('AI Budget Analysis called via service role, using admin user');
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
      console.log('AI Budget Analysis called by user:', userId);
    }

    const { days = 30 } = await req.json().catch(() => ({}));

    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`Analyzing budget allocation from ${startDateStr} to ${endDateStr}`);

    // Fetch recently actioned recommendations (applied/dismissed in last 7 days)
    // to avoid regenerating the same recommendations
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString();

    const { data: recentlyActioned, error: actionedError } = await supabase
      .from('ai_budget_recommendations')
      .select('entity_id, entity_type, action_type')
      .in('status', ['applied', 'dismissed'])
      .gte('updated_at', sevenDaysAgoStr);

    if (actionedError) {
      console.error('Failed to fetch recently actioned:', actionedError);
    }

    // Create a set of recently actioned entity keys for quick lookup
    const recentlyActionedKeys = new Set(
      (recentlyActioned || []).map(r => `${r.entity_type}:${r.entity_id}:${r.action_type}`)
    );
    console.log(`Found ${recentlyActionedKeys.size} recently actioned recommendations to skip`);

    // Fetch ad spend by platform
    const { data: adSpend, error: spendError } = await supabase
      .from('daily_ad_spend')
      .select('platform, spend, installs, date')
      .gte('date', startDateStr)
      .lte('date', endDateStr);

    if (spendError) {
      throw new Error(`Failed to fetch ad spend: ${spendError.message}`);
    }

    // Fetch FTD events by channel
    const { data: ftdEvents, error: ftdError } = await supabase
      .from('appsflyer_events')
      .select('media_source, event_count, event_date')
      .eq('event_name', 'first_time_deposit')
      .gte('event_date', startDateStr)
      .lte('event_date', endDateStr);

    if (ftdError) {
      throw new Error(`Failed to fetch FTD events: ${ftdError.message}`);
    }

    // Fetch affiliate spend
    const { data: affiliateSpend, error: affError } = await supabase
      .from('daily_affiliate_spend')
      .select('affiliate_id, spend, ftds, date')
      .gte('date', startDateStr)
      .lte('date', endDateStr);

    // Channel name mapping
    const channelMap: Record<string, string> = {
      'meta': 'Facebook Ads',
      'moloco': 'Moloco',
      'apple': 'Apple Search Ads',
      'Facebook Ads': 'Facebook Ads',
      'Apple Search Ads': 'Apple Search Ads',
    };

    // Aggregate by channel
    const channelMetrics = new Map<string, ChannelMetrics>();

    // Process ad spend
    for (const row of adSpend || []) {
      const channel = row.platform.toLowerCase();
      const existing = channelMetrics.get(channel) || {
        channel,
        spend: 0,
        ftds: 0,
        cpa: 0,
        installs: 0,
        cvr_to_ftd: 0,
      };
      existing.spend += Number(row.spend) || 0;
      existing.installs += Number(row.installs) || 0;
      channelMetrics.set(channel, existing);
    }

    // Process FTD events - map to channels
    for (const event of ftdEvents || []) {
      let channel = event.media_source?.toLowerCase() || 'organic';
      // Normalize channel names (AppsFlyer uses different naming conventions)
      if (channel === 'facebook ads' || channel === 'facebook') channel = 'meta';
      if (channel === 'apple search ads') channel = 'apple';
      if (channel === 'moloco_int' || channel.includes('moloco')) channel = 'moloco';
      
      const existing = channelMetrics.get(channel);
      if (existing) {
        existing.ftds += event.event_count || 0;
      }
    }

    // Add affiliate as a channel
    let totalAffiliateSpend = 0;
    let totalAffiliateFtds = 0;
    for (const row of affiliateSpend || []) {
      totalAffiliateSpend += Number(row.spend) || 0;
      totalAffiliateFtds += Number(row.ftds) || 0;
    }
    if (totalAffiliateSpend > 0) {
      channelMetrics.set('affiliates', {
        channel: 'affiliates',
        spend: totalAffiliateSpend,
        ftds: totalAffiliateFtds,
        cpa: totalAffiliateFtds > 0 ? totalAffiliateSpend / totalAffiliateFtds : 0,
        installs: 0,
        cvr_to_ftd: 0,
      });
    }

    // Calculate CPA and CVR for each channel
    const channelArray: ChannelMetrics[] = [];
    for (const [, metrics] of channelMetrics) {
      metrics.cpa = metrics.ftds > 0 ? metrics.spend / metrics.ftds : 0;
      metrics.cvr_to_ftd = metrics.installs > 0 ? (metrics.ftds / metrics.installs) * 100 : 0;
      if (metrics.spend > 0) {
        channelArray.push(metrics);
      }
    }

    // Sort by spend
    channelArray.sort((a, b) => b.spend - a.spend);

    if (channelArray.length === 0) {
      return new Response(JSON.stringify({ 
        recommendations: [],
        message: 'No spend data available for analysis'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate portfolio totals
    const totalSpend = channelArray.reduce((sum, c) => sum + c.spend, 0);
    const totalFtds = channelArray.reduce((sum, c) => sum + c.ftds, 0);
    const blendedCpa = totalFtds > 0 ? totalSpend / totalFtds : 0;

    const channelSummary = channelArray.map(c => ({
      channel: c.channel,
      spend: c.spend.toFixed(2),
      spend_share: ((c.spend / totalSpend) * 100).toFixed(1) + '%',
      ftds: c.ftds,
      cpa: c.cpa.toFixed(2),
      installs: c.installs,
      cvr_to_ftd: c.cvr_to_ftd.toFixed(2) + '%',
      efficiency_vs_avg: c.cpa > 0 && blendedCpa > 0 
        ? (((blendedCpa - c.cpa) / blendedCpa) * 100).toFixed(1) + '%'
        : 'N/A',
    }));

    const systemPrompt = `You are an expert marketing budget allocation analyst. Your goal is to identify opportunities to reallocate budget from underperforming channels/campaigns to better-performing ones.

Portfolio Summary (${days} days):
- Total Spend: £${totalSpend.toFixed(2)}
- Total FTDs: ${totalFtds}
- Blended CPA: £${blendedCpa.toFixed(2)}

ANALYSIS FRAMEWORK:

1. MARGINAL EFFICIENCY: Identify channels with CPAs significantly above/below the blended average
   - Channels with CPA <${(blendedCpa * 0.7).toFixed(2)} are highly efficient - recommend INCREASE
   - Channels with CPA >${(blendedCpa * 1.5).toFixed(2)} are inefficient - recommend DECREASE or PAUSE

2. WASTED SPEND: Flag any channel with:
   - Zero FTDs despite significant spend (>£100)
   - CPA more than 2x the blended average

3. REALLOCATION OPPORTUNITIES: Calculate how much budget could be shifted from low-efficiency to high-efficiency channels

4. PAUSE RECOMMENDATIONS: Only recommend pausing if truly non-performing

Return actionable recommendations with specific percentages for budget changes.
Confidence should reflect data quality: higher spend = higher confidence in the recommendation.`;

    const userPrompt = `Analyze this channel performance data and provide budget allocation recommendations:

${JSON.stringify(channelSummary, null, 2)}

Focus on:
1. Which channels should receive more budget (and by what %)?
2. Which channels should have budget reduced (and by what %)?
3. Any channels that should be paused entirely?
4. Specific reallocation suggestions (e.g., "shift 20% of Channel A budget to Channel B")`;

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
              name: 'provide_budget_recommendations',
              description: 'Provide budget allocation recommendations',
              parameters: {
                type: 'object',
                properties: {
                  recommendations: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        entity_type: { type: 'string', enum: ['channel'] },
                        entity_id: { type: 'string' },
                        entity_name: { type: 'string' },
                        channel: { type: 'string' },
                        action_type: { 
                          type: 'string', 
                          enum: ['increase', 'decrease', 'reallocate', 'pause']
                        },
                        confidence: { type: 'number' },
                        reasoning: { type: 'string' },
                        recommended_action: { type: 'string' },
                        current_spend: { type: 'number' },
                        suggested_change: { type: 'number', description: 'Percentage change, e.g., 20 for +20%, -30 for -30%' }
                      },
                      required: ['entity_type', 'entity_id', 'entity_name', 'channel', 'action_type', 'confidence', 'reasoning', 'recommended_action', 'current_spend', 'suggested_change']
                    }
                  }
                },
                required: ['recommendations']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'provide_budget_recommendations' } },
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

    let recommendations: BudgetRecommendation[] = [];
    
    if (aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      const args = JSON.parse(aiData.choices[0].message.tool_calls[0].function.arguments);
      recommendations = args.recommendations || [];
    }

    // Filter out recommendations for entities that were recently actioned (within 7 days)
    const filteredRecommendations = recommendations.filter(rec => {
      const key = `${rec.entity_type}:${rec.entity_id}:${rec.action_type}`;
      const isRecentlyActioned = recentlyActionedKeys.has(key);
      if (isRecentlyActioned) {
        console.log(`Skipping recommendation for ${rec.entity_name} (${rec.action_type}) - recently actioned`);
      }
      return !isRecentlyActioned;
    });

    console.log(`Filtered ${recommendations.length - filteredRecommendations.length} recommendations that were recently actioned`);
    recommendations = filteredRecommendations;

    // Store recommendations
    if (recommendations.length > 0) {
      // Mark old pending recommendations as dismissed
      await supabase
        .from('ai_budget_recommendations')
        .update({ status: 'dismissed', updated_at: new Date().toISOString() })
        .eq('status', 'pending');

      const insertData = recommendations.map(rec => ({
        user_id: userId,
        entity_type: rec.entity_type,
        entity_id: rec.entity_id,
        entity_name: rec.entity_name,
        channel: rec.channel,
        action_type: rec.action_type,
        // Convert confidence from 0-1 scale to 0-100 integer if needed
        confidence: rec.confidence <= 1 ? Math.round(rec.confidence * 100) : Math.round(rec.confidence),
        reasoning: rec.reasoning,
        recommended_action: rec.recommended_action,
        current_spend: rec.current_spend,
        suggested_change: rec.suggested_change,
        metrics_snapshot: channelSummary.find(c => c.channel === rec.channel) || null,
        status: 'pending',
      }));

      const { error: insertError } = await supabase
        .from('ai_budget_recommendations')
        .insert(insertData);

      if (insertError) {
        console.error('Failed to store recommendations:', insertError);
      }
    }

    return new Response(JSON.stringify({
      recommendations,
      channels_analyzed: channelArray.length,
      date_range: { start: startDateStr, end: endDateStr },
      portfolio_summary: {
        total_spend: totalSpend,
        total_ftds: totalFtds,
        blended_cpa: blendedCpa,
      },
      skipped_count: (aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments 
        ? JSON.parse(aiData.choices[0].message.tool_calls[0].function.arguments).recommendations?.length || 0 
        : 0) - recommendations.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Budget analysis error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
