import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface ChannelWeights {
  id: string;
  user_id: string;
  app_store_weight: number;
  google_play_weight: number;
  trustpilot_weight: number;
  typeform_weight: number;
  created_at: string;
  updated_at: string;
}

const DEFAULT_WEIGHTS: Omit<ChannelWeights, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  app_store_weight: 1,
  google_play_weight: 1,
  trustpilot_weight: 1,
  typeform_weight: 1,
};

export function useChannelWeights() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["channel-weights"],
    queryFn: async () => {
      // Fetch organization-wide settings (first row, not filtered by user)
      const { data, error } = await supabase
        .from("channel_weights")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      // Return defaults if no settings exist
      if (!data) {
        return DEFAULT_WEIGHTS;
      }
      
      return {
        app_store_weight: Number(data.app_store_weight),
        google_play_weight: Number(data.google_play_weight),
        trustpilot_weight: Number(data.trustpilot_weight),
        typeform_weight: Number(data.typeform_weight),
      };
    },
    enabled: !!user,
  });
}

export function useUpdateChannelWeights() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (weights: {
      app_store_weight: number;
      google_play_weight: number;
      trustpilot_weight: number;
      typeform_weight: number;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Check if organization settings already exist
      const { data: existing } = await supabase
        .from("channel_weights")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Update existing organization settings
        const { error } = await supabase
          .from("channel_weights")
          .update(weights)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Create new organization settings (use current user as owner)
        const { error } = await supabase
          .from("channel_weights")
          .insert({ ...weights, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channel-weights"] });
    },
  });
}
