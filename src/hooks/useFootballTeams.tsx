import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

export interface FootballTeam {
  id: string;
  api_team_id: number;
  name: string;
  short_name: string | null;
  tla: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export function useFootballTeams() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['football-teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('football_teams')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as FootballTeam[];
    },
  });

  const updateImageMutation = useMutation({
    mutationFn: async ({ teamId, imageUrl }: { teamId: string; imageUrl: string | null }) => {
      const { error } = await supabase
        .from('football_teams')
        .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
        .eq('id', teamId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['football-teams'] });
    },
    onError: (error: Error) => {
      toast.error("Failed to update team image: " + error.message);
    },
  });

  const syncTeams = async () => {
    setIsSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('fetch-football-fixtures');
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['football-teams'] });
      queryClient.invalidateQueries({ queryKey: ['football-fixtures'] });
      toast.success("Teams synced successfully");
    } catch (error: any) {
      toast.error("Failed to sync teams: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    teams,
    isLoading,
    isSyncing,
    updateTeamImage: (teamId: string, imageUrl: string | null) => 
      updateImageMutation.mutateAsync({ teamId, imageUrl }),
    syncTeams,
  };
}
