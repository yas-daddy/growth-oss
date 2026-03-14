import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getTenantCredentials } from "../_shared/tenant-credentials.ts";
import { resolveOrgContext } from "../_shared/org-resolver.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { orgId } = await resolveOrgContext(req, body);

    const { credentials } = await getTenantCredentials('meta_ads', orgId);
    const metaAdAccountId = credentials.ad_account_id;

    if (!metaAdAccountId) {
      return new Response(
        JSON.stringify({ account_id: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Remove 'act_' prefix if present for the URL format
    const cleanAccountId = metaAdAccountId.replace(/^act_/, '');

    return new Response(
      JSON.stringify({ account_id: cleanAccountId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error fetching Meta account ID:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
