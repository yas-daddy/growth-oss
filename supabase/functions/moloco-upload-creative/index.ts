import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MOLOCO_AUTH_URL = 'https://api.moloco.cloud/cm/v1/auth/tokens';
const MOLOCO_API_URL = 'https://api.moloco.cloud/cm/v1';

async function getAccessToken(): Promise<string> {
  const apiKey = Deno.env.get('MOLOCO_API_KEY')!;
  
  const response = await fetch(MOLOCO_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ api_key: apiKey }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get Moloco access token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.token;
}

function getMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'webm': 'video/webm',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

function getCreativeType(mimeType: string): 'IMAGE' | 'VIDEO' {
  return mimeType.startsWith('video/') ? 'VIDEO' : 'IMAGE';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const adAccountId = Deno.env.get('MOLOCO_AD_ACCOUNT_ID')!;

    // Verify user is authenticated
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { mediaUrl, fileName, creativeName } = body;

    if (!mediaUrl || !fileName) {
      return new Response(
        JSON.stringify({ error: 'Missing mediaUrl or fileName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Uploading creative to Moloco: ${fileName}`);
    
    const accessToken = await getAccessToken();
    const mimeType = getMimeType(fileName);
    const creativeType = getCreativeType(mimeType);
    
    // Step 1: Create asset upload session
    console.log('Step 1: Creating asset upload session...');
    const assetSessionResponse = await fetch(`${MOLOCO_API_URL}/creative-assets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ad_account_id: adAccountId,
        file_name: fileName,
        content_type: mimeType,
      }),
    });

    if (!assetSessionResponse.ok) {
      const errorText = await assetSessionResponse.text();
      console.error('Asset session error:', errorText);
      throw new Error(`Failed to create asset session: ${assetSessionResponse.status} ${errorText}`);
    }

    const assetSession = await assetSessionResponse.json();
    const uploadUrl = assetSession.upload_url;
    const assetId = assetSession.id;
    
    console.log(`Asset session created with ID: ${assetId}`);

    // Step 2: Download the file from storage URL
    console.log('Step 2: Downloading file from storage...');
    const fileResponse = await fetch(mediaUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file from storage: ${fileResponse.status}`);
    }
    const fileBlob = await fileResponse.blob();
    const fileBuffer = await fileBlob.arrayBuffer();
    
    console.log(`Downloaded file: ${fileBlob.size} bytes`);

    // Step 3: Upload to GCS
    console.log('Step 3: Uploading to GCS...');
    const gcsResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
      },
      body: fileBuffer,
    });

    if (!gcsResponse.ok) {
      const errorText = await gcsResponse.text();
      console.error('GCS upload error:', errorText);
      throw new Error(`Failed to upload to GCS: ${gcsResponse.status} ${errorText}`);
    }
    
    console.log('File uploaded to GCS successfully');

    // Step 4: Create the creative object
    console.log('Step 4: Creating creative object...');
    const creativeResponse = await fetch(`${MOLOCO_API_URL}/creatives`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ad_account_id: adAccountId,
        title: creativeName || fileName.replace(/\.[^/.]+$/, ''),
        type: creativeType,
        asset_id: assetId,
      }),
    });

    if (!creativeResponse.ok) {
      const errorText = await creativeResponse.text();
      console.error('Creative creation error:', errorText);
      throw new Error(`Failed to create creative: ${creativeResponse.status} ${errorText}`);
    }

    const creative = await creativeResponse.json();
    console.log(`Creative created with ID: ${creative.id}`);

    return new Response(
      JSON.stringify({ 
        creative_id: creative.id,
        creative_title: creative.title,
        creative_type: creativeType,
        asset_id: assetId,
        asset_url: creative.main_asset_location || null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error uploading creative:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
