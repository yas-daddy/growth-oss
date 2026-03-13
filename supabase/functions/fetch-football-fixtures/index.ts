import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startSyncLog, completeSyncLog } from "../_shared/sync-logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FootballDataMatch {
  id: number;
  utcDate: string;
  status: string;
  competition: {
    name: string;
  };
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const syncLog = await startSyncLog('fetch-football-fixtures');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const footballApiKey = Deno.env.get('FOOTBALL_DATA_API_KEY');

    if (!footballApiKey) {
      throw new Error('FOOTBALL_DATA_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const competitions = ['PL', 'ELC', 'FAC', 'CL'];
    const allMatches: FootballDataMatch[] = [];

    for (const code of competitions) {
      try {
        const response = await fetch(
          `https://api.football-data.org/v4/competitions/${code}/matches?status=SCHEDULED`,
          { headers: { 'X-Auth-Token': footballApiKey } }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`Failed to fetch ${code}: ${response.status} - ${errorText}`);
          continue;
        }

        const data = await response.json();
        const matches: FootballDataMatch[] = data.matches || [];
        console.log(`Fetched ${matches.length} scheduled matches for ${code}`);
        allMatches.push(...matches);
      } catch (err: any) {
        console.warn(`Error fetching ${code}: ${err.message}`);
      }

      // Rate limit delay between calls
      if (code !== competitions[competitions.length - 1]) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    console.log(`Total scheduled matches across all competitions: ${allMatches.length}`);

    // Process each match
    for (const match of allMatches) {
      // Upsert home team
      const { data: homeTeam } = await supabase
        .from('football_teams')
        .upsert({
          api_team_id: match.homeTeam.id,
          name: match.homeTeam.name,
          short_name: match.homeTeam.shortName,
          tla: match.homeTeam.tla,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'api_team_id',
        })
        .select('id')
        .single();

      // Upsert away team
      const { data: awayTeam } = await supabase
        .from('football_teams')
        .upsert({
          api_team_id: match.awayTeam.id,
          name: match.awayTeam.name,
          short_name: match.awayTeam.shortName,
          tla: match.awayTeam.tla,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'api_team_id',
        })
        .select('id')
        .single();

      // Upsert fixture
      await supabase
        .from('football_fixtures')
        .upsert({
          api_fixture_id: match.id,
          home_team_id: homeTeam?.id,
          away_team_id: awayTeam?.id,
          match_date: match.utcDate,
          competition: match.competition.name,
          status: match.status,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'api_fixture_id',
        });
    }

    await completeSyncLog(syncLog?.id || null, true);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Synced ${allMatches.length} fixtures across ${competitions.length} competitions`,
        fixtures_count: allMatches.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error fetching fixtures:', error);
    await completeSyncLog(syncLog?.id || null, false, error.message);

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
