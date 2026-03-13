import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TemplateElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
  fontColor?: string;
  text?: string;
  format?: string;
  imageUrl?: string;
}

interface FixtureData {
  id: string;
  match_date: string;
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
  home_team: { name: string; image_url: string | null };
  away_team: { name: string; image_url: string | null };
}

function formatMatchDate(dateStr: string): string {
  const date = new Date(dateStr);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const day = days[date.getUTCDay()];
  const dayNum = date.getUTCDate();
  const month = months[date.getUTCMonth()];
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const mins = date.getUTCMinutes().toString().padStart(2, '0');
  
  return `${day} ${dayNum} ${month}, ${hours}:${mins}`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function generateSvg(
  width: number,
  height: number,
  backgroundUrl: string | null,
  elements: TemplateElement[],
  fixtureData: FixtureData,
  termsText: string
): Promise<string> {
  let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&amp;display=swap');
      text { font-family: 'Inter', Arial, sans-serif; }
    </style>
  </defs>`;
  
  // Background
  if (backgroundUrl) {
    svgContent += `\n  <image href="${backgroundUrl}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>`;
  } else {
    svgContent += `\n  <rect x="0" y="0" width="${width}" height="${height}" fill="#1a1a2e"/>`;
  }

  for (const el of elements) {
    switch (el.type) {
      case 'home_team_icon':
        if (fixtureData.home_team?.image_url) {
          svgContent += `\n  <image href="${fixtureData.home_team.image_url}" x="${el.x}" y="${el.y}" width="${el.width || 150}" height="${el.height || 150}" preserveAspectRatio="xMidYMid meet"/>`;
        }
        break;

      case 'away_team_icon':
        if (fixtureData.away_team?.image_url) {
          svgContent += `\n  <image href="${fixtureData.away_team.image_url}" x="${el.x}" y="${el.y}" width="${el.width || 150}" height="${el.height || 150}" preserveAspectRatio="xMidYMid meet"/>`;
        }
        break;

      case 'match_time':
        const timeText = escapeXml(formatMatchDate(fixtureData.match_date));
        svgContent += `\n  <text x="${el.x}" y="${el.y + (el.fontSize || 48)}" font-size="${el.fontSize || 48}" font-weight="700" fill="${el.fontColor || '#ffffff'}">${timeText}</text>`;
        break;

      case 'vs_text':
        svgContent += `\n  <text x="${el.x}" y="${el.y + (el.fontSize || 64)}" font-size="${el.fontSize || 64}" font-weight="800" fill="${el.fontColor || '#ffcc00'}">${escapeXml(el.text || 'VS')}</text>`;
        break;

      case 'odds_display':
        const oddsParts = [];
        if (fixtureData.home_odds) oddsParts.push(fixtureData.home_odds.toFixed(2));
        if (fixtureData.draw_odds) oddsParts.push(fixtureData.draw_odds.toFixed(2));
        if (fixtureData.away_odds) oddsParts.push(fixtureData.away_odds.toFixed(2));
        const oddsText = oddsParts.length > 0 ? oddsParts.join('   ') : 'Odds TBC';
        svgContent += `\n  <text x="${el.x}" y="${el.y + (el.fontSize || 32)}" font-size="${el.fontSize || 32}" font-weight="600" fill="${el.fontColor || '#ffffff'}">${escapeXml(oddsText)}</text>`;
        break;

      case 'custom_text':
        svgContent += `\n  <text x="${el.x}" y="${el.y + (el.fontSize || 24)}" font-size="${el.fontSize || 24}" font-weight="600" fill="${el.fontColor || '#ffffff'}">${escapeXml(el.text || '')}</text>`;
        break;

      case 'custom_image':
        if (el.imageUrl) {
          svgContent += `\n  <image href="${el.imageUrl}" x="${el.x}" y="${el.y}" width="${el.width || 200}" height="${el.height || 80}" preserveAspectRatio="xMidYMid meet"/>`;
        }
        break;

      case 'terms':
        svgContent += `\n  <text x="${el.x}" y="${el.y + (el.fontSize || 12)}" font-size="${el.fontSize || 12}" fill="${el.fontColor || '#cccccc'}">${escapeXml(termsText)}</text>`;
        break;
    }
  }

  svgContent += '\n</svg>';
  return svgContent;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fixture_id, template_id } = await req.json();

    if (!fixture_id || !template_id) {
      throw new Error('fixture_id and template_id are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch template
    const { data: template, error: templateError } = await supabase
      .from('ad_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (templateError || !template) {
      throw new Error(`Template not found: ${templateError?.message}`);
    }

    // Fetch fixture with team data
    const { data: fixture, error: fixtureError } = await supabase
      .from('football_fixtures')
      .select(`
        id,
        match_date,
        home_odds,
        draw_odds,
        away_odds,
        home_team:football_teams!football_fixtures_home_team_id_fkey(name, image_url),
        away_team:football_teams!football_fixtures_away_team_id_fkey(name, image_url)
      `)
      .eq('id', fixture_id)
      .single();

    if (fixtureError || !fixture) {
      throw new Error(`Fixture not found: ${fixtureError?.message}`);
    }

    const fixtureData = fixture as unknown as FixtureData;
    const elements: TemplateElement[] = template.elements || [];
    const width = template.width || 1080;
    const height = template.height || 1080;

    // Generate SVG
    const svg = await generateSvg(
      width,
      height,
      template.background_image_url,
      elements,
      fixtureData,
      template.terms_text || ''
    );

    const fileName = `${fixture_id}_${Date.now()}.svg`;

    // Upload SVG to storage
    const { error: uploadError } = await supabase.storage
      .from('generated-football-ads')
      .upload(fileName, svg, {
        contentType: 'image/svg+xml',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('generated-football-ads')
      .getPublicUrl(fileName);

    const imageUrl = publicUrlData.publicUrl;

    // Create generated ad record
    const { data: generatedAd, error: genError } = await supabase
      .from('generated_football_ads')
      .insert({
        fixture_id,
        template_id,
        generated_image_url: imageUrl,
        status: 'generated',
        scheduled_pause_at: fixtureData.match_date,
      })
      .select()
      .single();

    if (genError) {
      console.error('Error saving generated ad record:', genError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        image_url: imageUrl,
        generated_ad_id: generatedAd?.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error generating ad:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
