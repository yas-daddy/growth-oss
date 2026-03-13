import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

export interface FootballFixture {
  id: string;
  api_fixture_id: number;
  home_team_id: string | null;
  away_team_id: string | null;
  match_date: string;
  competition: string;
  status: string;
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
  odds_fetched_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useFootballFixtures() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: fixtures = [], isLoading } = useQuery({
    queryKey: ['football-fixtures'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('football_fixtures')
        .select('*')
        .gte('match_date', new Date().toISOString())
        .order('match_date');

      if (error) throw error;
      return data as FootballFixture[];
    },
  });

  const syncFixtures = async () => {
    setIsSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('fetch-football-fixtures');
      if (error) throw error;
      
      // Also try to sync odds
      try {
        await supabase.functions.invoke('fetch-betting-odds');
      } catch (oddsError) {
        console.warn("Could not fetch odds:", oddsError);
      }

      queryClient.invalidateQueries({ queryKey: ['football-fixtures'] });
      queryClient.invalidateQueries({ queryKey: ['football-teams'] });
      toast.success("Fixtures synced successfully");
    } catch (error: any) {
      toast.error("Failed to sync fixtures: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    fixtures,
    isLoading,
    isSyncing,
    syncFixtures,
  };
}
