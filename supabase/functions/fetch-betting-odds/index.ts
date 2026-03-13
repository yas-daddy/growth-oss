import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startSyncLog, completeSyncLog } from "../_shared/sync-logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OddsApiGame {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title: string;
    markets: Array<{
      key: string;
      outcomes: Array<{
        name: string;
        price: number;
      }>;
    }>;
  }>;
}

// Normalize team names for matching - strip common suffixes and standardize
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(fc|afc|cf|united|city|hotspur|wanderers|albion)$/gi, '')
    .replace(/\s+(fc|afc|cf)$/gi, '')
    .replace(/manchester$/, 'man')
    .replace(/wolverhampton$/, 'wolves')
    .replace(/nottingham forest/, 'nottingham')
    .replace(/brighton.*hove/, 'brighton')
    .replace(/&/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Match a single team name from the Odds API to our database team
function matchTeamName(oddsApiName: string, dbName: string, dbShortName: string | null): boolean {
  const normalizedOdds = normalizeTeamName(oddsApiName);
  const normalizedDb = normalizeTeamName(dbName);
  
  // Direct match on normalized names
  if (normalizedDb.includes(normalizedOdds) || normalizedOdds.includes(normalizedDb)) {
    return true;
  }
  
  // Try matching against short_name (often more reliable)
  if (dbShortName) {
    const normalizedShort = dbShortName.toLowerCase().trim();
    if (normalizedShort.includes(normalizedOdds) || normalizedOdds.includes(normalizedShort)) {
      return true;
    }
  }
  
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const syncLog = await startSyncLog('fetch-betting-odds');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const oddsApiKey = Deno.env.get('ODDS_API_KEY');

    if (!oddsApiKey) {
      throw new Error('ODDS_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch odds for English Premier League
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/soccer_epl/odds?apiKey=${oddsApiKey}&regions=uk&markets=h2h&oddsFormat=decimal`,
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Odds API error: ${response.status} - ${errorText}`);
    }

    const games: OddsApiGame[] = await response.json();
    console.log(`Fetched odds for ${games.length} games`);

    // Get all fixtures with team names (including short_name for better matching)
    // Note: Football-data.org uses 'TIMED' or 'SCHEDULED' for upcoming matches
    const { data: fixtures } = await supabase
      .from('football_fixtures')
      .select(`
        id,
        match_date,
        home_team:football_teams!football_fixtures_home_team_id_fkey(name, short_name),
        away_team:football_teams!football_fixtures_away_team_id_fkey(name, short_name)
      `)
      .gte('match_date', new Date().toISOString())
      .in('status', ['SCHEDULED', 'TIMED']);

    let updatedCount = 0;
    console.log(`Found ${fixtures?.length || 0} scheduled fixtures to match`);

    // Match odds to fixtures
    for (const game of games) {
      console.log(`Trying to match: ${game.home_team} vs ${game.away_team}`);
      
      // Find matching fixture using improved matching
      const matchingFixture = fixtures?.find(f => {
        const homeTeam = f.home_team as any;
        const awayTeam = f.away_team as any;
        if (!homeTeam || !awayTeam) return false;
        
        const homeMatches = matchTeamName(game.home_team, homeTeam.name, homeTeam.short_name);
        const awayMatches = matchTeamName(game.away_team, awayTeam.name, awayTeam.short_name);
        
        return homeMatches && awayMatches;
      });

      if (matchingFixture && game.bookmakers.length > 0) {
        // Use first bookmaker's h2h market
        const bookmaker = game.bookmakers[0];
        const h2hMarket = bookmaker.markets.find(m => m.key === 'h2h');
        
        if (h2hMarket) {
          // Match odds outcomes to teams using the game's team names
          const normalizedGameHome = normalizeTeamName(game.home_team);
          const normalizedGameAway = normalizeTeamName(game.away_team);
          
          const homeOdds = h2hMarket.outcomes.find(o => 
            normalizeTeamName(o.name).includes(normalizedGameHome) || 
            normalizedGameHome.includes(normalizeTeamName(o.name))
          )?.price;
          
          const awayOdds = h2hMarket.outcomes.find(o => 
            normalizeTeamName(o.name).includes(normalizedGameAway) || 
            normalizedGameAway.includes(normalizeTeamName(o.name))
          )?.price;
          
          const drawOdds = h2hMarket.outcomes.find(o => 
            o.name.toLowerCase() === 'draw'
          )?.price;

          if (homeOdds || drawOdds || awayOdds) {
            await supabase
              .from('football_fixtures')
              .update({
                home_odds: homeOdds || null,
                draw_odds: drawOdds || null,
                away_odds: awayOdds || null,
                odds_fetched_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', matchingFixture.id);

            updatedCount++;
            console.log(`Updated odds for fixture ${matchingFixture.id}: H=${homeOdds} D=${drawOdds} A=${awayOdds}`);
          }
        }
      }
    }

    await completeSyncLog(syncLog?.id || null, true);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Updated odds for ${updatedCount} fixtures`,
        games_fetched: games.length,
        fixtures_updated: updatedCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error fetching odds:', error);
    await completeSyncLog(syncLog?.id || null, false, error.message);

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
