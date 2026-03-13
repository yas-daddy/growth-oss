import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DailyMetrics {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  installs: number;
  registrations: number;
  conversions: number;
  cpi: number;
  cpr: number; // Cost per registration
  cpc_result: number; // Cost per conversion/result
}

interface CreativeTimeSeries {
  creative_id: string;
  creative_name: string;
  platform: 'meta' | 'moloco';
  thumbnail_url?: string;
  total_spend: number;
  total_impressions: number;
  total_installs: number;
  total_registrations: number;
  total_conversions: number;
  days_active: number;
  daily_metrics: DailyMetrics[];
  trend_ctr: number; // Slope of CTR over time
  trend_cpi: number; // Slope of CPI over time
  trend_cpr: number; // Slope of CPR over time
  trend_cpc_result: number; // Slope of cost per result over time
  avg_ctr_first_week: number;
  avg_ctr_last_week: number;
  ctr_decline_percent: number;
  avg_cpi_first_week: number;
  avg_cpi_last_week: number;
  cpi_increase_percent: number;
  avg_cpr_first_week: number;
  avg_cpr_last_week: number;
  cpr_increase_percent: number;
}

interface FatiguePrediction {
  creative_id: string;
  creative_name: string;
  platform: 'meta' | 'moloco';
  fatigue_status: 'healthy' | 'early_warning' | 'fatiguing' | 'fatigued';
  confidence: number;
  days_until_fatigue: number | null;
  reasoning: string;
  recommended_action: string;
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
      console.log('AI Creative Fatigue Analysis called via service role, using admin user');
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
      console.log('AI Creative Fatigue Analysis called by user:', userId);
    }

    const { days = 30, platform = 'all' } = await req.json().catch(() => ({}));

    // Calculate date range
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1); // Yesterday
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`Analyzing creative fatigue from ${startDateStr} to ${endDateStr}`);

    const creativeTimeSeries: CreativeTimeSeries[] = [];

    // Fetch Meta ad daily data
    if (platform === 'all' || platform === 'meta') {
      const { data: metaData, error: metaError } = await supabase
        .from('daily_meta_ad_spend')
        .select('ad_id, ad_name, date, spend, impressions, clicks, ctr, registrations, conversions')
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .gt('impressions', 0)
        .order('date', { ascending: true });

      if (metaError) {
        console.error('Meta fetch error:', metaError);
      } else if (metaData) {
        // Group by ad_id
        const metaByAd = new Map<string, { name: string; metrics: DailyMetrics[] }>();
        
        for (const row of metaData) {
          if (!metaByAd.has(row.ad_id)) {
            metaByAd.set(row.ad_id, { name: row.ad_name, metrics: [] });
          }
          const entry = metaByAd.get(row.ad_id)!;
          const spend = Number(row.spend) || 0;
          const registrations = Number(row.registrations) || 0;
          const conversions = Number(row.conversions) || 0;
          // Meta doesn't have installs directly, but registrations serve as a proxy
          const installs = registrations; // Use registrations as install proxy for Meta
          
          entry.metrics.push({
            date: row.date,
            spend,
            impressions: Number(row.impressions) || 0,
            clicks: Number(row.clicks) || 0,
            ctr: Number(row.ctr) || (row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0),
            installs,
            registrations,
            conversions,
            cpi: installs > 0 ? spend / installs : 0,
            cpr: registrations > 0 ? spend / registrations : 0,
            cpc_result: conversions > 0 ? spend / conversions : 0,
          });
        }

        for (const [adId, data] of metaByAd) {
          if (data.metrics.length < 7) continue; // Need at least 7 days of data

          const totalSpend = data.metrics.reduce((sum, m) => sum + m.spend, 0);
          const totalImpressions = data.metrics.reduce((sum, m) => sum + m.impressions, 0);
          const totalInstalls = data.metrics.reduce((sum, m) => sum + m.installs, 0);
          const totalRegistrations = data.metrics.reduce((sum, m) => sum + m.registrations, 0);
          const totalConversions = data.metrics.reduce((sum, m) => sum + m.conversions, 0);
          
          // Calculate CTR trends
          const firstWeekMetrics = data.metrics.slice(0, 7);
          const lastWeekMetrics = data.metrics.slice(-7);
          
          const avgCtrFirstWeek = firstWeekMetrics.reduce((sum, m) => sum + m.ctr, 0) / firstWeekMetrics.length;
          const avgCtrLastWeek = lastWeekMetrics.reduce((sum, m) => sum + m.ctr, 0) / lastWeekMetrics.length;
          const ctrDeclinePercent = avgCtrFirstWeek > 0 
            ? ((avgCtrFirstWeek - avgCtrLastWeek) / avgCtrFirstWeek) * 100 
            : 0;

          // Calculate CPI trends (using non-zero values only)
          const firstWeekCpiValues = firstWeekMetrics.map(m => m.cpi).filter(v => v > 0);
          const lastWeekCpiValues = lastWeekMetrics.map(m => m.cpi).filter(v => v > 0);
          const avgCpiFirstWeek = firstWeekCpiValues.length > 0 ? firstWeekCpiValues.reduce((a, b) => a + b, 0) / firstWeekCpiValues.length : 0;
          const avgCpiLastWeek = lastWeekCpiValues.length > 0 ? lastWeekCpiValues.reduce((a, b) => a + b, 0) / lastWeekCpiValues.length : 0;
          const cpiIncreasePercent = avgCpiFirstWeek > 0 
            ? ((avgCpiLastWeek - avgCpiFirstWeek) / avgCpiFirstWeek) * 100 
            : 0;

          // Calculate CPR (cost per registration) trends
          const firstWeekCprValues = firstWeekMetrics.map(m => m.cpr).filter(v => v > 0);
          const lastWeekCprValues = lastWeekMetrics.map(m => m.cpr).filter(v => v > 0);
          const avgCprFirstWeek = firstWeekCprValues.length > 0 ? firstWeekCprValues.reduce((a, b) => a + b, 0) / firstWeekCprValues.length : 0;
          const avgCprLastWeek = lastWeekCprValues.length > 0 ? lastWeekCprValues.reduce((a, b) => a + b, 0) / lastWeekCprValues.length : 0;
          const cprIncreasePercent = avgCprFirstWeek > 0 
            ? ((avgCprLastWeek - avgCprFirstWeek) / avgCprFirstWeek) * 100 
            : 0;

          // Calculate trend slopes
          const trendCtr = calculateTrend(data.metrics.map(m => m.ctr));
          const trendCpi = calculateTrend(data.metrics.map(m => m.cpi).filter(v => v > 0));
          const trendCpr = calculateTrend(data.metrics.map(m => m.cpr).filter(v => v > 0));
          const trendCpcResult = calculateTrend(data.metrics.map(m => m.cpc_result).filter(v => v > 0));

          creativeTimeSeries.push({
            creative_id: adId,
            creative_name: data.name,
            platform: 'meta',
            total_spend: totalSpend,
            total_impressions: totalImpressions,
            total_installs: totalInstalls,
            total_registrations: totalRegistrations,
            total_conversions: totalConversions,
            days_active: data.metrics.length,
            daily_metrics: data.metrics,
            trend_ctr: trendCtr,
            trend_cpi: trendCpi,
            trend_cpr: trendCpr,
            trend_cpc_result: trendCpcResult,
            avg_ctr_first_week: avgCtrFirstWeek,
            avg_ctr_last_week: avgCtrLastWeek,
            ctr_decline_percent: ctrDeclinePercent,
            avg_cpi_first_week: avgCpiFirstWeek,
            avg_cpi_last_week: avgCpiLastWeek,
            cpi_increase_percent: cpiIncreasePercent,
            avg_cpr_first_week: avgCprFirstWeek,
            avg_cpr_last_week: avgCprLastWeek,
            cpr_increase_percent: cprIncreasePercent,
          });
        }
      }
    }

    // Fetch Moloco creative daily data
    if (platform === 'all' || platform === 'moloco') {
      const { data: molocoData, error: molocoError } = await supabase
        .from('daily_moloco_creative_spend')
        .select('creative_id, creative_name, date, spend, impressions, clicks, installs')
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .gt('impressions', 0)
        .order('date', { ascending: true });

      if (molocoError) {
        console.error('Moloco fetch error:', molocoError);
      } else if (molocoData) {
        const molocoByCreative = new Map<string, { name: string; metrics: DailyMetrics[] }>();
        
        for (const row of molocoData) {
          if (!molocoByCreative.has(row.creative_id)) {
            molocoByCreative.set(row.creative_id, { name: row.creative_name, metrics: [] });
          }
          const entry = molocoByCreative.get(row.creative_id)!;
          const spend = Number(row.spend) || 0;
          const installs = Number(row.installs) || 0;
          const ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
          const cpi = installs > 0 ? spend / installs : 0;
          
          entry.metrics.push({
            date: row.date,
            spend,
            impressions: Number(row.impressions) || 0,
            clicks: Number(row.clicks) || 0,
            ctr,
            installs,
            registrations: 0, // Moloco doesn't have registrations
            conversions: installs, // Use installs as conversions for Moloco
            cpi,
            cpr: 0, // Not available for Moloco
            cpc_result: cpi, // Use CPI as cost per result for Moloco
          });
        }

        for (const [creativeId, data] of molocoByCreative) {
          if (data.metrics.length < 7) continue;

          const totalSpend = data.metrics.reduce((sum, m) => sum + m.spend, 0);
          const totalImpressions = data.metrics.reduce((sum, m) => sum + m.impressions, 0);
          const totalInstalls = data.metrics.reduce((sum, m) => sum + m.installs, 0);
          
          const firstWeekMetrics = data.metrics.slice(0, 7);
          const lastWeekMetrics = data.metrics.slice(-7);
          
          const avgCtrFirstWeek = firstWeekMetrics.reduce((sum, m) => sum + m.ctr, 0) / firstWeekMetrics.length;
          const avgCtrLastWeek = lastWeekMetrics.reduce((sum, m) => sum + m.ctr, 0) / lastWeekMetrics.length;
          const ctrDeclinePercent = avgCtrFirstWeek > 0 
            ? ((avgCtrFirstWeek - avgCtrLastWeek) / avgCtrFirstWeek) * 100 
            : 0;

          // Calculate CPI trends
          const firstWeekCpiValues = firstWeekMetrics.map(m => m.cpi).filter(v => v > 0);
          const lastWeekCpiValues = lastWeekMetrics.map(m => m.cpi).filter(v => v > 0);
          const avgCpiFirstWeek = firstWeekCpiValues.length > 0 ? firstWeekCpiValues.reduce((a, b) => a + b, 0) / firstWeekCpiValues.length : 0;
          const avgCpiLastWeek = lastWeekCpiValues.length > 0 ? lastWeekCpiValues.reduce((a, b) => a + b, 0) / lastWeekCpiValues.length : 0;
          const cpiIncreasePercent = avgCpiFirstWeek > 0 
            ? ((avgCpiLastWeek - avgCpiFirstWeek) / avgCpiFirstWeek) * 100 
            : 0;

          const trendCtr = calculateTrend(data.metrics.map(m => m.ctr));
          const trendCpi = calculateTrend(data.metrics.map(m => m.cpi).filter(v => v > 0));

          creativeTimeSeries.push({
            creative_id: creativeId,
            creative_name: data.name,
            platform: 'moloco',
            total_spend: totalSpend,
            total_impressions: totalImpressions,
            total_installs: totalInstalls,
            total_registrations: 0,
            total_conversions: totalInstalls,
            days_active: data.metrics.length,
            daily_metrics: data.metrics,
            trend_ctr: trendCtr,
            trend_cpi: trendCpi,
            trend_cpr: 0,
            trend_cpc_result: trendCpi,
            avg_ctr_first_week: avgCtrFirstWeek,
            avg_ctr_last_week: avgCtrLastWeek,
            ctr_decline_percent: ctrDeclinePercent,
            avg_cpi_first_week: avgCpiFirstWeek,
            avg_cpi_last_week: avgCpiLastWeek,
            cpi_increase_percent: cpiIncreasePercent,
            avg_cpr_first_week: 0,
            avg_cpr_last_week: 0,
            cpr_increase_percent: 0,
          });
        }
      }
    }

    // Sort by spend and take top 30 for analysis
    creativeTimeSeries.sort((a, b) => b.total_spend - a.total_spend);
    const topCreatives = creativeTimeSeries.slice(0, 30);

    if (topCreatives.length === 0) {
      return new Response(JSON.stringify({ 
        predictions: [],
        message: 'No creative data with sufficient history for fatigue analysis'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prepare summary for AI
    const creativeSummary = topCreatives.map(c => ({
      creative_id: c.creative_id,
      creative_name: c.creative_name,
      platform: c.platform,
      days_active: c.days_active,
      total_spend: c.total_spend.toFixed(2),
      total_impressions: c.total_impressions,
      total_installs: c.total_installs,
      total_registrations: c.total_registrations,
      total_conversions: c.total_conversions,
      // CTR metrics
      avg_ctr_first_week: c.avg_ctr_first_week.toFixed(3),
      avg_ctr_last_week: c.avg_ctr_last_week.toFixed(3),
      ctr_decline_percent: c.ctr_decline_percent.toFixed(1),
      trend_ctr_slope: c.trend_ctr.toFixed(4),
      // CPI metrics (Cost Per Install)
      avg_cpi_first_week: c.avg_cpi_first_week > 0 ? c.avg_cpi_first_week.toFixed(2) : 'N/A',
      avg_cpi_last_week: c.avg_cpi_last_week > 0 ? c.avg_cpi_last_week.toFixed(2) : 'N/A',
      cpi_increase_percent: c.cpi_increase_percent !== 0 ? c.cpi_increase_percent.toFixed(1) : 'N/A',
      trend_cpi_slope: c.trend_cpi.toFixed(4),
      // CPR metrics (Cost Per Registration) - Meta only
      avg_cpr_first_week: c.avg_cpr_first_week > 0 ? c.avg_cpr_first_week.toFixed(2) : 'N/A',
      avg_cpr_last_week: c.avg_cpr_last_week > 0 ? c.avg_cpr_last_week.toFixed(2) : 'N/A',
      cpr_increase_percent: c.cpr_increase_percent !== 0 ? c.cpr_increase_percent.toFixed(1) : 'N/A',
      trend_cpr_slope: c.trend_cpr.toFixed(4),
      // Cost per result trend
      trend_cpc_result_slope: c.trend_cpc_result.toFixed(4),
    }));

    const systemPrompt = `You are an expert ad creative performance analyst specializing in creative fatigue detection for mobile app marketing.

Creative fatigue occurs when an ad's performance degrades over time due to audience oversaturation. 

KEY PERFORMANCE INDICATORS (in order of importance):
1. CPI (Cost Per Install) - Primary efficiency metric. Rising CPI indicates fatigue.
2. CPR (Cost Per Registration) - For Meta ads, measures signup efficiency. Rising CPR is a strong fatigue signal.
3. Cost Per Result/Conversion - Overall conversion efficiency. Rising costs indicate declining performance.
4. CTR (Click-Through Rate) - Leading indicator. Declining CTR often precedes rising costs.

FATIGUE STATUS DEFINITIONS:
- healthy: Costs stable or improving, CTR stable. No signs of fatigue.
- early_warning: CPI/CPR starting to rise (5-15% increase) OR CTR declining (5-15%). Action needed within 1-2 weeks.
- fatiguing: Significant cost increase (15-30%) OR CTR decline (15-30%). Should rotate soon.
- fatigued: Severe cost increase (>30%) OR CTR decline (>30%). Immediate rotation recommended.

ANALYSIS GUIDELINES:
1. PRIORITIZE cost metrics (CPI, CPR, Cost Per Result) over CTR when both are available
2. Compare first week vs last week metrics to detect trends
3. Look at trend slopes: positive CPI/CPR slope = worsening, negative CTR slope = worsening
4. Consider days active - older creatives more likely to fatigue
5. High-spend creatives fatigue faster due to more impressions served
6. For Meta: focus on CPR (registrations) as the key conversion event
7. For Moloco: focus on CPI (installs) as the key conversion event
8. A creative with rising costs but stable CTR is STILL fatiguing
9. Even healthy creatives with high spend should be monitored

For each creative, provide:
- Fatigue status classification based primarily on cost efficiency trends
- Confidence level (0-100)
- Estimated days until fatigue reaches critical levels (null if healthy)
- Clear reasoning citing specific cost and engagement metrics
- Specific recommended action`;

    const userPrompt = `Analyze these ad creatives for fatigue indicators and predict which ones need rotation.

IMPORTANT: Prioritize cost metrics (CPI, CPR, Cost Per Result) over CTR. Rising acquisition costs are the clearest signal of creative fatigue.

Creative data:
${JSON.stringify(creativeSummary, null, 2)}

For each creative, classify its fatigue status and provide actionable recommendations. Focus on creatives with rising costs or declining engagement that need attention.`;

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
              name: 'provide_fatigue_predictions',
              description: 'Provide creative fatigue predictions',
              parameters: {
                type: 'object',
                properties: {
                  predictions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        creative_id: { type: 'string' },
                        creative_name: { type: 'string' },
                        platform: { type: 'string', enum: ['meta', 'moloco'] },
                        fatigue_status: { 
                          type: 'string', 
                          enum: ['healthy', 'early_warning', 'fatiguing', 'fatigued']
                        },
                        confidence: { type: 'number' },
                        days_until_fatigue: { type: ['number', 'null'] },
                        reasoning: { type: 'string' },
                        recommended_action: { type: 'string' }
                      },
                      required: ['creative_id', 'creative_name', 'platform', 'fatigue_status', 'confidence', 'reasoning', 'recommended_action']
                    }
                  }
                },
                required: ['predictions']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'provide_fatigue_predictions' } },
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
      throw new Error('Failed to get AI predictions');
    }

    const aiData = await aiResponse.json();
    console.log('AI response:', JSON.stringify(aiData, null, 2));

    let predictions: FatiguePrediction[] = [];
    
    if (aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      const args = JSON.parse(aiData.choices[0].message.tool_calls[0].function.arguments);
      predictions = args.predictions || [];
    }

    // Store predictions in database
    if (predictions.length > 0) {
      // Mark old active predictions as dismissed
      await supabase
        .from('ai_creative_fatigue_predictions')
        .update({ status: 'dismissed', updated_at: new Date().toISOString() })
        .eq('status', 'active');

      // Insert new predictions
      const insertData = predictions.map(pred => {
        const creative = topCreatives.find(c => c.creative_id === pred.creative_id);
        return {
          user_id: userId,
          creative_id: pred.creative_id,
          creative_name: pred.creative_name,
          platform: pred.platform,
          fatigue_status: pred.fatigue_status,
          confidence: pred.confidence,
          days_until_fatigue: pred.days_until_fatigue,
          reasoning: pred.reasoning,
          recommended_action: pred.recommended_action,
          trend_data: creative ? {
            avg_ctr_first_week: creative.avg_ctr_first_week,
            avg_ctr_last_week: creative.avg_ctr_last_week,
            ctr_decline_percent: creative.ctr_decline_percent,
            trend_ctr_slope: creative.trend_ctr,
          } : null,
          metrics_snapshot: creative ? {
            total_spend: creative.total_spend,
            total_impressions: creative.total_impressions,
            days_active: creative.days_active,
          } : null,
          status: 'active',
        };
      });

      const { error: insertError } = await supabase
        .from('ai_creative_fatigue_predictions')
        .insert(insertData);

      if (insertError) {
        console.error('Failed to store predictions:', insertError);
      }
    }

    return new Response(JSON.stringify({
      predictions,
      creatives_analyzed: topCreatives.length,
      date_range: { start: startDateStr, end: endDateStr },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Creative fatigue analysis error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Calculate linear regression slope for trend detection
function calculateTrend(values: number[]): number {
  if (values.length < 2) return 0;
  
  const n = values.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return isNaN(slope) ? 0 : slope;
}
