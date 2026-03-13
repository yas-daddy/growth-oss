import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCallback } from "react";

interface FootballTeamScore {
  id: string;
  team_id: string;
  score: number;
  created_at: string;
  updated_at: string;
}

export function useFootballTeamScores() {
  const queryClient = useQueryClient();

  const { data: teamScores = [], isLoading } = useQuery({
    queryKey: ["football-team-scores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("football_team_scores")
        .select("*");

      if (error) throw error;
      return data as FootballTeamScore[];
    },
  });

  const scoreMap = new Map(teamScores.map((s) => [s.team_id, s.score]));

  const getTeamScore = useCallback(
    (teamId: string | null): number => {
      if (!teamId) return 1;
      return scoreMap.get(teamId) ?? 1;
    },
    [scoreMap]
  );

  const getMatchScore = useCallback(
    (homeTeamId: string | null, awayTeamId: string | null): number => {
      return getTeamScore(homeTeamId) + getTeamScore(awayTeamId);
    },
    [getTeamScore]
  );

  const updateScoreMutation = useMutation({
    mutationFn: async ({ teamId, score }: { teamId: string; score: number }) => {
      const { error } = await supabase
        .from("football_team_scores")
        .upsert(
          {
            team_id: teamId,
            score,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "team_id" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["football-team-scores"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to update team score: " + error.message);
    },
  });

  const updateScore = (teamId: string, score: number) =>
    updateScoreMutation.mutateAsync({ teamId, score });

  return {
    teamScores,
    isLoading,
    getTeamScore,
    getMatchScore,
    updateScore,
  };
}
