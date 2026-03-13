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
    const metaAccessToken = Deno.env.get('META_ACCESS_TOKEN');
    let metaAdAccountId = Deno.env.get('META_AD_ACCOUNT_ID');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (metaAdAccountId && !metaAdAccountId.startsWith('act_')) {
      metaAdAccountId = `act_${metaAdAccountId}`;
    }

    if (!metaAccessToken || !metaAdAccountId) {
      console.error('Missing Meta credentials');
      return new Response(
        JSON.stringify({ error: 'Meta credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify user auth
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role
    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!userRole) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body for date range and campaign filter
    const { startDate, endDate, campaignId } = await req.json().catch(() => ({}));
    
    // Default to last 7 days if not specified
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d.toISOString().split('T')[0];
    })();

    console.log(`Fetching demographics from ${start} to ${end}, campaign: ${campaignId || 'all'}`);

    // Build filtering parameter
    let filteringParam = '';
    if (campaignId) {
      filteringParam = `&filtering=[{"field":"campaign.id","operator":"EQUAL","value":"${campaignId}"}]`;
    }

    // Fetch age breakdown
    const ageUrl = `https://graph.facebook.com/v21.0/${metaAdAccountId}/insights?` +
      `access_token=${metaAccessToken}` +
      `&fields=spend,impressions,clicks,reach,cpm,actions,cost_per_action_type` +
      `&breakdowns=age` +
      `&time_range={"since":"${start}","until":"${end}"}` +
      `&level=account` +
      filteringParam;

    const ageResponse = await fetch(ageUrl);
    const ageData = await ageResponse.json();

    if (ageData.error) {
      console.error('Meta API error (age):', ageData.error);
      throw new Error(ageData.error.message);
    }

    // Fetch gender breakdown
    const genderUrl = `https://graph.facebook.com/v21.0/${metaAdAccountId}/insights?` +
      `access_token=${metaAccessToken}` +
      `&fields=spend,impressions,clicks,reach,cpm,actions,cost_per_action_type` +
      `&breakdowns=gender` +
      `&time_range={"since":"${start}","until":"${end}"}` +
      `&level=account` +
      filteringParam;

    const genderResponse = await fetch(genderUrl);
    const genderData = await genderResponse.json();

    if (genderData.error) {
      console.error('Meta API error (gender):', genderData.error);
      throw new Error(genderData.error.message);
    }

    // Fetch age+gender breakdown for top segment CPM
    const ageGenderUrl = `https://graph.facebook.com/v21.0/${metaAdAccountId}/insights?` +
      `access_token=${metaAccessToken}` +
      `&fields=spend,impressions,clicks,reach,cpm,actions,cost_per_action_type` +
      `&breakdowns=age,gender` +
      `&time_range={"since":"${start}","until":"${end}"}` +
      `&level=account` +
      filteringParam;

    const ageGenderResponse = await fetch(ageGenderUrl);
    const ageGenderData = await ageGenderResponse.json();

    if (ageGenderData.error) {
      console.error('Meta API error (age+gender):', ageGenderData.error);
      throw new Error(ageGenderData.error.message);
    }

    // Fetch campaigns for the campaign filter dropdown
    const campaignsUrl = `https://graph.facebook.com/v21.0/${metaAdAccountId}/campaigns?` +
      `access_token=${metaAccessToken}` +
      `&fields=id,name,status` +
      `&limit=500`;

    const campaignsResponse = await fetch(campaignsUrl);
    const campaignsData = await campaignsResponse.json();

    if (campaignsData.error) {
      console.error('Meta API error (campaigns):', campaignsData.error);
      // Non-fatal, continue with empty campaigns
    }

    // Helper to extract mobile_app_install metrics from actions
    const extractInstallMetrics = (item: any) => {
      const actions = item.actions || [];
      const costPerActionType = item.cost_per_action_type || [];
      
      const installAction = actions.find((a: any) => a.action_type === 'mobile_app_install');
      const installCost = costPerActionType.find((a: any) => a.action_type === 'mobile_app_install');
      
      // Calculate CPA manually if we have results and spend but no cost_per_action_type
      let costPerResult: number | null = null;
      if (installCost) {
        costPerResult = parseFloat(installCost.value || '0');
      } else if (installAction) {
        // Meta sometimes doesn't provide cost_per_action_type, so we calculate it
        const results = parseInt(installAction.value || '0', 10);
        const spend = parseFloat(item.spend || '0');
        if (results > 0) {
          costPerResult = spend / results;
        }
      }
      
      return {
        results: installAction ? parseInt(installAction.value || '0', 10) : 0,
        costPerResult,
      };
    };

    // Process the data
    const ageBreakdown = (ageData.data || []).map((item: any) => {
      const installMetrics = extractInstallMetrics(item);
      return {
        age: item.age,
        spend: parseFloat(item.spend || '0'),
        impressions: parseInt(item.impressions || '0', 10),
        clicks: parseInt(item.clicks || '0', 10),
        reach: parseInt(item.reach || '0', 10),
        cpm: parseFloat(item.cpm || '0'),
        results: installMetrics.results,
        costPerResult: installMetrics.costPerResult,
      };
    });

    const genderBreakdown = (genderData.data || []).map((item: any) => {
      const installMetrics = extractInstallMetrics(item);
      return {
        gender: item.gender,
        spend: parseFloat(item.spend || '0'),
        impressions: parseInt(item.impressions || '0', 10),
        clicks: parseInt(item.clicks || '0', 10),
        reach: parseInt(item.reach || '0', 10),
        cpm: parseFloat(item.cpm || '0'),
        results: installMetrics.results,
        costPerResult: installMetrics.costPerResult,
      };
    });

    const ageGenderBreakdown = (ageGenderData.data || []).map((item: any) => {
      const installMetrics = extractInstallMetrics(item);
      return {
        age: item.age,
        gender: item.gender,
        spend: parseFloat(item.spend || '0'),
        impressions: parseInt(item.impressions || '0', 10),
        clicks: parseInt(item.clicks || '0', 10),
        reach: parseInt(item.reach || '0', 10),
        cpm: parseFloat(item.cpm || '0'),
        results: installMetrics.results,
        costPerResult: installMetrics.costPerResult,
      };
    });

    // Calculate totals for percentage calculations
    const totalSpend = ageBreakdown.reduce((sum: number, item: any) => sum + item.spend, 0);

    // Find top segments
    const topGender = genderBreakdown.length > 0 
      ? genderBreakdown.reduce((max: any, item: any) => item.spend > max.spend ? item : max, genderBreakdown[0])
      : null;

    const topAge = ageBreakdown.length > 0
      ? ageBreakdown.reduce((max: any, item: any) => item.spend > max.spend ? item : max, ageBreakdown[0])
      : null;

    const topAgeGender = ageGenderBreakdown.length > 0
      ? ageGenderBreakdown.reduce((max: any, item: any) => item.spend > max.spend ? item : max, ageGenderBreakdown[0])
      : null;

    const campaigns = (campaignsData.data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      status: c.status,
    }));

    console.log(`Fetched demographics: ${ageBreakdown.length} age groups, ${genderBreakdown.length} genders, ${ageGenderBreakdown.length} age+gender combos`);

    return new Response(
      JSON.stringify({
        ageBreakdown,
        genderBreakdown,
        ageGenderBreakdown,
        totalSpend,
        topGender,
        topAge,
        topAgeGender,
        campaigns,
        dateRange: { start, end },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching demographics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
